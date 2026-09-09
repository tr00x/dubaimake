/**
 * YouTube channel feed without API keys.
 *
 * Sources (all public, no credentials):
 *  1. Channel "Videos" tab HTML  -> long-form videos with duration, view count, relative date
 *  2. Channel "Shorts" tab HTML  -> shorts with view count
 *  3. Channel RSS feed           -> exact publish dates and view counts for the latest 15 uploads
 *
 * The tabs are behind an EU consent interstitial (HTTP 302) unless the SOCS
 * cookie is sent. The page markup changes often, so parsing is done by walking
 * the ytInitialData JSON generically rather than by fixed paths.
 *
 * Results are cached in memory and on disk (server/cache/youtube.json) and
 * refreshed in the background, so the site always has something to show even
 * when YouTube is slow or unreachable.
 */
import fs from 'fs';
import path from 'path';

export const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCoMu2BkIcQHKkUy9dr3gNdQ';
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'youtube.json');
const FRESH_MS = 20 * 60 * 1000;          // serve without refreshing
const REFRESH_EVERY_MS = 30 * 60 * 1000;  // background refresh
const FETCH_TIMEOUT_MS = 15_000;

const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface YtVideo {
    id: string;
    title: string;
    thumbnail: string;
    /** "20:37" */
    duration?: string;
    durationSec?: number;
    views?: number;
    viewsText?: string;
    /** ISO date (exact from RSS, approximate from "2 weeks ago") */
    publishedAt?: string;
    publishedText?: string;
    /** Animated hover preview (webp) when YouTube provides one */
    preview?: string;
    url: string;
}

export interface YtShort {
    id: string;
    title: string;
    thumbnail: string;
    views?: number;
    viewsText?: string;
    publishedAt?: string;
    url: string;
}

export interface YtChannel {
    id: string;
    title: string;
    handle?: string;
    avatar?: string;
    subscribers?: number;
    subscribersText?: string;
    videoCountText?: string;
    url: string;
}

export interface YtFeed {
    channel: YtChannel;
    videos: YtVideo[];
    shorts: YtShort[];
    updatedAt: string;
    sources: string[];
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const ytFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: {
                'User-Agent': UA,
                'Accept-Language': 'en-US,en;q=0.9',
                // Bypass the EU consent interstitial (otherwise YouTube answers 302).
                Cookie: 'SOCS=CAI; CONSENT=YES+cb',
                ...(init.headers || {}),
            },
        });
    } finally {
        clearTimeout(timer);
    }
};

const fetchText = async (url: string): Promise<string> => {
    const res = await ytFetch(url);
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return res.text();
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const extractInitialData = (html: string): any => {
    const m = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData"?\]?\s*=\s*({.*?});\s*<\/script>/s);
    if (!m) throw new Error('ytInitialData not found');
    return JSON.parse(m[1]);
};

/** Depth-first walk collecting every object stored under `key`. */
const collect = (node: any, key: string, out: any[] = [], depth = 0): any[] => {
    if (!node || typeof node !== 'object' || depth > 60) return out;
    if (Array.isArray(node)) {
        for (const n of node) collect(n, key, out, depth + 1);
        return out;
    }
    for (const [k, v] of Object.entries(node)) {
        if (k === key && v && typeof v === 'object') out.push(v);
        collect(v, key, out, depth + 1);
    }
    return out;
};

/** All string values found under any `content` / `simpleText` / `text` key in a subtree. */
const collectStrings = (node: any, out: string[] = [], depth = 0): string[] => {
    if (!node || typeof node !== 'object' || depth > 40) return out;
    if (Array.isArray(node)) {
        for (const n of node) collectStrings(n, out, depth + 1);
        return out;
    }
    for (const [k, v] of Object.entries(node)) {
        if ((k === 'content' || k === 'simpleText' || k === 'text') && typeof v === 'string') out.push(v);
        else if (k === 'runs' && Array.isArray(v)) out.push(v.map((r: any) => r?.text || '').join(''));
        else collectStrings(v, out, depth + 1);
    }
    return out;
};

const parseCompactNumber = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const m = s.replace(/,/g, '').match(/([\d.]+)\s*([KMB]|thousand|million|billion)?/i);
    if (!m) return undefined;
    let n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return undefined;
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'k' || unit === 'thousand') n *= 1e3;
    else if (unit === 'm' || unit === 'million') n *= 1e6;
    else if (unit === 'b' || unit === 'billion') n *= 1e9;
    return Math.round(n);
};

const parseDuration = (s: string | undefined): number | undefined => {
    if (!s || !/^\d+(:\d\d)+$/.test(s)) return undefined;
    return s.split(':').reduce((acc, part) => acc * 60 + parseInt(part, 10), 0);
};

const UNIT_MS: Record<string, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_629_800_000,
    year: 31_557_600_000,
};

