/**
 * Anti-spam / captcha layer for the public contact forms.
 *
 * Layers (all applied to POST /api/contact):
 *  1. Signed, single-use challenge token issued by GET /api/contact/challenge
 *     (bots that POST straight to the API never have one; min/max age enforced).
 *  2. Captcha: Cloudflare Turnstile when keys are configured, otherwise a
 *     built-in image captcha (svg-captcha) whose answer is bound to the token.
 *  3. Honeypot field ("website") that real users never see.
 *  4. Origin / Referer check against the allowed site hosts.
 *  5. Per-IP + global rate limits (express-rate-limit; nginx adds another layer).
 *  6. Content heuristics with a spam score: high score => silently dropped,
 *     medium score => forwarded to Telegram with a warning, low => normal.
 *  7. Duplicate suppression (same payload within 24h).
 *  8. JSON-lines audit log in server/logs/contact.jsonl for tuning.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type express from 'express';
import { rateLimit } from 'express-rate-limit';
import svgCaptcha from 'svg-captcha';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const CHALLENGE_MIN_AGE_MS = 3 * 1000;        // humans need > 3s to fill a form
export const CHALLENGE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // page can stay open ~2h
export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SCORE_WARN = 3;   // >= => forward with ⚠️ warning
export const SCORE_DROP = 6;   // >= => silently drop

const DEFAULT_ALLOWED_HOSTS = ['masynbazar.com', 'www.masynbazar.com'];

const getSecret = () => process.env.JWT_SECRET || 'default-secret-key-change-this';

const isProduction = () => process.env.NODE_ENV === 'production';

export const allowedHosts = (): string[] => {
    const fromEnv = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
        .map(s => s.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
    const hosts = new Set<string>([...DEFAULT_ALLOWED_HOSTS, ...fromEnv]);
    if (!isProduction()) {
        hosts.add('localhost');
        hosts.add('127.0.0.1');
    }
    return [...hosts];
};

const hostMatches = (hostWithPort: string): boolean => {
    const host = hostWithPort.toLowerCase().replace(/:\d+$/, '');
    return allowedHosts().includes(host);
};

export const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) return false;
    try {
        const u = new URL(origin);
        return hostMatches(u.host);
    } catch {
        return false;
    }
};

export type ResolvedCaptchaMode = 'builtin' | 'turnstile' | 'off';

/** CAPTCHA_MODE=auto|builtin|turnstile|off (auto => turnstile if keys present, else builtin). */
export const resolveCaptchaMode = (): ResolvedCaptchaMode => {
    const mode = (process.env.CAPTCHA_MODE || 'auto').trim().toLowerCase();
    const hasTurnstile = !!(process.env.TURNSTILE_SITE_KEY?.trim() && process.env.TURNSTILE_SECRET_KEY?.trim());
    if (mode === 'off') return 'off';
    if (mode === 'builtin') return 'builtin';
    if (mode === 'turnstile') return hasTurnstile ? 'turnstile' : 'builtin';
    return hasTurnstile ? 'turnstile' : 'builtin';
};

// ---------------------------------------------------------------------------
// Signed challenge tokens
// ---------------------------------------------------------------------------

interface ChallengePayload {
    n: string;          // nonce
    iat: number;        // issued at (ms)
    c: string | null;   // HMAC of captcha answer (builtin) or null
    m: ResolvedCaptchaMode;
}

const b64url = (buf: Buffer) => buf.toString('base64url');

const sign = (data: string) => crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');

const answerHash = (nonce: string, answer: string) =>
    crypto.createHmac('sha256', getSecret()).update(`captcha:${nonce}:${answer.trim().toLowerCase()}`).digest('base64url');

const encodeToken = (payload: ChallengePayload): string => {
    const data = b64url(Buffer.from(JSON.stringify(payload)));
    return `${data}.${sign(data)}`;
};

const decodeToken = (token: unknown): ChallengePayload | null => {
    if (typeof token !== 'string' || token.length > 2048) return null;
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    const expected = sign(data);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as ChallengePayload;
        if (!payload || typeof payload.n !== 'string' || typeof payload.iat !== 'number') return null;
        return payload;
    } catch {
        return null;
    }
};

// Single-use nonce registry (in-memory; server restarts simply invalidate nothing
// dangerous because tokens also carry a max age).
const usedNonces = new Map<string, number>();
const MAX_NONCES = 100_000;

const purgeNonces = () => {
    const now = Date.now();
    for (const [nonce, exp] of usedNonces) {
        if (exp <= now) usedNonces.delete(nonce);
    }
};
setInterval(purgeNonces, 10 * 60 * 1000).unref();

