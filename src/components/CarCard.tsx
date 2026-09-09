import { Link } from "react-router-dom";
import { ArrowRight, Route, Disc, Gauge } from "lucide-react";
import { HorsePowerIcon, SpeedIcon } from "./ui/Icons";
import { useTranslation } from "react-i18next";
import { cn } from "./ui/utils";

export type CarCardProps = {
  title: string;
  image: string;
  tags?: string[];
  meta?: string[];
  specs: { hp: string; zeroTo100: string };
  details?: {
    mileage?: string;
    engineCapacity?: string;
    driveType?: string;
  };
  price: string;
  id: string;
  year?: number;
  /** `featured` gets a taller image on large screens and bigger type — used for the first card in the preview grid. */
  variant?: "default" | "featured";
};

/** Tag labels that mean "hot deal" across locales/data sources — rendered with the brand chip instead of glass. */
const HOT_LABELS = new Set(["Горячее", "HOT", "Hot"]);

export function CarCard({
  title,
  image,
  tags = [],
  meta = [],
  specs,
  details,
  price,
  id,
  year,
  variant = "default",
}: CarCardProps) {
  const { t } = useTranslation();
  const featured = variant === "featured";
  const hasDetails = Boolean(details && (details.mileage || details.engineCapacity || details.driveType));

  return (
    <Link
      to={`/catalog/${id}`}
      className="surface-card group flex h-full flex-col overflow-hidden rounded-[1.25rem] active:scale-[0.98]"
    >
      {/* Image */}
      <div
        className={cn(
          "relative w-full overflow-hidden bg-surface-2",
          featured ? "aspect-[4/3] lg:aspect-[16/10]" : "aspect-[4/3]",
        )}
      >
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        {/* Readability gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/45 via-ink/0 to-transparent" />

        {/* Top-left chips */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {year ? (
            <span className="chip chip--glass">
              <span className="nums">{year}</span>
            </span>
          ) : null}
          {tags.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              className={cn("chip", HOT_LABELS.has(tag.trim()) ? "chip--brand" : "chip--glass")}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Hover CTA arrow */}
        <div
          className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-white text-ink opacity-0 shadow-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100"
          aria-hidden="true"
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3
          className={cn(
            "line-clamp-2 text-foreground",
            featured
              ? "display-md"
              : "font-sans text-[1.15rem] font-bold leading-snug tracking-[-0.01em]",
          )}
        >
          {title}
        </h3>

        {meta.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meta.map((text, idx) => (
              <span key={`${text}-${idx}`} className="chip">
                {text}
              </span>
            ))}
          </div>
        )}

        {hasDetails && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {details?.mileage && (
              <span className="inline-flex items-center gap-1">
                <Route className="h-3.5 w-3.5 shrink-0" />
                <span className="nums">{details.mileage}</span>
              </span>
            )}
            {details?.engineCapacity && (
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5 shrink-0" />
                <span className="nums">{details.engineCapacity}</span>
              </span>
            )}
            {details?.driveType && (
              <span className="inline-flex items-center gap-1">
                <Disc className="h-3.5 w-3.5 shrink-0" />
                <span>{details.driveType}</span>
              </span>
            )}
          </div>
        )}

        {(specs.hp || specs.zeroTo100) && (
          <div className="grid grid-cols-2 gap-3 border-y border-dashed border-border py-3">
            {specs.hp ? (
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <HorsePowerIcon />
                  {t("car_card.power")}
                </span>
                <span className="nums font-semibold text-foreground">{specs.hp}</span>
              </div>
            ) : (
              <div />
            )}
            {specs.zeroTo100 ? (
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <SpeedIcon />
                  {t("car_card.acceleration")}
                </span>
                <span className="nums font-semibold text-foreground">{specs.zeroTo100}</span>
              </div>
            ) : (
              <div />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span
            className={cn(
              "nums font-display font-medium tracking-tight text-foreground",
              featured ? "text-[1.75rem]" : "text-[1.35rem]",
            )}
          >
            {price}
          </span>
          <span
            className="icon-btn shrink-0 group-hover:border-ink group-hover:bg-ink group-hover:text-white"
            aria-hidden="true"
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Loading placeholder matching CarCard's proportions. */
export function CarCardSkeleton({ variant = "default" }: { variant?: "default" | "featured" }) {
  const featured = variant === "featured";
  return (
    <div className="surface-card flex flex-col overflow-hidden rounded-[1.25rem]" aria-hidden="true">
      <div className={cn("skeleton w-full rounded-none", featured ? "aspect-[4/3] lg:aspect-[16/10]" : "aspect-[4/3]")} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="skeleton h-5 w-4/5 rounded-lg" />
        <div className="flex gap-1.5">
          <div className="skeleton h-[1.75rem] w-16 rounded-[0.5rem]" />
          <div className="skeleton h-[1.75rem] w-20 rounded-[0.5rem]" />
        </div>
        <div className="grid grid-cols-2 gap-3 border-y border-dashed border-border py-3">
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-3 w-14 rounded" />
            <div className="skeleton h-4 w-10 rounded" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-3 w-14 rounded" />
            <div className="skeleton h-4 w-10 rounded" />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="skeleton h-6 w-24 rounded-lg" />
          <div className="skeleton h-11 w-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}
