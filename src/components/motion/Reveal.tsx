import React, { useRef } from "react";
import { motion, useInView, useReducedMotion, type Variants, type HTMLMotionProps } from "framer-motion";

/**
 * Shared motion primitives.
 *
 * - EASE: a single, weighty easing used across the site (ease-out-quint-ish).
 * - <Reveal>: fade + rise + un-blur when the element scrolls into view.
 * - <Stagger> + <Item>: cascade children with a small delay between them.
 * - <SplitWords>: clip-reveal for headlines, word by word.
 *
 * All primitives respect `prefers-reduced-motion` (opacity only).
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION: { fast: number; base: number; slow: number } = {
  fast: 0.45,
  base: 0.7,
  slow: 1.1,
};

/** IntersectionObserver settings shared by every scroll reveal: start a little before the element is fully in view. */
export const VIEWPORT = { once: true, amount: 0.1, margin: "0px 0px -40px 0px" } as const;

// Opacity + translate only: animating `filter: blur()` repaints large surfaces every frame and
// flickers over images and backdrop-filter chips.
const makeFadeUp = (reduced: boolean, y: number = 20, duration: number = DURATION.base): Variants => ({
  hidden: reduced ? { opacity: 0 } : { opacity: 0, y },
  visible: {
    opacity: 1,
    ...(reduced ? {} : { y: 0 }),
    transition: { duration, ease: EASE },
  },
});

type RevealProps = HTMLMotionProps<"div"> & {
  children?: React.ReactNode;
  /** Delay in seconds before the reveal starts. */
  delay?: number;
  /** Distance in px the element travels upward. */
  y?: number;
  /** Fraction of the element that must be visible before revealing. */
  amount?: number;
  /** Reveal only the first time (default true). */
  once?: boolean;
  duration?: number;
};

export function Reveal({ children, delay = 0, y = 20, amount = VIEWPORT.amount, once = true, duration = DURATION.base as number, ...rest }: RevealProps) {
  const reduced = !!useReducedMotion();
  const variants = makeFadeUp(reduced, y, duration);
  if (delay) (variants.visible as any).transition = { duration, ease: EASE, delay };
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin: VIEWPORT.margin }}
      variants={variants}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = HTMLMotionProps<"div"> & {
  children?: React.ReactNode;
  /** Seconds between each child. */
  stagger?: number;
  /** Seconds before the first child. */
  delayChildren?: number;
  amount?: number;
  once?: boolean;
  /** Animate on mount instead of on scroll. */
  onMount?: boolean;
};

export function Stagger({ children, stagger = 0.07, delayChildren = 0.04, amount = VIEWPORT.amount, once = true, onMount = false, ...rest }: StaggerProps) {
  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren } },
  };
  // Drive the state with `animate` (not `whileInView`): once the group has revealed it stays
  // "visible", so children that mount later (filtered lists, async data, "show more") animate in
  // instead of being stuck at their hidden variant.
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount, margin: VIEWPORT.margin as any });
  return (
    <motion.div ref={ref} initial="hidden" animate={onMount || inView ? "visible" : "hidden"} variants={container} {...rest}>
      {children}
    </motion.div>
  );
}

type ItemProps = HTMLMotionProps<"div"> & { children?: React.ReactNode; y?: number; duration?: number };

/** A child of <Stagger>. */
export function Item({ children, y = 20, duration = DURATION.base as number, ...rest }: ItemProps) {
  const reduced = !!useReducedMotion();
  return (
    <motion.div variants={makeFadeUp(reduced, y, duration)} {...rest}>
      {children}
    </motion.div>
  );
}

type SplitWordsProps = {
  text: string;
  className?: string;
  /** Seconds between words. */
  stagger?: number;
  delay?: number;
  /** Animate on mount (hero) or when scrolled into view. */
  onMount?: boolean;
  as?: "span" | "h1" | "h2" | "p";
};

/** Clip-reveals a line of text word by word. Wrap lines in separate <SplitWords>. */
export function SplitWords({ text, className = "", stagger = 0.06, delay = 0, onMount = true, as = "span" }: SplitWordsProps) {
  const reduced = !!useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const Tag = motion[as] as typeof motion.span;

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
  const word: Variants = {
    hidden: reduced ? { opacity: 0 } : { y: "110%", opacity: 0 },
    visible: reduced
      ? { opacity: 1, transition: { duration: 0.6 } }
      : { y: "0%", opacity: 1, transition: { duration: 0.9, ease: EASE } },
  };

  return (
    <Tag
      className={className}
      initial="hidden"
      {...(onMount ? { animate: "visible" } : { whileInView: "visible", viewport: { once: true, amount: 0.5 } })}
      variants={container}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]" aria-hidden="true">
          <motion.span className="inline-block will-change-transform" variants={word}>
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}