const consumeNonce = (nonce: string, iat: number): boolean => {
    if (usedNonces.has(nonce)) return false;
    if (usedNonces.size >= MAX_NONCES) purgeNonces();
    usedNonces.set(nonce, iat + CHALLENGE_MAX_AGE_MS);
    return true;
};

export interface ChallengeResponse {
    token: string;
    minDelayMs: number;
    captcha:
        | { type: 'turnstile'; siteKey: string }
        | { type: 'image'; svg: string }
        | { type: 'none' };
}

export const createChallenge = (): ChallengeResponse => {
    const mode = resolveCaptchaMode();
    const nonce = crypto.randomBytes(16).toString('hex');
    const iat = Date.now();

    if (mode === 'builtin') {
        const captcha = svgCaptcha.create({
            size: 5,
            noise: 3,
            ignoreChars: '0oO1ilIjJ',
            color: true,
            background: '#f4f4f5',
            width: 170,
            height: 56,
            fontSize: 46,
        });
        return {
            token: encodeToken({ n: nonce, iat, c: answerHash(nonce, captcha.text), m: mode }),
            minDelayMs: CHALLENGE_MIN_AGE_MS,
            captcha: { type: 'image', svg: captcha.data },
        };
    }

    if (mode === 'turnstile') {
        return {
            token: encodeToken({ n: nonce, iat, c: null, m: mode }),
            minDelayMs: CHALLENGE_MIN_AGE_MS,
            captcha: { type: 'turnstile', siteKey: process.env.TURNSTILE_SITE_KEY!.trim() },
        };
    }

    return {
        token: encodeToken({ n: nonce, iat, c: null, m: mode }),
        minDelayMs: CHALLENGE_MIN_AGE_MS,
        captcha: { type: 'none' },
    };
};

// ---------------------------------------------------------------------------
// Turnstile verification
// ---------------------------------------------------------------------------

export type TurnstileResult = 'ok' | 'failed' | 'unavailable';

export const verifyTurnstile = async (responseToken: unknown, remoteIp: string | undefined): Promise<TurnstileResult> => {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) return 'unavailable';
    if (typeof responseToken !== 'string' || !responseToken || responseToken.length > 4096) return 'failed';

    const body = new URLSearchParams({ secret, response: responseToken });
    if (remoteIp) body.set('remoteip', remoteIp);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
            signal: controller.signal,
        });
        if (!res.ok) return 'unavailable';
        const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
        if (data.success) return 'ok';
        const codes = data['error-codes'] || [];
        // Server-side misconfiguration or CF trouble => unavailable, everything else => failed
        if (codes.some(c => ['invalid-input-secret', 'missing-input-secret', 'internal-error'].includes(c))) {
            console.error('Turnstile verification error codes:', codes);
            return 'unavailable';
        }
        return 'failed';
    } catch (err) {
        console.error('Turnstile verification request failed:', err);
        return 'unavailable';
    } finally {
        clearTimeout(timer);
    }
};

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const isLoopback = (ip: string | undefined) =>
    !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

let warnedAboutProxy = false;
const warnProxyOnce = () => {
    if (warnedAboutProxy) return;
    warnedAboutProxy = true;
    console.warn('[antispam] Client IP resolves to loopback — is nginx sending X-Forwarded-For? Per-IP limits are skipped until it does.');
};

const limiterHandler = (req: express.Request, res: express.Response) => {
    res.status(429).json({ error: 'too_many_requests', message: 'Too many requests, please try again later.' });
};

/** Per-IP: 8 submissions / 15 min (failed attempts count too). Skipped when the IP is unknown (misconfigured proxy). */
export const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limiterHandler,
    skip: (req) => {
        if (isLoopback(req.ip)) { warnProxyOnce(); return true; }
        return false;
    },
});

/** Global safety valve: 80 accepted submissions / hour across all IPs (rejected requests do not count). */
export const contactGlobalLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 80,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipFailedRequests: true,
    keyGenerator: () => 'global',
    handler: limiterHandler,
    validate: { keyGeneratorIpFallback: false },
});

/** Challenge issuing: 30 / min per IP (page loads + captcha refreshes). */
export const challengeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limiterHandler,
    skip: (req) => isLoopback(req.ip),
});

/** Admin login brute-force protection: 10 attempts / 15 min per IP. */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limiterHandler,
    skip: (req) => isLoopback(req.ip),
});

// ---------------------------------------------------------------------------
// Content heuristics
// ---------------------------------------------------------------------------

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|ru|io|xyz|top|site|online|shop|club|info|biz|me|link|pro|tk|ga|ml|cf|gq|cc|su|рф)\b)/gi;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
const TG_HANDLE_RE = /(^|\s)@[a-z0-9_]{4,}/i;

