import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useTranslation } from "react-i18next";
import imgBmwM5Competition from "../assets/5ff7312c3dc0a1014ede77a74beefcf8924374ee.png";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "../components/ui/carousel";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Fuel,
  Calendar,
  Cog,
  BadgeCheck,
  Mail,
  UserCheck,
  FileCheck,
  ShieldCheck,
  Palette,
  Timer,
  Zap,
  Route,
  CarFront,
} from "lucide-react";
import client from "../api/client";
import { CarCard } from "../components/CarCard";
import ManagerContactModal from "../components/ManagerContactModal";
import { DrivetrainIcon, EngineIcon } from "../components/ui/Icons";
import { getLocalizedValue } from "../utils/localization";
import { EASE } from "../components/motion/Reveal";

type CarData = {
  id: string;
  title: string;
  title_ru?: string;
  title_en?: string;
  priceUsd: number;
  year: number;
  mileage?: number | null;
  transmission: string;
  transmission_ru?: string;
  transmission_en?: string;
  horsepower?: number | null;
  topSpeed?: number | null;
  fuelType: string;
  fuelType_ru?: string;
  fuelType_en?: string;
  condition: string;
  condition_ru?: string;
  condition_en?: string;
  descriptionMd: string;
  description_ru?: string;
  description_en?: string;
  specs_ru?: string;
  specs_en?: string;
  status: string;
  tags: string; // CSV
  tags_ru?: string;
  tags_en?: string;
  labels: string; // CSV
  images: { pathOrUrl: string; isMain: boolean; sortOrder: number }[];

  // New fields
  acceleration?: number | null;
  engineCapacity?: string;
  bodyType?: string;
  bodyType_ru?: string;
  bodyType_en?: string;
  driveType?: string;
  driveType_ru?: string;
  driveType_en?: string;
  color?: string;
  color_ru?: string;
  color_en?: string;
};

/** Tag labels that mean "hot deal" across locales/data sources — mirrors CarCard's chip treatment. */
const HOT_TAG_LABELS = new Set(["Горячее", "HOT", "Hot"]);

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  }
};

/**
 * Gallery image without flicker. Two persistent layers: the visible one never changes `src`
 * (so the browser never clears it); the next photo loads on the hidden layer, is raised on top
 * and fades in (180ms) once it has loaded. Nothing scales, nothing fades out.
 */
