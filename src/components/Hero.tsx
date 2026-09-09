import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, MapPin } from "lucide-react";
import { EASE, SplitWords } from "./motion/Reveal";

export default function Hero() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  // Parallax: the video drifts slower than the page and fades as you scroll.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "30%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative isolate w-full min-h-[100svh] overflow-hidden bg-ink text-white grain"
      aria-label={t("hero.title_line1")}
    >
      {/* Background video */}
      <motion.div className="absolute inset-0 -z-10 will-change-transform" style={{ y: videoY }}>
        <motion.video
          src="/herovid1.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-[118%] w-full object-cover"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        />
        {/* Readability overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/20 to-transparent" />
      </motion.div>

      {/* Content */}
      <motion.div
        className="container-x relative flex min-h-[100svh] flex-col justify-end pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-32 md:pb-24"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        <div className="flex max-w-5xl flex-col gap-7 md:gap-9">
          <motion.span
            className="eyebrow eyebrow--light"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
          >
            {t("hero.eyebrow")}
          </motion.span>

          <h1 className="display-xl text-white">
            <span className="block">
              <SplitWords text={t("hero.title_line1")} delay={0.35} />
            </span>
            <span className="block">
              <SplitWords text={t("hero.title_line2")} delay={0.55} />
            </span>
            <span className="block text-white/55">
              <SplitWords text={t("hero.title_line3")} delay={0.75} />
            </span>
          </h1>

          <motion.p
            className="max-w-xl text-base leading-relaxed text-white/75 md:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1.0 }}
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1.15 }}
          >
            <Link to="/catalog" className="btn btn-lg btn-white">
              {t("hero.catalog_button")}
              <ArrowRight className="btn-icon h-4 w-4" />
            </Link>
            <Link to="/#contacts" className="btn btn-lg btn-glass">
              {t("hero.contact_button")}
            </Link>
          </motion.div>
        </div>

        {/* Bottom row: location + scroll cue */}
        <motion.div
          className="mt-14 hidden items-end justify-between gap-6 border-t border-white/12 pt-6 text-[13px] text-white/60 md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" />
            <span>Dubai, UAE · Al Quoz Industrial Area 3</span>
          </div>
          <div className="flex items-center gap-6">
            <span>{t("header.working_hours")}</span>
            <a href="#youtube" className="group/cue flex items-center gap-3" aria-label={t("hero.scroll")}>
              <span className="uppercase tracking-[0.18em] text-[11px] font-semibold">{t("hero.scroll")}</span>
              <span className="relative block h-10 w-px overflow-hidden bg-white/20">
                <motion.span
                  className="absolute inset-x-0 top-0 h-1/2 bg-white"
                  animate={reduced ? undefined : { y: ["-100%", "200%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              </span>
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