const SPAM_KEYWORDS = [
    // English
    'seo', 'backlink', 'guest post', 'link building', 'domain authority', 'traffic boost',
    'crypto', 'bitcoin', 'btc', 'usdt', 'forex', 'binary option', 'investment opportunity', 'passive income',
    'casino', 'betting', 'porn', 'sex', 'escort', 'viagra', 'cialis',
    'earn money', 'make money', 'work from home', 'loan approval', 'credit score',
    'web design services', 'app development services', 'lead generation', 'cold email',
    'unsubscribe', 'click here', 'limited offer', 'ai bots for your business',
    // Russian
    'бэклинк', 'продвижение сайта', 'раскрутка сайта', 'ссылочная масса', 'рассылка',
    'заработок', 'пассивный доход', 'инвестиц', 'криптовалют', 'биткоин',
    'казино', 'ставки', 'порно', 'секс', 'эскорт',
    'кредит без', 'займ', 'микрозайм',
    'разработка сайтов', 'создание сайтов', 'холодные звонки', 'база клиентов',
];

const KNOWN_BOT_UA = /(python-requests|python-urllib|go-http-client|curl\/|wget\/|libwww|httpclient|okhttp|java\/|node-fetch|undici|axios\/|scrapy|phantomjs|headlesschrome|selenium|puppeteer|playwright)/i;

export interface SpamAssessment {
    score: number;
    reasons: string[];
}

const countMatches = (s: string, re: RegExp) => (s.match(re) || []).length;

const looksLikeGibberish = (s: string): boolean => {
    const word = s.replace(/[^a-z]/gi, '');
    if (word.length < 7) return false;
    const upper = (word.match(/[A-Z]/g) || []).length;
    const lower = word.length - upper;
    // Random-case tokens like "XqTjWnBvLk" or all-consonant runs
    const mixedRatio = Math.min(upper, lower) / word.length;
    const hasVowel = /[aeiouy]/i.test(word);
    return mixedRatio > 0.3 || !hasVowel;
};

