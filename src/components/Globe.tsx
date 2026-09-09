import React, { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { EASE } from "./motion/Reveal";

/**
 * Interactive WebGL globe (cobe, ~5KB) that "tours" the delivery destinations:
 * it turns to face each city in turn, the city's marker pulses and the caption below
 * shows the route with the real great-circle distance from Dubai. Drag to spin; the
 * tour resumes a few seconds after you let go. Respects reduced motion.
 */

const DUBAI = { key: "dubai", lat: 25.2, lng: 55.27 };
const CITIES = [
  { key: "almaty", lat: 43.24, lng: 76.89 },
  { key: "astana", lat: 51.17, lng: 71.45 },
  { key: "tashkent", lat: 41.31, lng: 69.28 },
  { key: "bishkek", lat: 42.87, lng: 74.59 },
  { key: "baku", lat: 40.41, lng: 49.87 },
  { key: "moscow", lat: 55.75, lng: 37.62 },
  { key: "tbilisi", lat: 41.72, lng: 44.83 },
  { key: "dushanbe", lat: 38.56, lng: 68.79 },
  { key: "ashgabat", lat: 37.96, lng: 58.33 },
  { key: "riyadh", lat: 24.71, lng: 46.68 },
];

const TOUR_STEP_MS = 3200;
const RESUME_AFTER_MS = 3500;

const toRad = (d: number) => (d * Math.PI) / 180;
const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// cobe orientation for a location to face the viewer
const toPhiTheta = (lat: number, lng: number): [number, number] => [Math.PI - (toRad(lng) - Math.PI / 2), toRad(lat) * 0.55];

const shortestDelta = (from: number, to: number) => {
  const d = (to - from) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
};

export default function Globe({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const pointer = useRef({ startX: 0, delta: 0, dragging: false, lastInteraction: 0 });

  // Tour: advance the active city on a timer (pauses while the user holds the globe).
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (pointer.current.dragging || performance.now() - pointer.current.lastInteraction < RESUME_AFTER_MS) return;
      activeRef.current = (activeRef.current + 1) % CITIES.length;
      setActive(activeRef.current);
    }, TOUR_STEP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let width = wrap.clientWidth || 280;
    let [phi, theta] = toPhiTheta(36, 62);
    let t0 = performance.now();
    const p = pointer.current;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi,
      theta,
      dark: 1,
      diffuse: 1.5,
      mapSamples: 20000,
      mapBrightness: 7,
      baseColor: [0.32, 0.32, 0.38],
      markerColor: [0.95, 0.3, 0.32],
      glowColor: [0.42, 0.14, 0.16],
      opacity: 0.92,
      markers: [],
      onRender: (state) => {
        const now = performance.now();
        const dt = Math.min(48, now - t0);
        t0 = now;
        const city = CITIES[activeRef.current];
        const touring = !p.dragging && !reduced && now - p.lastInteraction > RESUME_AFTER_MS;

        if (touring) {
          // Face the midpoint between Dubai and the active city, easing there.
          const [targetPhi, targetTheta] = toPhiTheta((DUBAI.lat + city.lat) / 2, (DUBAI.lng + city.lng) / 2);
          phi += shortestDelta(phi, targetPhi) * Math.min(1, dt / 900);
          theta += (targetTheta - theta) * Math.min(1, dt / 900);
        }

        const pulse = 0.5 + 0.5 * Math.sin(now / 420);
        state.phi = phi + p.delta;
        state.theta = theta;
        state.markers = [
          { location: [DUBAI.lat, DUBAI.lng], size: 0.1 + 0.02 * pulse },
          ...CITIES.map((c, i) => ({ location: [c.lat, c.lng] as [number, number], size: i === activeRef.current ? 0.07 + 0.035 * pulse : 0.04 })),
        ];
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    const ro = new ResizeObserver(() => {
      width = wrap.clientWidth || width;
    });
    ro.observe(wrap);

    const onDown = (e: PointerEvent) => {
      p.dragging = true;
      p.lastInteraction = performance.now();
      p.startX = e.clientX - p.delta * 200;
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!p.dragging) return;
      p.delta = (e.clientX - p.startX) / 200;
      p.lastInteraction = performance.now();
    };
    const onUp = () => {
      if (!p.dragging) return;
      p.dragging = false;
      p.lastInteraction = performance.now();
      phi += p.delta;
      p.delta = 0;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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

  const city = CITIES[active];
  const km = Math.round(distanceKm(DUBAI, city) / 50) * 50;
  const distance = new Intl.NumberFormat(i18n.language.startsWith("ru") ? "ru-RU" : "en-US").format(km);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div ref={wrapRef} className="relative aspect-square w-full max-w-[300px]">
        {/* Warm halo behind the globe */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-12%] rounded-full bg-[radial-gradient(circle_at_50%_55%,oklch(0.56_0.19_24_/_0.22),transparent_62%)]"
        />
        <canvas
          ref={canvasRef}
          className="relative h-full w-full cursor-grab opacity-0 transition-opacity duration-1000 [contain:layout_paint_size]"
          style={{ touchAction: "pan-y" }}
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-semibold text-white">{t("footer.globe_caption")}</p>
        <div className="relative h-6 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={city.key}
              className="nums whitespace-nowrap text-[13px] text-white/70"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {t("footer.globe_route", { city: t(`cities.${city.key}`), distance })}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="mt-1 flex gap-1" aria-hidden="true">
          {CITIES.map((c, i) => (
            <span key={c.key} className={`h-1 rounded-full transition-all duration-500 ${i === active ? "w-4 bg-brand" : "w-1 bg-white/20"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