/** "Streamed 2 weeks ago" / "3 days ago" -> approximate ISO date. */
const parseRelativeDate = (s: string | undefined): string | undefined => {
    if (!s) return undefined;
    const m = s.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
    if (!m) return undefined;
    const ms = parseInt(m[1], 10) * (UNIT_MS[m[2].toLowerCase()] || 0);
    return new Date(Date.now() - ms).toISOString();
};

const bestThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hq720.jpg`;

// ---------------------------------------------------------------------------
// Scrapers
// ---------------------------------------------------------------------------

const parseChannel = (data: any): YtChannel => {
    const channel: YtChannel = { id: CHANNEL_ID, title: 'Mashyn Bazar', url: CHANNEL_URL };
    try {
        const header = data?.header?.pageHeaderRenderer;
        const vm = header?.content?.pageHeaderViewModel;
        channel.title = header?.pageTitle || vm?.title?.dynamicTextViewModel?.text?.content || channel.title;
        const avatars = collect(vm?.image, 'sources').flat();
        const avatar = avatars.filter((s: any) => typeof s?.url === 'string').sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
        if (avatar?.url) channel.avatar = avatar.url;
        const parts = collectStrings(vm?.metadata);
        for (const p of parts) {
            if (/^@/.test(p)) channel.handle = p;
            else if (/subscriber/i.test(p)) {
                channel.subscribersText = p;
                channel.subscribers = parseCompactNumber(p);
            } else if (/video/i.test(p)) channel.videoCountText = p;
        }
        // Metadata fallback: microformat / metadata renderer
        const meta = data?.metadata?.channelMetadataRenderer;
        if (meta?.title && !header) channel.title = meta.title;
        if (!channel.avatar && meta?.avatar?.thumbnails?.length) channel.avatar = meta.avatar.thumbnails[meta.avatar.thumbnails.length - 1].url;
    } catch {
        /* keep defaults */
    }
    return channel;
};

const scrapeVideosTab = async (): Promise<{ videos: YtVideo[]; channel: YtChannel }> => {
    const html = await fetchText(`${CHANNEL_URL}/videos`);
    const data = extractInitialData(html);
    const channel = parseChannel(data);

    const videos: YtVideo[] = [];
    const seen = new Set<string>();

    // 2025+ layout
    for (const vm of collect(data, 'lockupViewModel')) {
        const id: string | undefined = vm.contentId || collect(vm, 'thumbnailBadgeViewModel')[0]?.animationActivationTargetId;
        if (!id || !/^[\w-]{11}$/.test(id) || seen.has(id)) continue;
        const meta = vm.metadata?.lockupMetadataViewModel;
        const title: string = meta?.title?.content || collectStrings(meta?.title)[0] || '';
        if (!title) continue;
        const badgeText = collect(vm, 'thumbnailBadgeViewModel').map((b: any) => b?.text).find((t: any) => typeof t === 'string' && /^\d+(:\d\d)+$/.test(t));
        const rows = collectStrings(meta?.metadata);
        const viewsText = rows.find((r) => /view/i.test(r));
        const publishedText = rows.find((r) => /ago$/i.test(r) || /^Streamed/i.test(r) || /^Premiere/i.test(r));
        const preview: string | undefined = collect(vm, 'animatedThumbnailOverlayViewModel')[0]?.thumbnail?.sources?.[0]?.url;
        seen.add(id);
        videos.push({
            id,
            title,
            thumbnail: bestThumb(id),
            duration: badgeText,
            durationSec: parseDuration(badgeText),
            views: parseCompactNumber(viewsText),
            viewsText,
            publishedAt: parseRelativeDate(publishedText),
            publishedText,
            preview: preview && preview.startsWith('https://') ? preview : undefined,
            url: `https://www.youtube.com/watch?v=${id}`,
        });
    }

    // Older layout (kept for resilience)
    if (videos.length === 0) {
        for (const vr of collect(data, 'videoRenderer')) {
            const id = vr.videoId;
            if (!id || seen.has(id)) continue;
            const title = collectStrings(vr.title)[0];
            if (!title) continue;
            const badgeText = collectStrings(vr.lengthText)[0];
            const viewsText = collectStrings(vr.viewCountText)[0];
            const publishedText = collectStrings(vr.publishedTimeText)[0];
            seen.add(id);
            videos.push({
                id,
                title,
                thumbnail: bestThumb(id),
                duration: badgeText,
                durationSec: parseDuration(badgeText),
                views: parseCompactNumber(viewsText),
                viewsText,
                publishedAt: parseRelativeDate(publishedText),
                publishedText,
                url: `https://www.youtube.com/watch?v=${id}`,
            });
        }
    }

    if (videos.length === 0) throw new Error('videos tab: no items parsed');
    return { videos, channel };
};

