import React, { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { useReducedMotion } from "framer-motion";

/**
 * Small interactive WebGL globe (cobe, ~5KB): Dubai and the cities cars are shipped to.
 * Rotates slowly on its own, drag to spin, respects reduced motion.
 */

// [lat, lng]
const DUBAI: [number, number] = [25.2, 55.27];
const CITIES: [number, number][] = [
  [43.24, 76.89], // Almaty
  [51.17, 71.45], // Astana
  [41.31, 69.28], // Tashkent
  [42.87, 74.59], // Bishkek
  [55.75, 37.62], // Moscow
  [40.41, 49.87], // Baku
  [41.72, 44.83], // Tbilisi
  [38.56, 68.79], // Dushanbe
  [37.96, 58.33], // Ashgabat
  [24.71, 46.68], // Riyadh
];

const locationToPhiTheta = (lat: number, lng: number): [number, number] => [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180];

export default function Globe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const pointer = useRef<{ startX: number; delta: number; dragging: boolean }>({ startX: 0, delta: 0, dragging: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let width = wrap.clientWidth || 260;
    const [startPhi, startTheta] = locationToPhiTheta(36, 62); // centre on Gulf + Central Asia
    let phi = startPhi;
    let current = pointer.current;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi,
      theta: startTheta * 0.9,
      dark: 1,
      diffuse: 1.6,
      mapSamples: 18000,
      mapBrightness: 7,
      baseColor: [0.3, 0.3, 0.35],
      markerColor: [0.9, 0.24, 0.28],
      glowColor: [0.07, 0.07, 0.09],
      opacity: 0.95,
      markers: [{ location: DUBAI, size: 0.11 }, ...CITIES.map((location) => ({ location, size: 0.05 }))],
      onRender: (state) => {
        if (!current.dragging && !reduced) phi += 0.0022;
        state.phi = phi + current.delta;
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    const ro = new ResizeObserver(() => {
      width = wrap.clientWidth || width;
    });
    ro.observe(wrap);

    const onDown = (e: PointerEvent) => {
      current.dragging = true;
      current.startX = e.clientX - current.delta * 200;
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!current.dragging) return;
      current.delta = (e.clientX - current.startX) / 200;
    };
    const onUp = () => {
      if (!current.dragging) return;
      current.dragging = false;
      // fold the drag into the base rotation so idle spin continues from here
      phi += current.delta;
      current.delta = 0;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    // fade in once the first frame is painted
    requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      globe.destroy();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [reduced]);

  return (
    <div ref={wrapRef} className={`relative aspect-square w-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab opacity-0 transition-opacity duration-1000 [contain:layout_paint_size]"
        style={{ touchAction: "pan-y" }}
        aria-hidden="true"
      />
    </div>
  );
}
