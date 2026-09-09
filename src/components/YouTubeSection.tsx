import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Play, ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoIcon } from "./ui/Icons";
import { useTranslation } from "react-i18next";
import { Reveal, Stagger, Item, EASE } from "./motion/Reveal";

/**
 * YouTube block: latest long-form video with an inline player, a list of the
 * next uploads, and a Shorts rail. Data comes from /api/youtube (server-side
 * scrape + RSS, no API keys), cached briefly in localStorage for instant paint.
 */

// YouTube glyph, used only as a small accent next to the eyebrow label.
function YouTubeIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white" />
    </svg>
  );
}

interface YtVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
  durationSec?: number;
  views?: number;
  viewsText?: string;
  publishedAt?: string;
  publishedText?: string;
  preview?: string;
  url: string;
}
interface YtShort {
  id: string;
  title: string;
  thumbnail: string;
  views?: number;
  viewsText?: string;
  publishedAt?: string;
  url: string;
}
interface YtChannel {
  id: string;
  title: string;
  handle?: string;
  avatar?: string;
  subscribers?: number;
  subscribersText?: string;
  videoCountText?: string;
  url: string;
}
interface YtFeed {
  channel: YtChannel;
  videos: YtVideo[];
  shorts: YtShort[];
  updatedAt: string;
}

const CHANNEL_ID = "UCoMu2BkIcQHKkUy9dr3gNdQ";
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;
const SUBSCRIBE_URL = `${CHANNEL_URL}?sub_confirmation=1`;
const CACHE_KEY = "youtube_feed_v14";
const CACHE_TTL = 30 * 60 * 1000;
const NEW_WINDOW_MS = 14 * 86_400_000;

const readCache = (): YtFeed | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; feed: YtFeed };
    return parsed?.feed?.videos ? parsed.feed : null;
  } catch {
    return null;
  }
};
const cacheAge = (): number => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? Date.now() - (JSON.parse(raw).ts || 0) : Infinity;
  } catch {
    return Infinity;
  }
};
const writeCache = (feed: YtFeed) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), feed }));
  } catch {
    /* ignore quota errors */
  }
};

const isNew = (iso?: string) => !!iso && Date.now() - Date.parse(iso) < NEW_WINDOW_MS;

/** Localized relative dates, compact numbers and plural labels. */
const useFormatters = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ru") ? "ru" : "en";
  return useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    const compact = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
    const absolute = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" });
    const relative = (iso?: string, fallback?: string) => {
      if (!iso) return fallback || "";
      const diff = Date.now() - new Date(iso).getTime();
      if (!Number.isFinite(diff)) return fallback || "";
      const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ["year", 31_557_600_000],
        ["month", 2_629_800_000],
        ["week", 604_800_000],
        ["day", 86_400_000],
        ["hour", 3_600_000],
        ["minute", 60_000],
      ];
      if (diff > 31_557_600_000 * 1.5) return absolute.format(new Date(iso));
      for (const [unit, ms] of units) {
        if (Math.abs(diff) >= ms || unit === "minute") return rtf.format(-Math.round(diff / ms), unit);
      }
      return "";
    };
    const views = (n?: number, fallback?: string) => (typeof n === "number" ? t("youtube.views", { count: n, formatted: compact.format(n) }) : fallback || "");
    const subscribers = (n?: number, fallback?: string) =>
      typeof n === "number" ? t("youtube.subscribers", { count: n, formatted: compact.format(n) }) : fallback || "";
    const videoCount = (text?: string) => {
      const n = text ? parseInt(text.replace(/[^\d]/g, ""), 10) : NaN;
      return Number.isFinite(n) ? t("youtube.videos_count", { count: n, formatted: new Intl.NumberFormat(lang).format(n) }) : "";
    };
    return { relative, views, subscribers, videoCount };
  }, [lang, t]);
};

/**
 * 16:9 thumbnails without letterboxing: hq720 exists for most uploads; YouTube answers a
 * 120x90 placeholder (not a 404) for missing sizes, so we also check the decoded size.
 */
const thumbSrc = (id: string, size: "maxres" | "hq720" | "mq") =>
  `https://i.ytimg.com/vi/${id}/${size === "maxres" ? "maxresdefault" : size === "hq720" ? "hq720" : "mqdefault"}.jpg`;

