import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "./motion/Reveal";

/**
 * Giant footer wordmark that fills the available width.
 * - letters rise in when scrolled into view;
 * - with a pointer: the hovered letter fills, gets heavier and lifts, neighbours follow in a wave;
 * - without a pointer (phones): a slow wave runs across the letters by itself.
 * Uses the variable axis of Unbounded, so weight animates smoothly.
 */
export default function Wordmark({ text = "MASHYN BAZAR" }: { text?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(96);
  const [hover, setHover] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const letters = text.split("");

  // Fit the line to the container width (width scales linearly with font-size).
  useEffect(() => {
    const wrap = wrapRef.current;
    const line = textRef.current;
    if (!wrap || !line) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const available = wrap.clientWidth;
        const current = line.scrollWidth;
        if (!available || !current) return;
        const currentSize = parseFloat(getComputedStyle(line).fontSize) || fontSize;
        const next = Math.floor(currentSize * (available / current) * 0.985);
        if (Math.abs(next - currentSize) > 0.5) setFontSize(next);
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    if (document.fonts?.ready) document.fonts.ready.then(fit);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize]);

  return (
    <div ref={wrapRef} className="w-full select-none overflow-hidden" role="img" aria-label={text}>
      <motion.div
        ref={textRef}
        className="wordmark flex w-max items-end whitespace-nowrap font-display uppercase leading-[0.86] tracking-[-0.035em]"
        style={{ fontSize }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
        onMouseLeave={() => setHover(null)}
      >
        {letters.map((ch, i) => {
          const d = hover === null ? -1 : Math.abs(i - hover);
          const level = d < 0 ? "" : d === 0 ? "0" : d === 1 ? "1" : d === 2 ? "2" : "";
          return (
            <motion.span
              key={`${ch}-${i}`}
              className="inline-block overflow-visible"
              variants={{
                hidden: reduced ? { opacity: 0 } : { y: "40%", opacity: 0 },
                visible: { y: "0%", opacity: 1, transition: { duration: 0.9, ease: EASE } },
              }}
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            >
              <span
                className="wordmark-letter inline-block"
                data-d={level}
                style={{ ["--i" as any]: i }}
                aria-hidden="true"
              >
                {ch === " " ? " " : ch}
              </span>
            </motion.span>
          );
        })}
        <motion.span
          className="wordmark-dot inline-block"
          aria-hidden="true"
          variants={{
            hidden: { scale: 0, opacity: 0 },
            visible: { scale: 1, opacity: 1, transition: { duration: 0.6, ease: EASE, delay: 0.2 } },
          }}
        >
          .
        </motion.span>
      </motion.div>
    </div>
  );
}
