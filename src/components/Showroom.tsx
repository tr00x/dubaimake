import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, animate, useMotionValue, useMotionValueEvent, useSpring, useTransform, useReducedMotion, useAnimationFrame, type MotionValue } from "framer-motion";
import { ArrowRight, MoveHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { getLocalizedValue } from "../utils/localization";
import imgFallback from "../assets/5ff7312c3dc0a1014ede77a74beefcf8924374ee.png";
import { EASE } from "./motion/Reveal";

/**
 * 3D showroom: the catalog's cars on a turntable you can spin.
 * Pure CSS 3D transforms driven by framer-motion motion values (no per-frame React renders):
 * - idles slowly, pauses on hover, drag/swipe with inertia that snaps to the nearest car,
 * - the stage tilts after the pointer, cards dim as they turn away, mirrored on the floor,
 * - the front car is captioned; click it to open, click another to bring it to the front.
 */

interface CarLite {
  id: string;
  title: string;
  title_ru?: string;
  title_en?: string;
  priceUsd: number;
  year: number;
  tags?: string;
  bodyType?: string;
  bodyType_ru?: string;
  bodyType_en?: string;
  images?: { isMain: boolean; pathOrUrl: string }[];
}

const MAX_CARS = 10;
const IDLE_SPEED = 0.02; // degrees per ms, scaled by frame time below
const IDLE_AFTER_MS = 3200;

const mod = (n: number, m: number) => ((n % m) + m) % m;

const useCardWidth = () => {
  const [w, setW] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 220 : 340));
  useEffect(() => {
    const on = () => setW(window.innerWidth < 768 ? 220 : 340);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
};

interface RingCardProps {
  car: CarLite;
  index: number;
  step: number;
  radius: number;
  width: number;
  angle: MotionValue<number>;
  title: string;
  price: string;
  onSelect: (index: number) => void;
}

function RingCard({ car, index, step, radius, width, angle, title, price, onSelect }: RingCardProps) {
  // Relative angle of this card to the camera: 0 = facing front, ±180 = at the back.
  const rel = useTransform(angle, (a) => mod(a + index * step + 180, 360) - 180);
  const facing = useTransform(rel, (r) => (Math.cos((r * Math.PI) / 180) + 1) / 2); // 1 front .. 0 back
  const dim = useTransform(facing, (f) => 0.72 * (1 - f));
  const scale = useTransform(facing, (f) => 0.82 + 0.18 * f);
  const shadow = useTransform(facing, (f) => 0.15 + 0.45 * f);
  const image = car.images?.find((i) => i.isMain)?.pathOrUrl || car.images?.[0]?.pathOrUrl || imgFallback;

  return (
    <div
      className="absolute left-1/2 top-0 [transform-style:preserve-3d]"
      style={{ width, marginLeft: -width / 2, transform: `rotateY(${index * step}deg) translateZ(${radius}px)` }}
    >
      <motion.button
        type="button"
        onClick={() => onSelect(index)}
        aria-label={`${title}, ${price}`}
        className="group/rc relative block w-full overflow-hidden rounded-2xl bg-ink-2 text-left ring-1 ring-white/10 [backface-visibility:hidden]"
        style={{ scale }}
      >
        <div className="relative aspect-[4/3] w-full">
          <img src={image} alt="" draggable={false} decoding="async" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
          <motion.div className="pointer-events-none absolute inset-0 bg-ink" style={{ opacity: dim }} aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 md:p-4">
            <span className="line-clamp-1 text-[13px] font-semibold text-white md:text-sm">{title}</span>
            <span className="nums shrink-0 text-[13px] font-semibold text-white/85 md:text-sm">{price}</span>
          </div>
        </div>
      </motion.button>

      {/* Floor reflection */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-full mt-2 aspect-[4/3] w-full origin-top overflow-hidden rounded-2xl"
        style={{
          scaleY: -1,
          scale,
          opacity: shadow,
          WebkitMaskImage: "linear-gradient(to bottom, rgb(0 0 0 / 0.6), transparent 45%)",
          maskImage: "linear-gradient(to bottom, rgb(0 0 0 / 0.6), transparent 45%)",
        }}
      >
        <img src={image} alt="" draggable={false} decoding="async" className="h-full w-full object-cover" />
      </motion.div>
    </div>
  );
}

export default function Showroom() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [cars, setCars] = useState<CarLite[]>([]);
  const [active, setActive] = useState(0);
  const cardWidth = useCardWidth();
  const stageRef = useRef<HTMLDivElement>(null);

  const angle = useMotionValue(0);
  const tilt = useSpring(0, { stiffness: 80, damping: 20 });
  const lastInteraction = useRef(0);
  const dragging = useRef(false);
  const hovering = useRef(false);
  const drag = useRef({ startX: 0, startAngle: 0, lastX: 0, lastT: 0, velocity: 0, moved: false });

  useEffect(() => {
    let cancelled = false;
    const auto = async () => {
      // No curated list (or fewer than 3 cars): show the catalog automatically, Hot/New first.
      const res = await client.get("/cars");
      const list = (res.data as CarLite[]).filter((c) => c.images?.length);
      const weight = (c: CarLite) => (/(^|,)\s*(hot|горячее)\s*(,|$)/i.test(c.tags || "") ? 2 : /(^|,)\s*(new|новое)\s*(,|$)/i.test(c.tags || "") ? 1 : 0);
      list.sort((a, b) => weight(b) - weight(a));
      return list.slice(0, MAX_CARS);
    };
    client
      .get("/showroom")
      .then(async (res) => {
        const picked = (res.data as CarLite[]).filter((c) => c.images?.length);
        return picked.length >= 3 ? picked.slice(0, MAX_CARS) : auto();
      })
      .catch(() => auto().catch(() => []))
      .then((list) => {
        if (!cancelled) setCars(list);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const n = cars.length;
  const step = n ? 360 / n : 0;
  const gap = 34;
  const radius = useMemo(() => (n ? Math.max(((cardWidth + gap) * n) / (2 * Math.PI), cardWidth * 1.15) : 0), [n, cardWidth]);

  // Track the front card.
  useMotionValueEvent(angle, "change", (a) => {
    if (!n) return;
    const idx = mod(Math.round(-a / step), n);
    setActive((prev) => (prev === idx ? prev : idx));
  });

  // Idle rotation.
  useAnimationFrame((_, dt) => {
    if (!n || reduced || dragging.current || hovering.current) return;
    if (performance.now() - lastInteraction.current < IDLE_AFTER_MS) return;
    angle.set(angle.get() - IDLE_SPEED * Math.min(dt, 48) * 0.6);
  });

  const snapTo = (target: number, velocity = 0) => {
    animate(angle, target, { type: "spring", stiffness: 120, damping: 22, velocity });
  };

  const bringToFront = (index: number) => {
    lastInteraction.current = performance.now();
    const current = angle.get();
    const desired = -index * step;
    // choose the shortest way around
    const delta = mod(desired - current + 180, 360) - 180;
    snapTo(current + delta);
  };

  const onSelect = (index: number) => {
    if (drag.current.moved) return;
    if (index === active) navigate(`/catalog/${cars[index].id}`);
    else bringToFront(index);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!n) return;
    dragging.current = true;
    drag.current = { startX: e.clientX, startAngle: angle.get(), lastX: e.clientX, lastT: performance.now(), velocity: 0, moved: false };
    lastInteraction.current = performance.now();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (stage && !dragging.current) {
      const r = stage.getBoundingClientRect();
      tilt.set(((r.top + r.height / 2 - e.clientY) / r.height) * 10);
    }
    if (!dragging.current) return;
    const now = performance.now();
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    const dt = Math.max(1, now - drag.current.lastT);
    drag.current.velocity = ((e.clientX - drag.current.lastX) * 0.28) / dt; // deg per ms
    drag.current.lastX = e.clientX;
    drag.current.lastT = now;
    angle.set(drag.current.startAngle + dx * 0.28);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    lastInteraction.current = performance.now();
    const v = drag.current.velocity * 1000; // deg per second
    const projected = angle.get() + v * 0.35;
    const target = Math.round(projected / step) * step;
    snapTo(target, v);
    // let the click handler see `moved` first, then reset
    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!n) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      lastInteraction.current = performance.now();
      snapTo(Math.round(angle.get() / step) * step - step);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      lastInteraction.current = performance.now();
      snapTo(Math.round(angle.get() / step) * step + step);
    } else if (e.key === "Enter" && cars[active]) {
      navigate(`/catalog/${cars[active].id}`);
    }
  };

  const lang = i18n.language;
  const titleOf = (c: CarLite) => (lang.startsWith("en") ? c.title_en || c.title : c.title_ru || c.title);
  const priceOf = (c: CarLite) => `$${c.priceUsd.toLocaleString(lang.startsWith("ru") ? "ru-RU" : "en-US")}`;
  const current = cars[active];
  const stageHeight = cardWidth * 0.75;

  if (!n) return null;

  return (
    <section className="relative isolate overflow-hidden bg-ink text-white grain" aria-label={t("showroom.title")}>
      {/* Spotlight + floor */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-20%] h-[70%] w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(255_255_255_/_0.10),transparent_65%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[radial-gradient(ellipse_at_50%_100%,rgb(255_255_255_/_0.08),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      </div>

      <div className="container-x relative flex flex-col gap-6 pb-8 pt-28 md:gap-8 md:pb-10 md:pt-36">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3">
            <span className="eyebrow eyebrow--light">{t("catalog.showroom")}</span>
            <motion.h1 key={current?.id} className="display-lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              {current ? titleOf(current) : t("catalog.title")}
            </motion.h1>
            {current && (
              <motion.div key={`${current.id}-meta`} className="flex flex-wrap items-center gap-3 text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <span className="nums text-xl font-semibold text-white md:text-2xl">{priceOf(current)}</span>
                <span className="chip border border-white/15 bg-white/10 text-white">{current.year}</span>
                {current.bodyType && <span className="chip border border-white/15 bg-white/10 text-white">{getLocalizedValue(t, lang, current.bodyType_ru, current.bodyType_en, current.bodyType)}</span>}
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/50 md:inline-flex">
              <MoveHorizontal className="h-4 w-4" />
              {t("showroom.drag_hint")}
            </span>
            {current && (
              <Link to={`/catalog/${current.id}`} className="btn btn-white">
                {t("showroom.open")}
                <ArrowRight className="btn-icon h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          role="listbox"
          aria-label={t("showroom.title")}
          aria-activedescendant={current ? `showroom-${current.id}` : undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => {
            hovering.current = false;
            tilt.set(0);
            endDrag();
          }}
          onPointerEnter={() => {
            hovering.current = true;
          }}
          className="relative mx-auto w-full cursor-grab select-none touch-pan-y outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-white/40 rounded-3xl"
          style={{ height: stageHeight * 1.42, perspective: 1500, perspectiveOrigin: "50% 40%" }}
        >
          <motion.div
            className="absolute left-0 right-0 top-2 h-full [transform-style:preserve-3d]"
            style={{ rotateY: angle, rotateX: tilt, transformOrigin: `50% 50% -${radius}px` }}
          >
            <div className="absolute left-0 right-0 top-0 [transform-style:preserve-3d]" style={{ transform: `translateZ(-${radius}px)` }}>
              {cars.map((car, i) => (
                <RingCard
                  key={car.id}
                  car={car}
                  index={i}
                  step={step}
                  radius={radius}
                  width={cardWidth}
                  angle={angle}
                  title={titleOf(car)}
                  price={priceOf(car)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          {cars.map((car, i) => (
            <button
              key={car.id}
              type="button"
              tabIndex={-1}
              onClick={() => bringToFront(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${i === active ? "w-8 bg-white" : "w-1.5 bg-white/30 hover:bg-white/60"}`}
            />
          ))}
        </div>
        <p className="-mt-4 text-center text-xs text-white/40 md:hidden">{t("showroom.swipe_hint")}</p>
      </div>
    </section>
  );
}
