import { useEffect, useState } from "react";
import client from "../api/client";
import { Marquee } from "./motion/Marquee";

const FALLBACK_BRANDS = ["Toyota", "Porsche", "Ford", "Nissan", "Ferrari", "Cadillac", "Mercedes-Benz", "Chevrolet"];

/**
 * Dark strip under the hero listing the brands currently in the catalog.
 * Brands are derived from the live inventory (first word of each title).
 */
export default function BrandMarquee() {
  const [brands, setBrands] = useState<string[]>(FALLBACK_BRANDS);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/cars")
      .then((res) => {
        const set = new Set<string>();
        for (const car of res.data as { title: string }[]) {
          const brand = (car.title || "").trim().split(/\s+/)[0];
          if (brand) set.add(brand.replace(/^\w/, (c) => c.toUpperCase()));
        }
        const list = Array.from(set);
        if (!cancelled && list.length >= 3) setBrands(list);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Repeat short lists so the loop feels continuous.
  const items = brands.length < 8 ? [...brands, ...brands] : brands;

  return (
    <div className="relative border-y border-white/10 bg-ink py-5 text-white" aria-hidden="true">
      <Marquee duration={Math.max(28, items.length * 4)}>
        {items.map((b, i) => (
          <span key={`${b}-${i}`} className="flex items-center gap-10">
            <span className="font-display text-[15px] font-medium uppercase tracking-[0.14em] text-white/80">{b}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          </span>
        ))}
      </Marquee>
    </div>
  );
}
