"use client";

import React, { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Play } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoIcon } from "./ui/Icons";
import { useTranslation } from "react-i18next";
import { Stagger, Item } from "./motion/Reveal";

// YouTube glyph, used only as a small accent next to the eyebrow label.
function YouTubeIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white" />
    </svg>
  );
}

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  date: string;
  viewCount?: string;
  length?: string;
}

const CHANNEL_URL = "https://www.youtube.com/channel/UCoMu2BkIcQHKkUy9dr3gNdQ?sub_confirmation=1";

export default function YouTubeSection() {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Drag to scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.75;
      container.scrollBy({
        left: direction === "right" ? scrollAmount : -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeftState(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;

    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    // Only prevent default if moved significantly (drag threshold)
    if (Math.abs(x - startX) > 5) {
      e.preventDefault();
      const walk = (x - startX) * 1.5; // Scroll-fast
      scrollContainerRef.current.scrollLeft = scrollLeftState - walk;
    }
  };

  useEffect(() => {
    const CACHE_KEY = "youtube_feed_cache_v12"; // Incremented version
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    const fetchVideos = () => {
      // Fetch from our local proxy which scrapes the Videos tab (excluding shorts)
      // Use relative URL so it works through tunnel/proxy
      const API_URL = "/api/youtube-videos";

      fetch(API_URL)
        .then((res) => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setVideos(data);
            // Save to cache
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({
                timestamp: Date.now(),
                videos: data,
              })
            );
          }
        })
        .catch((err) => console.error("Failed to fetch YouTube feed", err))
        .finally(() => setLoading(false));
    };

    // Check cache
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setVideos(parsed.videos);
          setLoading(false);
        } else {
          fetchVideos();
        }
      } catch (e) {
        fetchVideos();
      }
    } else {
      fetchVideos();
    }
  }, []);

  // Close the video modal on Escape.
  useEffect(() => {
    if (!selectedVideo) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedVideo(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedVideo]);

  return (
    <section id="youtube" className="section container-x scroll-mt-24">
      <div className="flex flex-col gap-10 md:gap-12">
        {/* Header row */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-5">
            <span className="eyebrow">
              <YouTubeIcon className="h-3.5 w-3.5 text-brand" />
              {t("header.youtube")}
            </span>
            <h2 className="display-lg max-w-2xl">{t("youtube.title")}</h2>
            <p className="lead">{t("youtube.subtitle")}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 sm:w-auto md:gap-4 md:p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white md:h-11 md:w-11">
                <LogoIcon className="h-[70%] w-[70%]" />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold leading-none text-foreground">Mashyn Bazar</span>
                <span className="truncate text-xs text-muted-foreground">{t("youtube.channel_label")}</span>
              </div>
              <button
                type="button"
                onClick={() => window.open(CHANNEL_URL, "_blank")}
                className="btn btn-brand btn-sm ml-auto shrink-0"
              >
                {t("youtube.subscribe")}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!showLeftArrow}
                className="icon-btn"
                aria-label={t("youtube.prev_videos")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={!showRightArrow}
                className="icon-btn"
                aria-label={t("youtube.next_videos")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Rail */}
        {loading ? (
          <div className="flex gap-4 overflow-hidden md:gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex w-[300px] shrink-0 flex-col gap-3 md:w-[340px]">
                <div className="skeleton aspect-video w-full" />
                <div className="skeleton h-4 w-[85%]" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <Stagger className="relative">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className={`flex gap-4 overflow-x-auto pb-3 scrollbar-hide md:gap-5 ${
                isDragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-proximity"
              }`}
            >
              {videos.slice(0, 15).map((video) => (
                <Item key={video.id} className="w-[300px] shrink-0 snap-start md:w-[340px]">
                  <button
                    type="button"
                    onClick={() => setSelectedVideo(video.id)}
                    className="group block w-full text-left"
                    aria-label={video.title}
                  >
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-2">
                      <img
                        src={`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src.includes("maxresdefault")) {
                            target.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
                          }
                        }}
                      />

                      {/* Play button, appears on hover/focus */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex h-14 w-14 scale-[0.8] items-center justify-center rounded-full bg-white opacity-0 shadow-lg transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
                          <Play className="h-6 w-6 translate-x-0.5 fill-red-600 text-red-600" />
                        </div>
                      </div>

                      {video.length && (
                        <span className="chip chip--glass absolute bottom-2 right-2">{video.length}</span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col gap-1">
                      <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors duration-300 group-hover:text-brand">
                        {video.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                        {video.viewCount && (
                          <>
                            <span>{video.viewCount}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{video.date}</span>
                      </div>
                    </div>
                  </button>
                </Item>
              ))}
            </div>
          </Stagger>
        ) : (
          // Fallback to the channel's playlist if the feed fails or returns nothing
          <div className="aspect-video w-full overflow-hidden rounded-3xl bg-surface">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/videoseries?list=UUoMu2BkIcQHKkUy9dr3gNdQ"
              title={t("youtube.fallback_title")}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        )}
      </div>

      {/* Video modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t("youtube.fallback_title")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <motion.div
              className="absolute inset-0 bg-black/85"
              onClick={() => setSelectedVideo(null)}
              aria-hidden="true"
            />

            <motion.div
              className="relative w-full max-w-[800px] overflow-hidden rounded-3xl bg-black"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="icon-btn absolute right-3 top-3 z-10 border-white/20 bg-black/60 text-white hover:bg-white hover:text-ink"
                aria-label={t("header.close")}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="aspect-video w-full bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideo}?autoplay=1&origin=${
                    typeof window !== "undefined" ? window.location.origin : ""
                  }`}
                  title={t("youtube.fallback_title")}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="block h-full w-full border-none"
                ></iframe>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
