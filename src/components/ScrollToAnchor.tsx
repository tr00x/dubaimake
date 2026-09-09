import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Height reserved for the fixed header when scrolling to anchors. */
export const HEADER_OFFSET = 88;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Scrolls to `#id`, re-checking the target position for a while so that
 * content that loads late (cars, videos, images) does not leave us in the
 * wrong place. Resolves when the position has settled.
 */
export function scrollToHash(id: string, { smooth = true, maxWaitMs = 1600 }: { smooth?: boolean; maxWaitMs?: number } = {}) {
  if (!id) return;
  const start = performance.now();
  let lastTop: number | null = null;
  let stableTicks = 0;

  const tick = () => {
    const el = document.getElementById(id);
    if (!el) {
      if (performance.now() - start < maxWaitMs) requestAnimationFrame(tick);
      return;
    }
    const top = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET));
    if (lastTop === null || Math.abs(top - lastTop) > 2) {
      window.scrollTo({ top, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
      lastTop = top;
      stableTicks = 0;
    } else {
      stableTicks++;
    }
    // Keep correcting for late layout shifts, but stop once stable for a few frames.
    if (performance.now() - start < maxWaitMs && stableTicks < 12) {
      setTimeout(tick, 80);
    }
  };

  requestAnimationFrame(tick);
}

/**
 * Handles `/#section` navigation:
 *  - scrolls on every navigation, including repeated clicks on the same link
 *    (we key on location.key, which changes on each push);
 *  - waits for late-loading content;
 *  - scrolls to top on plain route changes.
 */
export default function ScrollToAnchor() {
  const location = useLocation();
  const { pathname, hash, key } = location;
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.replace("#", ""));
      // Give the page a moment to mount when arriving from another route.
      const delay = lastPath.current !== pathname ? 120 : 0;
      const timer = setTimeout(() => scrollToHash(id), delay);
      lastPath.current = pathname;
      return () => clearTimeout(timer);
    }

    if (lastPath.current !== pathname) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    lastPath.current = pathname;
  }, [pathname, hash, key]);

  return null;
}