function LayeredImage({ src, alt }: { src: string; alt: string }) {
  const [layers, setLayers] = useState<[string, string]>([src, ""]);
  const [front, setFront] = useState<0 | 1>(0);
  const [incomingLoaded, setIncomingLoaded] = useState(false);
  const incoming: 0 | 1 = front === 0 ? 1 : 0;
  const pending = layers[incoming] !== "" && layers[incoming] !== layers[front];

  useEffect(() => {
    if (src === layers[front]) {
      // Same photo requested again (e.g. cancelled flip): drop any pending load.
      if (layers[incoming] !== "") setLayers((l) => (front === 0 ? [l[0], ""] : ["", l[1]]));
      return;
    }
    if (src !== layers[incoming]) {
      setIncomingLoaded(false);
      setLayers((l) => (incoming === 0 ? [src, l[1]] : [l[0], src]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const promote = () => {
    if (!pending) return;
    setFront(incoming);
    setIncomingLoaded(false);
  };

  return (
    <>
      {([0, 1] as const).map((i) => {
        const isFront = i === front;
        const url = layers[i];
        if (!url) return null;
        const visible = isFront || (pending && incomingLoaded);
        return (
          <img
            key={i}
            src={url}
            alt={isFront ? alt : ""}
            aria-hidden={!isFront}
            draggable={false}
            onLoad={() => {
              if (!isFront) setIncomingLoaded(true);
            }}
            onError={() => {
              if (!isFront) promote();
            }}
            onTransitionEnd={() => {
              if (!isFront && incomingLoaded) promote();
            }}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[180ms] ease-out"
            style={{ opacity: visible ? 1 : 0, zIndex: isFront ? 1 : 2 }}
          />
        );
      })}
    </>
  );
}

export default function CarPage() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams(); // Using ID as slug
  const [car, setCar] = useState<CarData | null>(null);
  const [similarCars, setSimilarCars] = useState<CarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showSticky, setShowSticky] = useState(false);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    // We don't listen to 'select' to avoid conflict when carousel items fit on screen (and api.selectedScrollSnap() stays 0)
    // allowing us to manually control activeImageIndex for the main image.
  }, [api]);

  const handlePrevImage = () => {
    if (!images.length) return;
    setActiveImageIndex((prev) => {
      const newIndex = prev === 0 ? images.length - 1 : prev - 1;
      api?.scrollTo(newIndex);
      return newIndex;
    });
  };

  const handleNextImage = () => {
    if (!images.length) return;
    setActiveImageIndex((prev) => {
      const newIndex = (prev + 1) % images.length;
      api?.scrollNext(); // Use scrollNext for smooth looping
      return newIndex;
    });
  };

  // Swipe handlers for main image
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNextImage();
    } else if (isRightSwipe) {
      handlePrevImage();
    }

    // Reset
    touchEndX.current = null;
    touchStartX.current = null;
  };

  // Ref for similar cars scroll container
  const similarCarsRef = useRef<HTMLDivElement>(null);

  const scrollSimilar = (direction: 'left' | 'right') => {
    if (similarCarsRef.current) {
      const scrollAmount = 350; // Approx card width + gap
      const newScrollLeft = direction === 'left'
        ? similarCarsRef.current.scrollLeft - scrollAmount
        : similarCarsRef.current.scrollLeft + scrollAmount;

      similarCarsRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (slug) {
      setLoading(true);
      // Fetch current car
      client.get(`/cars/${slug}`)
        .then(res => {
          setCar(res.data);
          setActiveImageIndex(0); // Reset image index on car change
        })
        .catch(err => console.error("Failed to fetch car", err))
        .finally(() => setLoading(false));

      // Fetch similar cars (all active cars for now, filter client side)
      client.get('/cars')
        .then(res => {
          // Filter out current car and take up to 12 similar cars for the carousel
          const others = res.data.filter((c: CarData) => c.id !== slug);
          setSimilarCars(others.slice(0, 12));
        })
        .catch(err => console.error("Failed to fetch similar cars", err));
    }
  }, [slug]);

  useEffect(() => {
    const onScroll = () => {
      setShowSticky(window.scrollY > 300);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Warm the browser cache for the neighbouring photos so flipping is instant in both directions.
  const imageUrls = car?.images?.length ? car.images.map(i => i.pathOrUrl) : [imgBmwM5Competition];
  useEffect(() => {
    const n = imageUrls.length;
    if (n < 2) return;
    for (const offset of [1, -1, 2]) {
      const src = imageUrls[(activeImageIndex + offset + n) % n];
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImageIndex, car?.id]);

  if (loading) {
    return (
      <div className="container-x flex flex-col gap-10 pt-24 pb-24 md:gap-14 md:pt-32 md:pb-32">
        <div className="skeleton h-8 w-2/3 max-w-md rounded-xl" />
        <div className="skeleton aspect-[16/9] w-full rounded-3xl" />
      </div>
    );
  }

  if (!car) {
    return (
      <div className="container-x flex min-h-[50vh] items-center justify-center py-24 text-center text-muted-foreground">
        {t('catalog.no_cars')}
      </div>
    );
  }

  const images = car.images && car.images.length > 0
    ? car.images.map(i => i.pathOrUrl)
    : [imgBmwM5Competition];

  // Localization logic
  const currentLang = i18n.language;

  const title = currentLang === 'en' ? (car.title_en || car.title) : (car.title_ru || car.title);
  const fuelType = getLocalizedValue(t, currentLang, car.fuelType_ru, car.fuelType_en, car.fuelType, 'filter_');
  const transmission = getLocalizedValue(t, currentLang, car.transmission_ru, car.transmission_en, car.transmission, 'filter_');
  const condition = getLocalizedValue(t, currentLang, car.condition_ru, car.condition_en, car.condition, 'filter_');

  const bodyType = getLocalizedValue(t, currentLang, car.bodyType_ru, car.bodyType_en, car.bodyType || "");
  const driveType = getLocalizedValue(t, currentLang, car.driveType_ru, car.driveType_en, car.driveType || "");
  const color = getLocalizedValue(t, currentLang, car.color_ru, car.color_en, car.color || "", 'color_');

  const rawDescription = currentLang === 'en' ? (car.description_en || car.descriptionMd) : (car.description_ru || car.descriptionMd);
  const specsField = currentLang === 'en' ? car.specs_en : car.specs_ru;

  const descriptionMain = rawDescription?.split("**Комплектация:**")[0];
  const descriptionSpecs = rawDescription?.split("**Комплектация:**")[1];
  const finalSpecs = specsField || descriptionSpecs;

  // Transform DB data to Display format
  const rawTags = currentLang === 'en' ? (car.tags_en || car.tags) : (car.tags_ru || car.tags);
  const rawTagsList = rawTags ? rawTags.split(',').filter(tag => tag.trim() !== '') : [];
  const tagsList = rawTagsList.filter(tag =>
    tag.trim() !== car.year.toString() &&
    tag.trim().toLowerCase() !== fuelType.toLowerCase() &&
    tag.trim().toLowerCase() !== transmission.toLowerCase()
  );
  const isHotTag = (tag: string) => HOT_TAG_LABELS.has(tag.trim());

  const priceStr = `$${car.priceUsd.toLocaleString()}`;
  const distanceUnit = currentLang === 'en' ? 'km' : 'км';
  const topSpeedStr = car.topSpeed ? `${car.topSpeed} ${t('catalog.kmh')}` : "";
  const accelStr = car.acceleration ? `${car.acceleration} ${t('catalog.sec')}` : "";
  const hpStr = car.horsepower ? `${car.horsepower} ${t('catalog.hp')}` : "";
  const mileageStr = car.mileage === null || car.mileage === undefined ? "" : `${car.mileage.toLocaleString()} ${distanceUnit}`;
  const engineCapacityStr = car.engineCapacity || "";
  const driveTypeStr = driveType || "";
  const bodyTypeStr = bodyType || "";
  const colorStr = color || "";

  const SpecTile = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-4 md:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
        <div className="nums break-words text-lg font-bold tracking-tight text-foreground md:text-xl">{value}</div>
      </div>
    </div>
  );

  return (
    <motion.section
      className="container-x flex flex-col gap-10 pt-24 pb-24 md:gap-14 md:pt-32 md:pb-32"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t('header.menu')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/catalog">{t('header.catalog')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </motion.div>

      <AnimatePresence>
        {showSticky && (
          <motion.div
            className="sticky z-40"
            style={{ top: "calc(var(--header-offset, 80px) + 12px)", transition: "top 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-md backdrop-blur-xl md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-sm font-bold text-foreground">{title}</span>
                <div className="hidden items-center gap-2 sm:flex">
                  {car.year ? (
                    <span className="chip chip--outline nums">
                      <Calendar className="h-3.5 w-3.5" />
                      {car.year}
                    </span>
                  ) : null}
                  {hpStr ? (
                    <span className="chip chip--outline nums">
                      <Zap className="h-3.5 w-3.5" />
                      {hpStr}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="nums whitespace-nowrap font-bold text-foreground">{priceStr}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title block */}
      <motion.div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-12" variants={itemVariants}>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          <span className="eyebrow">
            {car.year}
            {condition ? ` · ${condition}` : ""}
          </span>
          <h1 className="display-lg text-foreground">{title}</h1>
          {tagsList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagsList.map((tag) => (
                <span key={tag} className={`chip ${isHotTag(tag) ? "chip--brand" : "chip--outline"}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 lg:col-span-4 lg:items-end lg:text-right">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t('car_page.price')}
          </span>
          <span className="nums font-display text-[2.2rem] font-medium tracking-tight text-foreground md:text-[2.6rem]">
            {priceStr}
          </span>
        </div>
      </motion.div>

      {/* Gallery */}
      <motion.div className="flex flex-col gap-4" variants={itemVariants}>
        <div
          className="relative aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-3xl bg-surface-2 md:aspect-[16/9]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <LayeredImage src={images[activeImageIndex]} alt={title} />

          <button
            type="button"
            onClick={handlePrevImage}
            className="icon-btn absolute left-4 top-1/2 z-10 -translate-y-1/2 border-white/40 bg-white/85 text-ink backdrop-blur-md"
            aria-label={t('car_page.prev_image')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleNextImage}
            className="icon-btn absolute right-4 top-1/2 z-10 -translate-y-1/2 border-white/40 bg-white/85 text-ink backdrop-blur-md"
            aria-label={t('car_page.next_image')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <span className="chip chip--glass nums absolute bottom-4 right-4 z-10">
            {activeImageIndex + 1} / {images.length}
          </span>
        </div>

        <div className="px-1">
          <Carousel
            setApi={setApi}
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4 lg:-ml-6">
              {images.map((src, idx) => (
                <CarouselItem key={idx} className="basis-1/2 pl-2 sm:basis-1/3 md:basis-1/4 md:pl-4 lg:pl-6">
                  <div className="relative w-full p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveImageIndex(idx);
                        api?.scrollTo(idx);
                      }}
                      aria-current={idx === activeImageIndex}
                      className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        idx === activeImageIndex
                          ? "opacity-100 ring-2 ring-ink ring-offset-2"
                          : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={src}
                        alt={`${title} ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden md:block">
              <CarouselPrevious className="-left-4 lg:-left-12" />
              <CarouselNext className="-right-4 lg:-right-12" />
            </div>
          </Carousel>
        </div>
      </motion.div>

      {/* Tech specs */}
      <motion.div className="flex flex-col gap-5" variants={itemVariants}>
        <h2 className="display-md">{t('catalog.tech_specs')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {topSpeedStr ? <SpecTile icon={Gauge} label={t('car_card.speed')} value={topSpeedStr} /> : null}
          {accelStr ? <SpecTile icon={Timer} label={t('car_card.acceleration')} value={accelStr} /> : null}
          {hpStr ? <SpecTile icon={Zap} label={t('car_card.power')} value={hpStr} /> : null}
          {fuelType ? <SpecTile icon={Fuel} label={t('catalog.fuel_type')} value={fuelType} /> : null}
          {transmission ? <SpecTile icon={Cog} label={t('catalog.transmission')} value={transmission} /> : null}
          {bodyTypeStr ? <SpecTile icon={CarFront} label={t('catalog.body_type')} value={bodyTypeStr} /> : null}
          {engineCapacityStr ? <SpecTile icon={EngineIcon} label={t('catalog.engine_capacity')} value={engineCapacityStr} /> : null}
          {driveTypeStr ? <SpecTile icon={DrivetrainIcon} label={t('catalog.drive_type')} value={driveTypeStr} /> : null}
          {colorStr ? <SpecTile icon={Palette} label={t('catalog.color')} value={colorStr} /> : null}
          {mileageStr ? <SpecTile icon={Route} label={t('catalog.mileage')} value={mileageStr} /> : null}
          {condition ? <SpecTile icon={BadgeCheck} label={t('car_page.condition')} value={condition} /> : null}
        </div>
      </motion.div>

      {/* Description + consultation */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <motion.div className="flex flex-col gap-4 lg:col-span-7" variants={itemVariants}>
          <h2 className="display-md">{t('car_page.description')}</h2>
          <p className="max-w-[65ch] whitespace-pre-line break-words leading-relaxed text-muted-foreground">
            {descriptionMain}
          </p>
        </motion.div>

        <motion.div className="lg:col-span-5" variants={itemVariants}>
          <div
            className="grain sticky flex flex-col gap-6 overflow-hidden rounded-3xl bg-ink p-7 text-white md:p-8"
            style={{ top: "calc(var(--header-offset, 80px) + 24px)", transition: "top 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <div className="relative flex flex-col gap-3">
              <span className="eyebrow eyebrow--light">{t('car_page.consultation')}</span>
              <p className="text-lg font-semibold leading-snug">{t('car_page.consultation_desc')}</p>
            </div>

            <div className="relative h-px w-full bg-white/15" />

            <ul className="relative flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm">
                <UserCheck className="h-5 w-5 shrink-0 text-white/80" />
                <span className="font-medium">{t('car_page.personal_manager')}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <FileCheck className="h-5 w-5 shrink-0 text-white/80" />
                <span className="font-medium">{t('car_page.transparent_terms')}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-5 w-5 shrink-0 text-white/80" />
                <span className="font-medium">{t('car_page.docs_insurance')}</span>
              </li>
            </ul>

            <ManagerContactModal carTitle={title} carId={car.id} carPrice={priceStr} carImage={images[0]}>
              <button type="button" className="btn btn-white relative w-full">
                <Mail className="btn-icon h-5 w-5" />
                <span>{t('car_page.contact_manager')}</span>
              </button>
            </ManagerContactModal>
          </div>
        </motion.div>
      </div>

      {/* Similar cars */}
      {similarCars.length > 0 && (
        <motion.div className="flex flex-col gap-5" variants={itemVariants}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="display-md">{t('car_page.similar_cars')}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollSimilar('left')}
                className="icon-btn"
                aria-label={t('car_page.prev_cars')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollSimilar('right')}
                className="icon-btn"
                aria-label={t('car_page.next_cars')}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            ref={similarCarsRef}
            className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4"
          >
            {similarCars.map((item) => {
              const mainImg = item.images?.find(i => i.isMain)?.pathOrUrl || item.images?.[0]?.pathOrUrl || imgBmwM5Competition;

              // Localization for similar cars
              const itemTitle = currentLang === 'en' ? (item.title_en || item.title) : (item.title_ru || item.title);
              const itemFuel = getLocalizedValue(t, currentLang, item.fuelType_ru, item.fuelType_en, item.fuelType, 'filter_');
              const itemTrans = getLocalizedValue(t, currentLang, item.transmission_ru, item.transmission_en, item.transmission, 'filter_');
              const itemDriveType = getLocalizedValue(t, currentLang, item.driveType_ru, item.driveType_en, item.driveType || "");

              const itemRawTags = currentLang === 'en' ? (item.tags_en || item.tags) : (item.tags_ru || item.tags);
              const itemTags = itemRawTags ? itemRawTags.split(',').filter(tag => tag.trim() !== '') : [];
              const itemHp = item.horsepower ? `${item.horsepower} ${t('catalog.hp')}` : "";
              const itemZeroTo100 = item.acceleration ? `${item.acceleration} ${t('catalog.sec')}` : "";

              return (
                <div key={item.id} className="min-w-[300px] snap-start md:min-w-[340px]">
                  <CarCard
                    title={itemTitle}
                    image={mainImg}
                    tags={itemTags}
                    year={item.year}
                    meta={[itemFuel, itemTrans]}
                    specs={{ hp: itemHp, zeroTo100: itemZeroTo100 }}
                    details={{
                      mileage: item.mileage ? `${item.mileage.toLocaleString()} ${currentLang === 'en' ? 'km' : 'км'}` : undefined,
                      engineCapacity: item.engineCapacity,
                      driveType: itemDriveType
                    }}
                    price={`$${item.priceUsd.toLocaleString()}`}
                    id={item.id}
                  />
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
