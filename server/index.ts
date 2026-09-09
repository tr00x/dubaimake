
import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import fs from 'fs';
import crypto from 'crypto';
import {
    createChallenge,
    validateChallenge,
    assessContent,
    isDuplicate,
    isAllowedOrigin,
    contactLimiter,
    contactGlobalLimiter,
    challengeLimiter,
    loginLimiter,
    logContactEvent,
    clientIp,
    escapeHtml,
    truncate,
    resolveCaptchaMode,
    SCORE_WARN,
    SCORE_DROP,
} from './antispam';

const app = express();
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || "file:./dev.db"
        }
    }
});
const PORT = 3001;

// Behind nginx: trust the first proxy hop so req.ip is the real client IP
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)),
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '0',
    etag: false,
    lastModified: false
}));

// Image Upload Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- Auth Helper ---
const getSecret = () => process.env.JWT_SECRET || 'default-secret-key-change-this';

const createToken = (payload: any) => {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
    return `${data}.${signature}`;
};

const verifyToken = (token: string) => {
    try {
        const [data, signature] = token.split('.');
        if (!data || !signature) return null;

        const expectedSignature = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
        if (signature !== expectedSignature) return null;

        return JSON.parse(Buffer.from(data, 'base64').toString());
    } catch (e) {
        return null;
    }
};

// --- Auth Middleware ---
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.admin_token;
    
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = verifyToken(token);
    if (payload && payload.role === 'admin' && payload.exp > Date.now()) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

const isEmptyValue = (v: any) =>
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim() === '');

const parseRequiredInt = (v: any) => {
    if (isEmptyValue(v)) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
};

const parseOptionalInt = (v: any) => {
    if (isEmptyValue(v)) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
};

const parseOptionalFloat = (v: any) => {
    if (isEmptyValue(v)) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n;
};

const parseUpdateOptionalInt = (v: any) => {
    if (v === undefined) return undefined;
    return parseOptionalInt(v);
};

const parseUpdateOptionalFloat = (v: any) => {
    if (v === undefined) return undefined;
    return parseOptionalFloat(v);
};

const toStringOrEmpty = (v: any) => {
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? v : String(v);
};

// --- API Routes ---

// Issue a signed, single-use challenge (and captcha) for the contact forms.
app.get('/api/contact/challenge', challengeLimiter, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(createChallenge());
});

const asString = (v: unknown, max: number) => (typeof v === 'string' ? truncate(v.trim(), max) : '');

