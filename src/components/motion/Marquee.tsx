import React from "react";

type MarqueeProps = {
  children: React.ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  className?: string;
  /** Pause the animation while hovered. */
  pauseOnHover?: boolean;
  reverse?: boolean;
};

/**
 * Infinite horizontal marquee (pure CSS, GPU transform only).
 * Content is duplicated so the loop is seamless; the copy is aria-hidden.
 */
export function Marquee({ children, duration = 40, className = "", pauseOnHover = true, reverse = false }: MarqueeProps) {
  return (
    <div
      className={`group/marquee relative flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] ${className}`}
    >
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={`flex shrink-0 items-center gap-10 pr-10 motion-safe:animate-marquee ${reverse ? "[animation-direction:reverse]" : ""} ${
            pauseOnHover ? "group-hover/marquee:[animation-play-state:paused]" : ""
          }`}
          style={{ animationDuration: `${duration}s` }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
