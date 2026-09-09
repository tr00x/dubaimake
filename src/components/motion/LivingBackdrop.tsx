import React, { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * A living section background: thin topographic contours (think desert dunes /
 * elevation map) that drift very slowly, plus a soft brand-tinted spotlight
 * that follows the pointer and makes the contours nearby glow. On touch devices
 * the spotlight wanders on its own. Pure SVG + CSS transforms, no canvas, no
 * per-frame React renders.
 */

type Props = {
  className?: string;
  /** Number of contour rings. */
  rings?: number;
  /** Seed for the deterministic contour shape. */
  seed?: number;
};

const TAU = Math.PI * 2;

// Deterministic pseudo-random in [0, 1)
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Builds smooth closed contour paths as distorted concentric rings around (cx, cy). */
const buildContours = (rings: number, seed: number, cx: number, cy: number) => {
  const paths: string[] = [];
  const steps = 96;
  for (let k = 0; k < rings; k++) {
    const base = 70 + k * 44;
    const a1 = 0.16 + rand(seed + k) * 0.08;
    const a2 = 0.06 + rand(seed + k * 3) * 0.05;
    const p1 = rand(seed + k * 7) * TAU;
    const p2 = rand(seed + k * 11) * TAU;
    const pts: [number, number][] = [];
    for (let i = 0; i < steps; i++) {
      const th = (i / steps) * TAU;
      const r = base * (1 + a1 * Math.sin(3 * th + p1 + k * 0.35) + a2 * Math.sin(7 * th + p2 - k * 0.2) + 0.03 * Math.sin(11 * th + k));
      // stretch horizontally like dunes
      pts.push([cx + Math.cos(th) * r * 1.35, cy + Math.sin(th) * r * 0.82]);
    }
    // Catmull-Rom -> cubic Bezier for a smooth closed curve
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < steps; i++) {
      const p0 = pts[(i - 1 + steps) % steps];
      const p1c = pts[i];
      const p2c = pts[(i + 1) % steps];
      const p3 = pts[(i + 2) % steps];
      const c1x = p1c[0] + (p2c[0] - p0[0]) / 6;
      const c1y = p1c[1] + (p2c[1] - p0[1]) / 6;
      const c2x = p2c[0] - (p3[0] - p1c[0]) / 6;
      const c2y = p2c[1] - (p3[1] - p1c[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2c[0].toFixed(1)} ${p2c[1].toFixed(1)}`;
    }
    paths.push(d + " Z");
  }
  return paths;
};

export default function LivingBackdrop({ className = "", rings = 14, seed = 7 }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const contours = useMemo(() => buildContours(rings, seed, 1000, 420), [rings, seed]);

  // Spotlight: lerp towards the pointer; idle wander when no pointer.
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let target = { x: 0.72, y: 0.4 };
    let pos = { ...target };
    let pointerActive = false;
    let lastPointer = 0;
    let raf = 0;
    const setVars = () => {
      el.style.setProperty("--mx", `${(pos.x * 100).toFixed(2)}%`);
      el.style.setProperty("--my", `${(pos.y * 100).toFixed(2)}%`);
    };
    const tick = (t: number) => {
      if (!pointerActive || t - lastPointer > 2500) {
        // slow figure-eight wander
        const s = t / 1000;
        target = { x: 0.68 + Math.sin(s * 0.21) * 0.18, y: 0.42 + Math.sin(s * 0.33) * 0.22 };
      }
      pos = { x: pos.x + (target.x - pos.x) * 0.06, y: pos.y + (target.y - pos.y) * 0.06 };
      setVars();
      raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      pointerActive = true;
      lastPointer = performance.now();
    };
    const onLeave = () => {
      pointerActive = false;
    };
    const parent = el.parentElement || el;
    parent.addEventListener("pointermove", onMove, { passive: true });
    parent.addEventListener("pointerleave", onLeave);
    setVars();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  const spot = "radial-gradient(560px circle at var(--mx, 72%) var(--my, 40%), rgb(0 0 0 / 1), rgb(0 0 0 / 0) 70%)";

  return (
    <div ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ ["--mx" as any]: "72%", ["--my" as any]: "40%" }}>
      {/* Base contours: barely there */}
      <svg
        viewBox="0 0 2000 840"
        preserveAspectRatio="xMidYMid slice"
        className={`absolute inset-0 h-full w-full text-foreground/[0.11] ${reduced ? "" : "motion-safe:animate-drift"}`}
        style={{ animationDuration: "70s" }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
          {contours.map((d, i) => (
            <path key={i} d={d} strokeDasharray={i % 4 === 3 ? "6 10" : undefined} />
          ))}
        </g>
      </svg>

      {/* Lit contours: same drawing, revealed only under the spotlight */}
      <div className="absolute inset-0" style={{ WebkitMaskImage: spot, maskImage: spot }}>
        <svg
          viewBox="0 0 2000 840"
          preserveAspectRatio="xMidYMid slice"
          className={`absolute inset-0 h-full w-full text-brand ${reduced ? "" : "motion-safe:animate-drift"}`}
          style={{ animationDuration: "70s" }}
        >
          <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeOpacity="0.7" vectorEffect="non-scaling-stroke">
            {contours.map((d, i) => (
              <path key={i} d={d} strokeDasharray={i % 4 === 3 ? "6 10" : undefined} />
            ))}
          </g>
        </svg>
      </div>

      {/* Soft warm glow under the spotlight + a cool fade at the edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(640px circle at var(--mx, 72%) var(--my, 40%), oklch(0.56 0.19 24 / 0.10), transparent 68%), linear-gradient(180deg, var(--surface) 0%, transparent 18%, transparent 82%, var(--surface) 100%)",
        }}
      />
    </div>
  );
}