app.post('/api/contact', contactGlobalLimiter, contactLimiter, async (req, res) => {
    const ip = clientIp(req);
    const userAgent = req.get('user-agent');
    const origin = req.get('origin');
    const referer = req.get('referer');

    const name = asString(req.body?.name, 120);
    const contact = asString(req.body?.contact, 200);
    const message = asString(req.body?.message, 3000);
    const carTitle = asString(req.body?.carTitle, 200);
    const carPrice = asString(req.body?.carPrice, 60);
    const link = asString(req.body?.link, 500);
    const source = asString(req.body?.source, 100);
    const carImage = asString(req.body?.carImage, 500);
    const honeypot = asString(req.body?.website, 500);

    const reject = (status: number, code: string, extra: Record<string, unknown> = {}) => {
        logContactEvent({ outcome: 'rejected', code, ip, userAgent, origin, referer, source, name, contact, message: truncate(message, 300), ...extra });
        return res.status(status).json({ error: code });
    };

    // Origin / Referer must belong to the site when present
    if (origin && !isAllowedOrigin(origin)) return reject(403, 'bad_origin');
    if (!origin && referer && !isAllowedOrigin(referer)) return reject(403, 'bad_origin');

    // Honeypot: real users never fill this
    if (honeypot) return reject(400, 'spam');

    // Basic field validation
    if (name.length < 2 || !contact || contact.length < 3) {
        return reject(400, 'invalid_fields');
    }
    if (typeof req.body?.message === 'string' && req.body.message.length > 3000) {
        return reject(400, 'message_too_long');
    }

    // Challenge token + captcha
    const challenge = await validateChallenge(req.body, ip);
    if (!challenge.ok) {
        const status = challenge.code === 'captcha_unavailable' ? 503 : 400;
        return reject(status, challenge.code);
    }

    // Content heuristics
    const assessment = assessContent({ name, contact, message, userAgent, origin, referer });

    if (assessment.score >= SCORE_DROP) {
        // Silently drop: bots learn nothing, humans (rare false positives) can still use WhatsApp/Telegram buttons.
        logContactEvent({ outcome: 'dropped', score: assessment.score, reasons: assessment.reasons, ip, userAgent, origin, referer, source, name, contact, message: truncate(message, 300) });
        return res.json({ success: true });
    }

    if (isDuplicate(name, contact, message)) {
        logContactEvent({ outcome: 'duplicate', ip, userAgent, source, name, contact });
        return res.json({ success: true });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = process.env.TELEGRAM_CHAT_ID?.split(',').map(id => id.trim()).filter(Boolean);

    if (!token || !chatIds || chatIds.length === 0) {
        console.error('Telegram credentials not set');
        return res.status(500).json({ error: 'server_config' });
    }

    const isManagerRequest = source === 'Manager Button (Modal)' || source === 'Кнопка менеджера (модальное окно)';

    const title = isManagerRequest
        ? '👨‍💼 <b>Вопрос Менеджеру!</b>'
        : '📩 <b>Новая заявка с сайта!</b>';

    const suspicious = assessment.score >= SCORE_WARN;
    const lines = [
        title,
        suspicious ? `⚠️ <i>Возможный спам (score ${assessment.score}: ${escapeHtml(assessment.reasons.join(', '))})</i>` : '',
        '',
        `👤 <b>Имя:</b> ${escapeHtml(name)}`,
        `📞 <b>Контакты:</b> ${escapeHtml(contact)}`,
        carTitle ? `🚗 <b>Автомобиль:</b> ${escapeHtml(carTitle)}` : '',
        carPrice ? `💰 <b>Цена:</b> ${escapeHtml(carPrice)}` : '',
        (link && isManagerRequest && /^https?:\/\//i.test(link)) ? `🔗 <a href="${escapeHtml(link)}">Ссылка на страницу</a>` : '',
        '',
        '💬 <b>Сообщение:</b>',
        escapeHtml(message || 'Без сообщения'),
        suspicious && ip ? `\n🌐 IP: ${escapeHtml(ip)}` : '',
    ];
    const text = lines.filter((l, i) => l !== '' || i === 2 || i === 8).join('\n').trim();

    try {
        const bot = new Telegraf(token);

        // Resolve photo source once
        let photoSource: string | { source: string } | undefined;
        if (carImage && !carImage.includes('..') && !carImage.includes('\\')) {
            if (carImage.startsWith('/uploads/')) {
                const localPath = path.join(__dirname, carImage);
                if (fs.existsSync(localPath)) photoSource = { source: localPath };
                else console.log('Uploads file not found:', localPath);
            } else if (carImage.startsWith('/images/')) {
                const localPath = path.join(__dirname, '..', 'public', carImage);
                if (fs.existsSync(localPath)) photoSource = { source: localPath };
                else console.log('Public file not found:', localPath);
            } else if (/^https?:\/\//i.test(carImage)) {
                photoSource = carImage;
            } else {
                const uploadPath = path.join(__dirname, 'uploads', carImage);
                if (fs.existsSync(uploadPath)) photoSource = { source: uploadPath };
            }
        }

        // Send to all chat IDs
        const results = await Promise.allSettled(chatIds.map(async (chatId) => {
            let sent = false;
            if (photoSource) {
                try {
                    await bot.telegram.sendPhoto(chatId, photoSource, { caption: truncate(text, 1000), parse_mode: 'HTML' });
                    sent = true;
                } catch (err) {
                    console.error(`Error sending photo to ${chatId}:`, err);
                }
            }
            if (!sent) {
                await bot.telegram.sendMessage(chatId, truncate(text, 4000), { parse_mode: 'HTML' });
            }
        }));

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0 && failures.length === chatIds.length) {
            throw new Error('Failed to send to all recipients');
        }

        logContactEvent({ outcome: 'sent', score: assessment.score, reasons: assessment.reasons, captcha: challenge.mode, ip, userAgent, source, name, contact, partial: failures.length > 0 });
        res.json({ success: true, partial: failures.length > 0 });
    } catch (error) {
        console.error('Telegram send error:', error);
        logContactEvent({ outcome: 'send_failed', ip, source, name, contact, error: String(error) });
        res.status(500).json({ error: 'send_failed' });
    }
});

// Auth
app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'password';

    if (username === validUsername && password === validPassword) {
        const token = createToken({
            role: 'admin',
            exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        });

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: false, // Localhost
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

app.get('/api/auth/me', (req, res) => {
    const token = req.cookies.admin_token;
    const payload = verifyToken(token || '');
    
    if (payload && payload.role === 'admin' && payload.exp > Date.now()) {
        res.json({ user: 'admin' });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});

// Env Management
app.get('/api/admin/env', requireAuth, (req, res) => {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        if (!fs.existsSync(envPath)) {
             return res.json({});
        }
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const envVars: Record<string, string> = {};
        
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                if (['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ADMIN_USERNAME', 'MANAGER_WHATSAPP', 'MANAGER_TELEGRAM', 'CAPTCHA_MODE', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'].includes(key)) {
                    envVars[key] = value;
                }
            }
        });
        
        res.json(envVars);
    } catch (error) {
        console.error('Error reading .env:', error);
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

app.post('/api/admin/env', requireAuth, (req, res) => {
    try {
        const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ADMIN_USERNAME, ADMIN_PASSWORD, MANAGER_WHATSAPP, MANAGER_TELEGRAM, CAPTCHA_MODE, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY } = req.body;

        if (CAPTCHA_MODE !== undefined && !['auto', 'builtin', 'turnstile', 'off'].includes(String(CAPTCHA_MODE))) {
            return res.status(400).json({ error: 'Invalid CAPTCHA_MODE' });
        }
        const envPath = path.join(__dirname, '..', '.env');
        
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }

        const newVars = { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ADMIN_USERNAME, ADMIN_PASSWORD, MANAGER_WHATSAPP, MANAGER_TELEGRAM, CAPTCHA_MODE, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY };
        let newContent = envContent;

        Object.entries(newVars).forEach(([key, value]) => {
            if (value === undefined) return;
            if (typeof value !== 'string' || /[\r\n]/.test(value)) return;

            // Update process.env
            process.env[key] = value;

            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(newContent)) {
                newContent = newContent.replace(regex, `${key}=${value}`);
            } else {
                newContent += `\n${key}=${value}`;
            }
        });

        fs.writeFileSync(envPath, newContent.trim() + '\n');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing .env:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Public Config
app.get('/api/contact-info', (req, res) => {
    res.json({
        whatsapp: process.env.MANAGER_WHATSAPP || '',
        telegram: process.env.MANAGER_TELEGRAM || '',
        captcha: resolveCaptchaMode(),
    });
});

// Cars
app.get('/api/cars', async (req, res) => {
    const { admin } = req.query;
    const where = admin === 'true'
        ? {} // Admin sees all
        : { status: 'active' }; // Public sees active

    try {
        const cars = await prisma.car.findMany({
            where,
            include: { images: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { createdAt: 'desc' }
        });

        // Transform for frontend if needed, currently returning raw Prisma objects
        // Frontend expects specific shape, we might need to map it or update Frontend types.
        // For now, return DB shape.
        res.json(cars);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cars' });
    }
});

app.get('/api/cars/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const car = await prisma.car.findUnique({
            where: { id },
            include: { images: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!car) return res.status(404).json({ error: 'Car not found' });
        res.json(car);
    } catch (error) {
        // Try finding by slug if ID fails? ID is UUID, slug isn't in DB yet.
        // We haven't implemented slug. We can assume ID usage.
        res.status(500).json({ error: 'Error fetching car' });
    }
});

// Admin Routes
app.post('/api/cars', requireAuth, async (req, res) => {
    try {
        const { id, createdAt, updatedAt, images, ...rawData } = req.body;

        const priceUsd = parseOptionalInt(rawData.priceUsd) ?? 0;
        const year = parseOptionalInt(rawData.year) ?? 0;

        const data = {
            ...rawData,
            title: toStringOrEmpty(rawData.title) || 'Untitled',
            transmission: toStringOrEmpty(rawData.transmission),
            fuelType: toStringOrEmpty(rawData.fuelType),
            condition: toStringOrEmpty(rawData.condition),
            status: toStringOrEmpty(rawData.status) || 'active',
            tags: toStringOrEmpty(rawData.tags),
            labels: toStringOrEmpty(rawData.labels),
            descriptionMd: toStringOrEmpty(rawData.descriptionMd),
            priceUsd,
            year,
            mileage: parseOptionalInt(rawData.mileage),
            horsepower: parseOptionalInt(rawData.horsepower),
            topSpeed: parseOptionalInt(rawData.topSpeed),
            acceleration: parseOptionalFloat(rawData.acceleration),
        };

        const imageCreateData = images && Array.isArray(images)
            ? images.map((img: any) => ({
                pathOrUrl: img.pathOrUrl,
                isMain: img.isMain || false,
                sortOrder: img.sortOrder || 0
            }))
            : [];

        const car = await prisma.car.create({
            data: {
                ...data,
                images: {
                    create: imageCreateData
                }
            },
            include: { images: true }
        });
        res.json(car);
    } catch (error) {
        console.error("Create error:", error);
        res.status(500).json({ error: 'Failed to create car', details: error });
    }
});

app.put('/api/cars/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { id: _bodyId, createdAt, updatedAt, images, ...rawData } = req.body;

    const priceUsd = rawData.priceUsd === undefined
        ? undefined
        : (isEmptyValue(rawData.priceUsd) ? 0 : parseRequiredInt(rawData.priceUsd));
    const year = rawData.year === undefined
        ? undefined
        : (isEmptyValue(rawData.year) ? 0 : parseRequiredInt(rawData.year));

    if (rawData.priceUsd !== undefined && priceUsd === null) {
        return res.status(400).json({ error: 'Invalid priceUsd' });
    }
    if (rawData.year !== undefined && year === null) {
        return res.status(400).json({ error: 'Invalid year' });
    }

    const data = {
        ...rawData,
        priceUsd,
        year,
        mileage: parseUpdateOptionalInt(rawData.mileage),
        horsepower: parseUpdateOptionalInt(rawData.horsepower),
        topSpeed: parseUpdateOptionalInt(rawData.topSpeed),
        acceleration: parseUpdateOptionalFloat(rawData.acceleration),
    };

    try {
        const result = await prisma.$transaction(async (tx) => {
            const updatedCar = await tx.car.update({
                where: { id },
                data: data
            });

            if (images && Array.isArray(images)) {
                await tx.image.deleteMany({
                    where: { carId: id }
                });

                if (images.length > 0) {
                    await tx.image.createMany({
                        data: images.map((img: any) => ({
                            carId: id,
                            pathOrUrl: img.pathOrUrl,
                            isMain: img.isMain || false,
                            sortOrder: img.sortOrder || 0
                        }))
                    });
                }
            }

            return tx.car.findUnique({
                where: { id },
                include: { images: { orderBy: { sortOrder: 'asc' } } }
            });
        });

        res.json(result);
    } catch (e) {
        console.error("Update error:", e);
        res.status(500).json({ error: "Update failed", details: e });
    }
});

app.delete('/api/cars/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.car.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Delete failed" });
    }
});