const FALLBACK_ORDER: Record<string, "hq720" | "mq" | null> = { maxresdefault: "hq720", hq720: "mq", mqdefault: null };

const degrade = (img: HTMLImageElement, id: string) => {
  const current = Object.keys(FALLBACK_ORDER).find((k) => img.src.includes(`/${k}.jpg`));
  const next = current ? FALLBACK_ORDER[current] : null;
  if (next) img.src = thumbSrc(id, next);
};

interface ThumbProps {
  id: string;
  alt: string;
  size: "maxres" | "hq720";
  preview?: string;
  className?: string;
  imgClassName?: string;
  hoverHint?: string;
}

/** Thumbnail with an animated preview that only loads while hovered/focused. */
function Thumb({ id, alt, size, preview, className = "", imgClassName = "", hoverHint }: ThumbProps) {
  const [hover, setHover] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPreviewReady(false);
      }}
      title={preview && hoverHint ? hoverHint : undefined}
    >
      <img
        src={thumbSrc(id, size)}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={(e) => degrade(e.currentTarget, id)}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= 120) degrade(e.currentTarget, id);
        }}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
      {preview && hover && (
        <img
          src={preview}
          alt=""
          aria-hidden="true"
          onLoad={() => setPreviewReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${previewReady ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, left: 0, moved: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  const handlers = {
    onScroll: update,
    onMouseDown: (e: React.MouseEvent) => {
      if (!ref.current) return;
      setDragging(true);
      start.current = { x: e.pageX, left: ref.current.scrollLeft, moved: false };
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!dragging || !ref.current) return;
      const dx = e.pageX - start.current.x;
      if (Math.abs(dx) > 5) {
        start.current.moved = true;
        e.preventDefault();
        ref.current.scrollLeft = start.current.left - dx * 1.4;
      }
    },
    onMouseUp: () => setDragging(false),
    onMouseLeave: () => setDragging(false),
    /** Suppress clicks that were actually drags. */
    onClickCapture: (e: React.MouseEvent) => {
      if (start.current.moved) {
        e.stopPropagation();
        e.preventDefault();
        start.current.moved = false;
      }
    },
  };

  return { ref, dragging, canLeft, canRight, scrollBy, handlers, update };
}

export default function YouTubeSection() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const [feed, setFeed] = useState<YtFeed | null>(() => readCache());
  const [loading, setLoading] = useState(!feed);
  const [failed, setFailed] = useState(false);
  const [player, setPlayer] = useState<{ id: string; vertical: boolean } | null>(null);
  const [inlinePlaying, setInlinePlaying] = useState(false);
  const shortsRail = useDragScroll<HTMLDivElement>();
  const listRail = useDragScroll<HTMLDivElement>();
  const mobileRail = useDragScroll<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/youtube", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as YtFeed;
        if (cancelled) return;
        if (data?.videos?.length || data?.shorts?.length) {
          setFeed(data);
          writeCache(data);
          setFailed(false);
        } else if (!feed) {
          setFailed(true);
        }
      } catch (err) {
        console.error("Failed to load YouTube feed", err);
        if (!cancelled && !feed) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    // Stale-while-revalidate: paint from cache, refresh if older than the TTL.
    if (!feed || cacheAge() > CACHE_TTL) load();
    else setLoading(false);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRail.update();
    shortsRail.update();
    mobileRail.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed]);

  // Close the modal player on Escape.
  useEffect(() => {
    if (!player) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setPlayer(null);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player]);

  const channel = feed?.channel;
  const latest = feed?.videos[0];
  const rest = feed?.videos.slice(1, 13) || [];
  const shorts = feed?.shorts.slice(0, 16) || [];
  const channelMeta = [
    channel?.subscribers ? fmt.subscribers(channel.subscribers, channel.subscribersText) : "",
    fmt.videoCount(channel?.videoCountText),
  ]
    .filter(Boolean)
    .join(" · ");

  const embedSrc = (id: string) =>
    `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=${
      typeof window !== "undefined" ? window.location.origin : ""
    }`;

  const latestMeta = latest && (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-[13px]">
      {isNew(latest.publishedAt) && <span className="chip h-6 bg-brand px-2 text-[11px] text-white">{t("youtube.new_badge")}</span>}
      {latest.duration && <span className="chip chip--glass nums h-6 px-2 text-[11px] !text-ink">{latest.duration}</span>}
      <span>{fmt.relative(latest.publishedAt, latest.publishedText)}</span>
      {(latest.views !== undefined || latest.viewsText) && (
        <>
          <span aria-hidden="true">·</span>
          <span>{fmt.views(latest.views, latest.viewsText)}</span>
        </>
      )}
    </div>
  );

  return (
    <section id="youtube" className="section container-x scroll-mt-24">
      <div className="flex min-w-0 flex-col gap-10 md:gap-14">
        {/* Header row */}
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-5">
            <span className="eyebrow">
              <YouTubeIcon className="h-3.5 w-3.5 text-brand" />
              {t("header.youtube")}
            </span>
            <h2 className="display-lg max-w-2xl">{t("youtube.title")}</h2>
            <p className="lead">{t("youtube.subtitle")}</p>
          </div>

          {/* Channel card */}
          <a
            href={SUBSCRIBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group/ch flex w-full items-center gap-4 rounded-2xl bg-surface p-3.5 transition-colors duration-300 hover:bg-surface-2 sm:w-auto sm:min-w-[340px] md:p-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm md:h-14 md:w-14">
              {channel?.avatar ? (
                <img src={channel.avatar} alt={channel.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <LogoIcon className="h-[70%] w-[70%]" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-bold leading-tight text-foreground">{channel?.title || "Mashyn Bazar"}</span>
              <span className="truncate text-xs text-muted-foreground">{channelMeta || channel?.handle || t("youtube.channel_label")}</span>
            </div>
            <span className="btn btn-brand btn-sm shrink-0">{t("youtube.subscribe")}</span>
          </a>
        </Reveal>

        {/* Loading */}
        {loading && !feed && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="skeleton aspect-video lg:col-span-7" />
            <div className="flex flex-col gap-4 lg:col-span-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="skeleton aspect-video w-40 shrink-0" />
                  <div className="flex flex-1 flex-col gap-2 pt-1">
                    <div className="skeleton h-4 w-[90%]" />
                    <div className="skeleton h-4 w-[60%]" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unavailable: fall back to the channel playlist embed */}
        {failed && !feed && (
          <div className="flex flex-col gap-4">
            <div className="aspect-video w-full overflow-hidden rounded-3xl bg-surface">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/videoseries?list=UU${CHANNEL_ID.slice(2)}`}
                title={t("youtube.fallback_title")}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("youtube.unavailable")}{" "}
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-4">
                {t("youtube.open_on_youtube")}
              </a>
            </p>
          </div>
        )}

        {/* Latest + list */}
        {latest && (
          <div className="grid min-w-0 gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Featured / inline player */}
            <Reveal className="flex min-w-0 flex-col gap-4 lg:col-span-7">
              <span className="eyebrow">{t("youtube.latest")}</span>
              <div className="group/feat relative aspect-video w-full overflow-hidden rounded-3xl bg-ink shadow-lg">
                {inlinePlaying ? (
                  <iframe
                    src={embedSrc(latest.id)}
                    title={latest.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setInlinePlaying(true)}
                    className="absolute inset-0 block h-full w-full text-left"
                    aria-label={`${t("youtube.play")}: ${latest.title}`}
                  >
                    <Thumb
                      id={latest.id}
                      alt={latest.title}
                      size="maxres"
                      preview={latest.preview}
                      className="h-full w-full"
                      imgClassName="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/feat:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent md:from-ink/85 md:via-ink/20" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-brand shadow-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/feat:scale-110 md:h-20 md:w-20">
                        <Play className="h-6 w-6 translate-x-0.5 fill-current md:h-7 md:w-7" />
                      </span>
                    </div>
                    {/* Overlay title (tablet and up) */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden flex-col gap-2.5 p-6 text-white md:flex md:p-7">
                      <div className="text-white/80">{latestMeta}</div>
                      <h3 className="display-md line-clamp-2 text-balance">{latest.title}</h3>
                    </div>
                  </button>
                )}
              </div>
              {/* Title below the image on phones */}
              <div className="flex flex-col gap-2 md:hidden">
                <div className="text-muted-foreground">{latestMeta}</div>
                <h3 className="text-lg font-bold leading-snug tracking-[-0.01em] text-foreground">{latest.title}</h3>
              </div>
            </Reveal>

            {/* Next uploads */}
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
              <span className="eyebrow">{t("youtube.more_videos")}</span>

              {/* Phones/tablets: horizontal rail */}
              <Stagger className="min-w-0 lg:hidden">
                <div
                  ref={mobileRail.ref}
                  {...mobileRail.handlers}
                  className={`flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-proximity ${mobileRail.dragging ? "cursor-grabbing" : "cursor-grab"}`}
                >
                  {rest.map((v) => (
                    <Item key={v.id} className="w-[280px] shrink-0 snap-start">
                      <VideoCard video={v} onPlay={() => setPlayer({ id: v.id, vertical: false })} fmt={fmt} layout="card" t={t} />
                    </Item>
                  ))}
                </div>
              </Stagger>

              {/* Desktop: vertical list of the next four */}
              <Stagger className="hidden min-w-0 flex-col divide-y divide-border lg:flex">
                {rest.slice(0, 4).map((v) => (
                  <Item key={v.id} className="py-3 first:pt-0">
                    <VideoCard video={v} onPlay={() => setPlayer({ id: v.id, vertical: false })} fmt={fmt} layout="row" t={t} />
                  </Item>
                ))}
              </Stagger>

              <a
                href={`${CHANNEL_URL}/videos`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/all mt-auto inline-flex w-fit items-center gap-2 text-sm font-semibold text-foreground"
              >
                {t("youtube.all_videos")}
                <ExternalLink className="h-4 w-4 text-muted-foreground transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/all:-translate-y-0.5 group-hover/all:translate-x-0.5" />
              </a>
            </div>
          </div>
        )}

        {/* Desktop rail with the remaining videos */}
        {rest.length > 4 && (
          <Stagger className="hidden min-w-0 flex-col gap-5 lg:flex">
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => listRail.scrollBy(-1)} disabled={!listRail.canLeft} className="icon-btn h-10 w-10" aria-label={t("youtube.prev_videos")}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => listRail.scrollBy(1)} disabled={!listRail.canRight} className="icon-btn h-10 w-10" aria-label={t("youtube.next_videos")}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div
              ref={listRail.ref}
              {...listRail.handlers}
              className={`flex gap-5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-proximity ${listRail.dragging ? "cursor-grabbing" : "cursor-grab"}`}
            >
              {rest.slice(4).map((v) => (
                <Item key={v.id} className="w-[320px] shrink-0 snap-start">
                  <VideoCard video={v} onPlay={() => setPlayer({ id: v.id, vertical: false })} fmt={fmt} layout="card" t={t} />
                </Item>
              ))}
            </div>
          </Stagger>
        )}

        {/* Shorts */}
        {shorts.length > 0 && (
          <div className="flex min-w-0 flex-col gap-6">
            <Reveal className="flex items-end justify-between gap-6">
              <div className="flex flex-col gap-2">
                <span className="eyebrow">
                  <YouTubeIcon className="h-3.5 w-3.5 text-brand" />
                  {t("youtube.shorts_title")}
                </span>
                <p className="text-muted-foreground">{t("youtube.shorts_subtitle")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => shortsRail.scrollBy(-1)} disabled={!shortsRail.canLeft} className="icon-btn" aria-label={t("youtube.prev_shorts")}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => shortsRail.scrollBy(1)} disabled={!shortsRail.canRight} className="icon-btn" aria-label={t("youtube.next_shorts")}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </Reveal>

            <Stagger stagger={0.05} className="min-w-0">
              <div
                ref={shortsRail.ref}
                {...shortsRail.handlers}
                className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-proximity md:gap-4 ${shortsRail.dragging ? "cursor-grabbing" : "cursor-grab"}`}
              >
                {shorts.map((s) => (
                  <Item key={s.id} className="w-[160px] shrink-0 snap-start md:w-[190px]">
                    <button
                      type="button"
                      onClick={() => setPlayer({ id: s.id, vertical: true })}
                      className="group/short relative block aspect-[9/16] w-full overflow-hidden rounded-2xl bg-ink text-left shadow-sm transition-shadow duration-500 hover:shadow-lg"
                      aria-label={`${t("youtube.play")}: ${s.title}`}
                    >
                      <img
                        src={s.thumbnail}
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.src.includes("hqdefault")) img.src = `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`;
                        }}
                        alt={s.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/short:scale-[1.05]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                      {isNew(s.publishedAt) && <span className="chip absolute left-2 top-2 h-6 bg-brand px-2 text-[11px] text-white">{t("youtube.new_badge")}</span>}
                      <span className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-brand opacity-0 shadow-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/short:opacity-100 group-focus-visible/short:opacity-100">
                        <Play className="h-4 w-4 translate-x-px fill-current" />
                      </span>
                      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3 text-white">
                        <span className="line-clamp-3 text-[13px] font-semibold leading-snug">{s.title}</span>
                        {(s.views !== undefined || s.viewsText) && <span className="text-[11px] text-white/70">{fmt.views(s.views, s.viewsText)}</span>}
                      </div>
                    </button>
                  </Item>
                ))}
              </div>
            </Stagger>
          </div>
        )}
      </div>

      {/* Modal player */}
      <AnimatePresence>
        {player && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-20 sm:p-6 sm:pt-24"
            role="dialog"
            aria-modal="true"
            aria-label={t("youtube.fallback_title")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <motion.div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setPlayer(null)} aria-hidden="true" />
            {/* Close sits outside the player so it never covers YouTube's own controls */}
            <button
              type="button"
              onClick={() => setPlayer(null)}
              className="icon-btn absolute right-4 top-4 z-10 h-12 w-12 border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white hover:text-ink sm:right-6 sm:top-6"
              aria-label={t("header.close")}
            >
              <X className="h-5 w-5" />
            </button>
            <motion.div
              className={`relative overflow-hidden rounded-3xl bg-black shadow-xl ${
                player.vertical ? "aspect-[9/16] h-[min(82vh,860px)] max-w-full" : "aspect-video w-full max-w-[960px]"
              }`}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <iframe
                src={embedSrc(player.id)}
                title={t("youtube.fallback_title")}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="block h-full w-full border-0"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

interface VideoCardProps {
  video: YtVideo;
  onPlay: () => void;
  fmt: ReturnType<typeof useFormatters>;
  layout: "card" | "row";
  t: (key: string) => string;
}

function VideoCard({ video, onPlay, fmt, layout, t }: VideoCardProps) {
  const meta = (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-muted-foreground">
      {isNew(video.publishedAt) && <span className="chip mr-1 h-5 bg-brand px-1.5 text-[10px] text-white">{t("youtube.new_badge")}</span>}
      {(video.views !== undefined || video.viewsText) && (
        <>
          <span>{fmt.views(video.views, video.viewsText)}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span>{fmt.relative(video.publishedAt, video.publishedText)}</span>
    </div>
  );

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`${t("youtube.play")}: ${video.title}`}
      className={`group/vc w-full text-left ${layout === "row" ? "flex items-start gap-4" : "flex flex-col gap-3"}`}
    >
      <div className={`relative shrink-0 ${layout === "row" ? "w-40" : "w-full"}`}>
        <Thumb
          id={video.id}
          alt={video.title}
          size="hq720"
          preview={video.preview}
          hoverHint={t("youtube.hover_hint")}
          className={`aspect-video bg-surface-2 ${layout === "row" ? "rounded-xl" : "rounded-2xl"}`}
          imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/vc:scale-[1.05]"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 scale-[0.8] items-center justify-center rounded-full bg-white text-brand opacity-0 shadow-lg transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/vc:scale-100 group-hover/vc:opacity-100 group-focus-visible/vc:scale-100 group-focus-visible/vc:opacity-100">
            <Play className="h-5 w-5 translate-x-px fill-current" />
          </span>
        </div>
        {video.duration && <span className="chip chip--glass nums pointer-events-none absolute bottom-1.5 right-1.5 h-6 px-2 text-[11px]">{video.duration}</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors duration-300 group-hover/vc:text-brand">{video.title}</h3>
        {meta}
      </div>
    </button>
  );
}