const scrapeShortsTab = async (): Promise<YtShort[]> => {
    const html = await fetchText(`${CHANNEL_URL}/shorts`);
    const data = extractInitialData(html);
    const shorts: YtShort[] = [];
    const seen = new Set<string>();

    for (const vm of collect(data, 'shortsLockupViewModel')) {
        const id: string | undefined = vm?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId || collect(vm, 'reelWatchEndpoint')[0]?.videoId;
        if (!id || seen.has(id)) continue;
        const primary = vm?.overlayMetadata?.primaryText?.content;
        const secondary = vm?.overlayMetadata?.secondaryText?.content;
        const acc: string | undefined = vm?.accessibilityText;
        // accessibilityText: "TITLE, 3.8 thousand views - play Short"
        const accTitle = acc ? acc.replace(/,\s*[\d.,]+\s*(thousand|million|billion|K|M)?\s*views?\s*-\s*play Short$/i, '').trim() : '';
        const title = primary || accTitle;
        if (!title) continue;
        const viewsText = secondary || acc?.match(/([\d.,]+\s*(?:thousand|million|billion|K|M)?\s*views?)/i)?.[1];
        seen.add(id);
        shorts.push({
            id,
            title,
            thumbnail: `https://i.ytimg.com/vi/${id}/oardefault.jpg`,
            views: parseCompactNumber(viewsText),
            viewsText,
            url: `https://www.youtube.com/shorts/${id}`,
        });
    }
    // Older layout
    if (shorts.length === 0) {
        for (const r of collect(data, 'reelItemRenderer')) {
            const id = r.videoId;
            if (!id || seen.has(id)) continue;
            const title = collectStrings(r.headline)[0];
            if (!title) continue;
            const viewsText = collectStrings(r.viewCountText)[0];
            seen.add(id);
            shorts.push({ id, title, thumbnail: `https://i.ytimg.com/vi/${id}/oardefault.jpg`, views: parseCompactNumber(viewsText), viewsText, url: `https://www.youtube.com/shorts/${id}` });
        }
    }
    if (shorts.length === 0) throw new Error('shorts tab: no items parsed');
    return shorts;
};

interface RssEntry {
    id: string;
    title: string;
    publishedAt: string;
    views?: number;
}

const decodeXml = (s: string) =>
    s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");

const fetchRss = async (): Promise<RssEntry[]> => {
    const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
    const entries: RssEntry[] = [];
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const e = m[1];
        const id = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
        const title = e.match(/<title>([^<]*)<\/title>/)?.[1];
        const published = e.match(/<published>([^<]+)<\/published>/)?.[1];
        const views = e.match(/<media:statistics views="(\d+)"/)?.[1];
        if (id && title && published) {
            entries.push({ id, title: decodeXml(title), publishedAt: new Date(published).toISOString(), views: views ? parseInt(views, 10) : undefined });
        }
    }
    if (entries.length === 0) throw new Error('rss: no entries');
    return entries;
};

// Shorts detection by redirect: /shorts/<id> is 200 for a short and 303 for a regular video.
const shortsCheckCache = new Map<string, boolean>();
const isShortById = async (id: string): Promise<boolean> => {
    if (shortsCheckCache.has(id)) return shortsCheckCache.get(id)!;
    try {
        const res = await ytFetch(`https://www.youtube.com/shorts/${id}`, { method: 'HEAD', redirect: 'manual' });
        const short = res.status === 200;
        shortsCheckCache.set(id, short);
        return short;
    } catch {
        return false;
    }
};

// ---------------------------------------------------------------------------
// Feed assembly + cache
// ---------------------------------------------------------------------------

let feed: YtFeed | null = null;
let refreshing: Promise<YtFeed | null> | null = null;

const loadFromDisk = () => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as YtFeed;
            if (parsed && Array.isArray(parsed.videos)) feed = parsed;
        }
    } catch (err) {
        console.error('[youtube] failed to read cache:', err);
    }
};

const saveToDisk = (data: YtFeed) => {
    try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
    } catch (err) {
        console.error('[youtube] failed to write cache:', err);
    }
};

// Ops knob: YOUTUBE_DISABLE_SCRAPE=1 skips the HTML tabs and builds the feed from RSS only
// (dates, views, shorts detection via redirect). Also exercised by tests as the failure path.
const scrapeDisabled = () => process.env.YOUTUBE_DISABLE_SCRAPE === '1';