app.post('/api/upload/images', requireAuth, upload.array('images'), (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files) return res.status(400).json({ error: 'No files uploaded' });

    const uploadPaths = files.map(f => `/uploads/${f.filename}`);
    res.json({ paths: uploadPaths });
});

// YouTube Videos Proxy
app.get('/api/youtube-videos', async (req, res) => {
    try {
        const CHANNEL_ID = 'UCoMu2BkIcQHKkUy9dr3gNdQ';
        const url = `https://www.youtube.com/channel/${CHANNEL_ID}/videos`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            throw new Error(`YouTube responded with ${response.status}`);
        }

        const html = await response.text();
        
        // Extract ytInitialData
        const match = html.match(/var ytInitialData = ({.*?});/s);
        if (!match || !match[1]) {
            throw new Error('Could not find ytInitialData');
        }

        const data = JSON.parse(match[1]);
        
        // Traverse JSON to find video items
        // Path: contents.twoColumnBrowseResultsRenderer.tabs[1].tabRenderer.content.richGridRenderer.contents
        const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs;
        const videosTab = tabs?.find((t: any) => t.tabRenderer?.title === 'Videos' || t.tabRenderer?.content?.richGridRenderer);
        
        if (!videosTab) {
            throw new Error('Could not find Videos tab');
        }

        const contents = videosTab.tabRenderer.content.richGridRenderer.contents;
        
        const videos = contents
            .filter((item: any) => item.richItemRenderer?.content?.videoRenderer)
            .map((item: any) => {
                const video = item.richItemRenderer.content.videoRenderer;
                return {
                    id: video.videoId,
                    title: video.title?.runs?.[0]?.text,
                    thumbnail: video.thumbnail?.thumbnails?.[video.thumbnail.thumbnails.length - 1]?.url, // High res
                    date: video.publishedTimeText?.simpleText || 'Recently',
                    viewCount: video.viewCountText?.simpleText,
                    length: video.lengthText?.simpleText
                };
            })
            // Extra filter for Shorts just in case (though /videos tab usually excludes them)
            .filter((v: any) => v.id && v.title); 

        // Return top 20 videos
        res.json(videos.slice(0, 20));

    } catch (error) {
        console.error('YouTube fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

// Translations
const localesPath = path.join(__dirname, '../src/locales');

app.get('/api/translations/:lang', requireAuth, (req, res) => {
    const { lang } = req.params;
    if (!['en', 'ru'].includes(lang)) {
        return res.status(400).json({ error: 'Invalid language' });
    }
    const filePath = path.join(localesPath, `${lang}.json`);
    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Translation file not found' });
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(content));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read translation file' });
    }
});

app.post('/api/translations/:lang', requireAuth, (req, res) => {
    const { lang } = req.params;
    const content = req.body;
    
    if (!['en', 'ru'].includes(lang)) {
        return res.status(400).json({ error: 'Invalid language' });
    }
    
    const filePath = path.join(localesPath, `${lang}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save translation file' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`[antispam] captcha mode: ${resolveCaptchaMode()}`);
    if (!process.env.JWT_SECRET) {
        console.warn('[antispam] JWT_SECRET is not set — using an insecure default. Add JWT_SECRET to .env');
    }
});