export const assessContent = (input: {
    name: string;
    contact: string;
    message: string;
    userAgent: string | undefined;
    origin: string | undefined;
    referer: string | undefined;
}): SpamAssessment => {
    const reasons: string[] = [];
    let score = 0;
    const add = (points: number, reason: string) => { score += points; reasons.push(`${reason}(+${points})`); };

    const name = input.name.trim();
    const contact = input.contact.trim();
    const message = input.message.trim();
    const all = `${name}\n${contact}\n${message}`;
    const lower = all.toLowerCase();

    // User-Agent sanity
    const ua = (input.userAgent || '').trim();
    if (!ua) add(4, 'no_user_agent');
    else if (ua.includes('"') || ua.includes('\\')) add(4, 'quoted_user_agent');
    else if (KNOWN_BOT_UA.test(ua)) add(4, 'bot_user_agent');
    else if (ua.length < 20) add(2, 'short_user_agent');

    // Origin / Referer presence (mismatches are rejected earlier)
    if (!input.origin && !input.referer) add(3, 'no_origin_no_referer');
    else if (input.origin === 'null') add(2, 'null_origin');

    // Links
    const urlsInMessage = countMatches(message, URL_RE);
    if (urlsInMessage >= 2) add(4, 'many_urls');
    else if (urlsInMessage === 1) add(2, 'url_in_message');
    if (URL_RE.test(name)) add(4, 'url_in_name');
    if (/https?:\/\//i.test(contact)) add(3, 'url_in_contact');
    if (/<\s*a\s|<\s*script|\[url[=\]]|\[link[=\]]/i.test(all)) add(4, 'markup_links');

    // Keywords
    let keywordHits = 0;
    for (const kw of SPAM_KEYWORDS) {
        if (lower.includes(kw)) keywordHits++;
    }
    if (keywordHits > 0) add(Math.min(4, keywordHits * 2), `spam_keywords:${keywordHits}`);

    // Name sanity
    if (/\d/.test(name)) add(1, 'digits_in_name');
    if (looksLikeGibberish(name)) add(2, 'gibberish_name');
    if (name.length > 40 && !name.includes(' ')) add(1, 'long_single_word_name');

    // Contact sanity: real people leave a phone, email or @handle
    const digits = (contact.match(/\d/g) || []).length;
    const hasEmail = EMAIL_RE.test(contact);
    const hasHandle = TG_HANDLE_RE.test(contact) || /t\.me\//i.test(contact);
    if (digits < 7 && !hasEmail && !hasHandle) add(2, 'contact_not_reachable');
    if (looksLikeGibberish(contact) && !hasEmail) add(1, 'gibberish_contact');

    // Message sanity
    if (message && message === name) add(1, 'message_equals_name');
    if (message.length > 0) {
        const letters = (message.match(/[\p{L}]/gu) || []).length;
        if (message.length > 30 && letters / message.length < 0.5) add(1, 'low_letter_ratio');
        if (looksLikeGibberish(message) && message.length < 40) add(1, 'gibberish_message');
    }
    if (/(.)\1{7,}/.test(all)) add(1, 'repeated_chars');

    return { score, reasons };
};

// ---------------------------------------------------------------------------
// Duplicate suppression
// ---------------------------------------------------------------------------

const recentHashes = new Map<string, number>();

const purgeHashes = () => {
    const now = Date.now();
    for (const [h, exp] of recentHashes) {
        if (exp <= now) recentHashes.delete(h);
    }
};
setInterval(purgeHashes, 30 * 60 * 1000).unref();

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Returns true if the same submission was already seen within the window (and records it). */
export const isDuplicate = (name: string, contact: string, message: string): boolean => {
    const key = crypto.createHash('sha256')
        .update(`${normalise(name)}|${normalise(contact)}|${normalise(message)}`)
        .digest('hex');
    const now = Date.now();
    const exp = recentHashes.get(key);
    if (exp && exp > now) return true;
    if (recentHashes.size > 50_000) purgeHashes();
    recentHashes.set(key, now + DUPLICATE_WINDOW_MS);
    return false;
};

// ---------------------------------------------------------------------------
// Challenge validation for a submission
// ---------------------------------------------------------------------------

export type ChallengeCheck =
    | { ok: true; mode: ResolvedCaptchaMode }
    | { ok: false; code: 'challenge_missing' | 'challenge_invalid' | 'challenge_expired' | 'challenge_too_fast' | 'challenge_used' | 'captcha_required' | 'captcha_failed' | 'captcha_unavailable' };

export const validateChallenge = async (body: any, remoteIp: string | undefined): Promise<ChallengeCheck> => {
    const token = body?.challengeToken;
    if (!token) return { ok: false, code: 'challenge_missing' };

    const payload = decodeToken(token);
    if (!payload) return { ok: false, code: 'challenge_invalid' };

    const age = Date.now() - payload.iat;
    if (age > CHALLENGE_MAX_AGE_MS || age < -60_000) return { ok: false, code: 'challenge_expired' };
    if (age < CHALLENGE_MIN_AGE_MS) return { ok: false, code: 'challenge_too_fast' };

    // Consume before verifying the captcha so a token cannot be used to brute-force answers.
    if (!consumeNonce(payload.n, payload.iat)) return { ok: false, code: 'challenge_used' };

    const currentMode = resolveCaptchaMode();

    if (payload.m === 'builtin') {
        if (!payload.c) return { ok: false, code: 'challenge_invalid' };
        const answer = typeof body?.captchaAnswer === 'string' ? body.captchaAnswer : '';
        if (!answer.trim()) return { ok: false, code: 'captcha_required' };
        const expected = Buffer.from(payload.c);
        const actual = Buffer.from(answerHash(payload.n, answer));
        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
            return { ok: false, code: 'captcha_failed' };
        }
        return { ok: true, mode: 'builtin' };
    }

    if (payload.m === 'turnstile') {
        if (currentMode !== 'turnstile') {
            // Keys were removed after the token was issued; require a fresh challenge.
            return { ok: false, code: 'challenge_expired' };
        }
        const result = await verifyTurnstile(body?.turnstileToken, remoteIp);
        if (result === 'ok') return { ok: true, mode: 'turnstile' };
        if (result === 'unavailable') return { ok: false, code: 'captcha_unavailable' };
        return { ok: false, code: 'captcha_failed' };
    }

    // mode 'off': only accept if captcha is still off, otherwise force a fresh challenge
    if (currentMode !== 'off') return { ok: false, code: 'challenge_expired' };
    return { ok: true, mode: 'off' };
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'contact.jsonl');

export const logContactEvent = (event: Record<string, unknown>) => {
    try {
        if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
        fs.appendFile(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n', () => { /* best effort */ });
    } catch (err) {
        console.error('Failed to write contact log:', err);
    }
};

// ---------------------------------------------------------------------------
// Helpers for the route
// ---------------------------------------------------------------------------

export const clientIp = (req: express.Request): string | undefined => {
    const ip = req.ip;
    if (!ip) return undefined;
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};

/** Escape user text for Telegram HTML parse mode. */
export const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

/** Internals exposed for automated tests only. */
export const _internals = { encodeToken, answerHash };