const buildFeed = async (): Promise<YtFeed> => {
    const disabled = scrapeDisabled();
    const skip = () => Promise.reject(new Error('scraping disabled'));
    const [videosRes, shortsRes, rssRes] = await Promise.allSettled([
        disabled ? skip() : scrapeVideosTab(),
        disabled ? skip() : scrapeShortsTab(),
        fetchRss(),
    ]);
    const sources: string[] = [];

    const rss = rssRes.status === 'fulfilled' ? rssRes.value : [];
    if (rss.length) sources.push('rss');
    const rssById = new Map(rss.map((e) => [e.id, e]));

    let channel: YtChannel = feed?.channel || { id: CHANNEL_ID, title: 'Mashyn Bazar', url: CHANNEL_URL };
    let videos: YtVideo[] = [];
    let shorts: YtShort[] = [];

    if (shortsRes.status === 'fulfilled') {
        shorts = shortsRes.value;
        sources.push('shorts');
    } else {
        console.warn('[youtube] shorts tab failed:', (shortsRes.reason as Error)?.message);
    }
    const shortIds = new Set(shorts.map((s) => s.id));

    if (videosRes.status === 'fulfilled') {
        videos = videosRes.value.videos.filter((v) => !shortIds.has(v.id));
        channel = videosRes.value.channel;
        sources.push('videos');
    } else {
        console.warn('[youtube] videos tab failed:', (videosRes.reason as Error)?.message);
        // Fallback: new uploads from RSS (minus shorts) in front of whatever we showed last time,
        // so a markup change on YouTube never empties the block and new videos still appear.
        const candidates = rss.filter((e) => !shortIds.has(e.id));
        const flags = await Promise.all(candidates.map((e) => (shortsRes.status === 'fulfilled' ? Promise.resolve(false) : isShortById(e.id))));
        const fromRss: YtVideo[] = candidates
            .filter((_, i) => !flags[i])
            .map((e) => ({ id: e.id, title: e.title, thumbnail: bestThumb(e.id), views: e.views, publishedAt: e.publishedAt, url: `https://www.youtube.com/watch?v=${e.id}` }));
        const known = new Set(fromRss.map((v) => v.id));
        videos = [...fromRss, ...(feed?.videos || []).filter((v) => !known.has(v.id))];
        if (shortsRes.status !== 'fulfilled') {
            const rssShorts: YtShort[] = candidates
                .filter((_, i) => flags[i])
                .map((e) => ({ id: e.id, title: e.title, thumbnail: `https://i.ytimg.com/vi/${e.id}/oardefault.jpg`, views: e.views, publishedAt: e.publishedAt, url: `https://www.youtube.com/shorts/${e.id}` }));
            const knownShorts = new Set(rssShorts.map((s) => s.id));
            shorts = [...rssShorts, ...(feed?.shorts || []).filter((s) => !knownShorts.has(s.id))];
        }
    }

    // Enrich with exact RSS data where available
    for (const v of videos) {
        const e = rssById.get(v.id);
        if (e) {
            v.publishedAt = e.publishedAt;
            if (e.views !== undefined) v.views = e.views;
            if (!v.title) v.title = e.title;
        }
    }
    for (const s of shorts) {
        const e = rssById.get(s.id);
        if (e) {
            s.publishedAt = e.publishedAt;
            if (e.views !== undefined) s.views = e.views;
        }
    }

    if (videos.length === 0 && shorts.length === 0) throw new Error('no data from any source');

    // Keep the tab order (newest first); approximate dates from "N months ago" are too coarse to sort by.

    return { channel, videos: videos.slice(0, 24), shorts: shorts.slice(0, 24), updatedAt: new Date().toISOString(), sources };
};

export const refreshFeed = (): Promise<YtFeed | null> => {
    if (refreshing) return refreshing;
    refreshing = buildFeed()
        .then((data) => {
            feed = data;
            saveToDisk(data);
            console.log(`[youtube] feed updated: ${data.videos.length} videos, ${data.shorts.length} shorts (${data.sources.join('+')})`);
            return data;
        })
        .catch((err) => {
            console.error('[youtube] refresh failed:', err?.message || err);
            return feed; // keep serving stale data
        })
        .finally(() => {
            refreshing = null;
        });
    return refreshing;
};

const isFresh = () => !!feed && Date.now() - new Date(feed.updatedAt).getTime() < FRESH_MS;

/** Returns cached data immediately (refreshing in the background if stale) or waits for the first load. */
let lastStaleWarning = 0;
export const getFeed = async (): Promise<YtFeed | null> => {
    if (feed) {
        if (!isFresh()) void refreshFeed();
        const age = Date.now() - new Date(feed.updatedAt).getTime();
        if (age > 6 * 60 * 60 * 1000 && Date.now() - lastStaleWarning > 60 * 60 * 1000) {
            lastStaleWarning = Date.now();
            console.warn(`[youtube] feed is stale (${Math.round(age / 3.6e6)}h old) — every refresh has been failing`);
        }
        return feed;
    }
    return refreshFeed();
};

export const startYoutubeFeed = () => {
    loadFromDisk();
    void refreshFeed();
    setInterval(() => void refreshFeed(), REFRESH_EVERY_MS).unref();
};
