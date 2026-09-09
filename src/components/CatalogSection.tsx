import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import imgBmwM5Competition from "../assets/5ff7312c3dc0a1014ede77a74beefcf8924374ee.png";
import client from "../api/client";
import { CarCard, CarCardSkeleton } from "./CarCard";
import { Reveal, Stagger, Item } from "./motion/Reveal";
import { cn } from "./ui/utils";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
  SlidersHorizontal,
  Search,
  ArrowRight,
} from "lucide-react";
import { getLocalizedValue } from "../utils/localization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "./ui/sheet";
import { Slider } from "./ui/slider";

type CatalogSectionProps = {
  mode?: 'preview' | 'full';
};

interface Car {
  id: string;
  title: string;
  title_ru?: string;
  title_en?: string;
  images?: { isMain: boolean; pathOrUrl: string }[];
  tags?: string;
  tags_ru?: string;
  tags_en?: string;
  year: number;
  mileage?: number;
  fuelType: string;
  fuelType_ru?: string;
  fuelType_en?: string;
  transmission: string;
  transmission_ru?: string;
  transmission_en?: string;
  horsepower?: number;
  topSpeed?: number;
  acceleration?: number;
  engineCapacity?: string;
  driveType?: string;
  driveType_ru?: string;
  driveType_en?: string;
  bodyType?: string;
  bodyType_ru?: string;
  bodyType_en?: string;
  priceUsd: number;
  color?: string;
  color_ru?: string;
  color_en?: string;
  condition?: string;
  condition_ru?: string;
  condition_en?: string;
}

const PREVIEW_LIMIT = 9;
const SKELETON_COUNT = 8;
const GRID_CLASSES = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6";

export default function CatalogSection({ mode = 'preview' }: CatalogSectionProps) {
  const { t, i18n } = useTranslation();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const ITEMS_PER_PAGE = 12;

  // Filter States
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");

  // Ranges
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000]);
  const [yearRange, setYearRange] = useState<[number, number]>([1990, new Date().getFullYear()]);
  const [mileageRange, setMileageRange] = useState<[number, number]>([0, 500000]);
  const [horsepowerRange, setHorsepowerRange] = useState<[number, number]>([0, 2000]);

  // Selects
  const [selectedFuel, setSelectedFuel] = useState<string[]>([]);
  const [selectedTrans, setSelectedTrans] = useState<string[]>([]);
  const [selectedBody, setSelectedBody] = useState<string[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState<string[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<string[]>([]);

  // Derived limits
  const [limits, setLimits] = useState({
    minPrice: 0,
    maxPrice: 1000000,
    minYear: 1990,
    maxYear: new Date().getFullYear(),
    minMileage: 0,
    maxMileage: 500000,
    minHorsepower: 0,
    maxHorsepower: 2000
  });

  useEffect(() => {
    client.get('/cars')
      .then(res => {
        const data: Car[] = res.data;
        setCars(data);

        // Calculate limits
        if (data.length > 0) {
          const prices = data.map(c => c.priceUsd);
          const years = data.map(c => c.year);
          const mileages = data.map(c => c.mileage || 0);
          const powers = data.map(c => c.horsepower || 0);

          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          const minY = Math.min(...years);
          const maxY = Math.max(...years);
          const minM = Math.min(...mileages);
          const maxM = Math.max(...mileages);
          const minHP = Math.min(...powers);
          const maxHP = Math.max(...powers);

          const newLimits = {
            minPrice: Math.floor(minP / 1000) * 1000,
            maxPrice: Math.ceil(maxP / 1000) * 1000,
            minYear: minY,
            maxYear: maxY,
            minMileage: Math.floor(minM / 1000) * 1000,
            maxMileage: Math.ceil(maxM / 1000) * 1000,
            minHorsepower: Math.floor(minHP / 50) * 50,
            maxHorsepower: Math.ceil(maxHP / 50) * 50,
          };

          setLimits(newLimits);

          // Initialize ranges if not set by user interaction yet
          setPriceRange([newLimits.minPrice, newLimits.maxPrice]);
          setYearRange([newLimits.minYear, newLimits.maxYear]);
          setMileageRange([newLimits.minMileage, newLimits.maxMileage]);
          setHorsepowerRange([newLimits.minHorsepower, newLimits.maxHorsepower]);
        }
      })
      .catch(err => console.error("Failed to fetch cars", err))
      .finally(() => setLoading(false));
  }, []);

  // Sync search query from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearchQuery(q);
  }, [searchParams]);

  const updateSearch = (val: string) => {
    setSearchQuery(val);
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set('q', val);
    else newParams.delete('q');
    setSearchParams(newParams);
    setCurrentPage(1);
  };

  // Extract unique values for filters
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    cars.forEach(c => {
      const brand = c.title.trim().split(' ')[0];
      if (brand) brands.add(brand);
    });
    return Array.from(brands).sort();
  }, [cars]);

  const uniqueFuelTypes = useMemo(() => Array.from(new Set(cars.map(c => c.fuelType).filter((t): t is string => !!t))), [cars]);
  const uniqueTransmissions = useMemo(() => Array.from(new Set(cars.map(c => c.transmission).filter((t): t is string => !!t))), [cars]);
  const uniqueBodyTypes = useMemo(() => Array.from(new Set(cars.map(c => c.bodyType).filter((t): t is string => !!t))), [cars]);
  const uniqueDriveTypes = useMemo(() => Array.from(new Set(cars.map(c => c.driveType).filter((t): t is string => !!t))), [cars]);
  const uniqueColors = useMemo(() => Array.from(new Set(cars.map(c => c.color).filter((t): t is string => !!t))), [cars]);
  const uniqueConditions = useMemo(() => Array.from(new Set(cars.map(c => c.condition).filter((t): t is string => !!t))), [cars]);

  // Filtering Logic
  const filteredCars = useMemo(() => {
    return cars.filter(car => {
      const matchesSearch = !searchQuery ||
        car.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (car.tags && car.tags.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesBrand = selectedBrand === "all" || car.title.toLowerCase().startsWith(selectedBrand.toLowerCase());

      const matchesPrice = car.priceUsd >= priceRange[0] && car.priceUsd <= priceRange[1];
      const matchesYear = car.year >= yearRange[0] && car.year <= yearRange[1];
      const matchesMileage = (car.mileage || 0) >= mileageRange[0] && (car.mileage || 0) <= mileageRange[1];
      const matchesHP = (car.horsepower || 0) >= horsepowerRange[0] && (car.horsepower || 0) <= horsepowerRange[1];

      const matchesFuel = selectedFuel.length === 0 || selectedFuel.includes(car.fuelType);
      const matchesTrans = selectedTrans.length === 0 || selectedTrans.includes(car.transmission);
      const matchesBody = selectedBody.length === 0 || (car.bodyType && selectedBody.includes(car.bodyType));
      const matchesDrive = selectedDrive.length === 0 || (car.driveType && selectedDrive.includes(car.driveType));
      const matchesColor = selectedColor.length === 0 || (car.color && selectedColor.includes(car.color));
      const matchesCondition = selectedCondition.length === 0 || (car.condition && selectedCondition.includes(car.condition));

      return matchesSearch && matchesBrand && matchesPrice && matchesYear && matchesMileage && matchesHP &&
             matchesFuel && matchesTrans && matchesBody && matchesDrive && matchesColor && matchesCondition;
    });
  }, [cars, searchQuery, selectedBrand, priceRange, yearRange, mileageRange, horsepowerRange,
      selectedFuel, selectedTrans, selectedBody, selectedDrive, selectedColor, selectedCondition]);

  const totalPages = Math.ceil(filteredCars.length / ITEMS_PER_PAGE);
  const displayCars = mode === 'preview'
    ? filteredCars.slice(0, PREVIEW_LIMIT)
    : filteredCars.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0);
    }
  };

  const clearAllFilters = () => {
    setSelectedBrand("all");
    setPriceRange([limits.minPrice, limits.maxPrice]);
    setYearRange([limits.minYear, limits.maxYear]);
    setMileageRange([limits.minMileage, limits.maxMileage]);
    setHorsepowerRange([limits.minHorsepower, limits.maxHorsepower]);
    setSelectedFuel([]);
    setSelectedTrans([]);
    setSelectedBody([]);
    setSelectedDrive([]);
    setSelectedColor([]);
    setSelectedCondition([]);
    updateSearch("");
  };

  const activeFilterCount = [
    selectedBrand !== "all",
    priceRange[0] > limits.minPrice || priceRange[1] < limits.maxPrice,
    yearRange[0] > limits.minYear || yearRange[1] < limits.maxYear,
    mileageRange[0] > limits.minMileage || mileageRange[1] < limits.maxMileage,
    horsepowerRange[0] > limits.minHorsepower || horsepowerRange[1] < limits.maxHorsepower,
    selectedFuel.length > 0,
    selectedTrans.length > 0,
    selectedBody.length > 0,
    selectedDrive.length > 0,
    selectedColor.length > 0,
    selectedCondition.length > 0
  ].filter(Boolean).length;

  return (
    <section
      id={mode === 'preview' ? 'catalog' : undefined}
      className="section container-x scroll-mt-24"
    >
      <div className="flex flex-col gap-10 md:gap-12">
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <div className="flex flex-col gap-3">
              <span className="eyebrow">{t('catalog.showroom')}</span>
              <h2 className="display-lg text-foreground">{t('catalog.title')}</h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {mode === 'preview' ? (
              <Link to="/catalog" className="btn btn-outline">
                {t('catalog.view_all')}
                <ArrowRight className="btn-icon h-4 w-4" />
              </Link>
            ) : (
              <span className="nums text-sm text-muted-foreground">
                {t('catalog.found_cars', { count: filteredCars.length })}
              </span>
            )}
          </Reveal>
        </div>

        {/* Filters - Only in Full Mode */}
        {mode === 'full' && (
          <Reveal delay={0.05} className="flex flex-col gap-3">
            {/* Bar */}
            <div className="flex flex-col gap-2.5 rounded-[1.25rem] bg-surface p-2.5 md:flex-row md:items-center md:p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('catalog.search_placeholder') || undefined}
                  value={searchQuery}
                  onChange={(e) => updateSearch(e.target.value)}
                  className="field h-12 rounded-2xl pl-11 pr-10"
                  aria-label={t('catalog.search_placeholder')}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => updateSearch("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-300 hover:text-foreground"
                    aria-label={t('catalog.clear_filters')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="!h-12 w-full rounded-2xl border-none bg-input-background px-4 text-sm font-medium sm:w-[190px]">
                  <SelectValue placeholder={t('catalog.brand')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('catalog.all_brands') || "All Brands"}</SelectItem>
                  {uniqueBrands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <button type="button" className="btn btn-primary flex-1 md:flex-none">
                      <SlidersHorizontal className="h-4 w-4" />
                      {t('catalog.filters')}
                      {activeFilterCount > 0 && (
                        <span className="nums flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-white/20 px-1.5 text-[11px] font-bold">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[540px]">
                    <SheetHeader className="border-b border-border px-6 py-5 text-left">
                      <SheetTitle className="display-md">{t('catalog.all_filters')}</SheetTitle>
                      <SheetDescription>{t('catalog.filters_desc')}</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
                      {uniqueConditions.length > 0 && (
                        <FilterGroup label={t('catalog.condition_all')}>
                          <div className="flex flex-wrap gap-2">
                            <ToggleChip active={selectedCondition.length === 0} onClick={() => setSelectedCondition([])}>{t('catalog.condition_all')}</ToggleChip>
                            {uniqueConditions.map(c => (
                              <ToggleChip key={c} active={selectedCondition.includes(c)} onClick={() => setSelectedCondition(selectedCondition.includes(c) ? [] : [c])}>
                                {getLocalizedValue(t, i18n.language, undefined, undefined, c, 'filter_')}
                              </ToggleChip>
                            ))}
                          </div>
                        </FilterGroup>
                      )}

                      {limits.maxPrice > limits.minPrice && (
                        <FilterGroup label={t('catalog.price')} value={`$${priceRange[0].toLocaleString()} – $${priceRange[1].toLocaleString()}`}>
                          <Slider value={priceRange} min={limits.minPrice} max={limits.maxPrice} step={1000} onValueChange={(val: any) => setPriceRange(val)} />
                        </FilterGroup>
                      )}
                      {limits.maxYear > limits.minYear && (
                        <FilterGroup label={t('catalog.year')} value={`${yearRange[0]} – ${yearRange[1]}`}>
                          <Slider value={yearRange} min={limits.minYear} max={limits.maxYear} step={1} onValueChange={(val: any) => setYearRange(val)} />
                        </FilterGroup>
                      )}
                      {limits.maxMileage > limits.minMileage && (
                        <FilterGroup label={t('catalog.mileage')} value={`${mileageRange[0].toLocaleString()} – ${mileageRange[1].toLocaleString()} km`}>
                          <Slider value={mileageRange} min={limits.minMileage} max={limits.maxMileage} step={1000} onValueChange={(val: any) => setMileageRange(val)} />
                        </FilterGroup>
                      )}
                      {limits.maxHorsepower > limits.minHorsepower && (
                        <FilterGroup label={t('catalog.horsepower')} value={`${horsepowerRange[0]} – ${horsepowerRange[1]} ${t('catalog.hp')}`}>
                          <Slider value={horsepowerRange} min={limits.minHorsepower} max={limits.maxHorsepower} step={10} onValueChange={(val: any) => setHorsepowerRange(val)} />
                        </FilterGroup>
                      )}

                      {uniqueBodyTypes.length > 0 && (
                        <FilterGroup label={t('catalog.body_type')}>
                          <ChipGroup items={uniqueBodyTypes} selected={selectedBody} onChange={setSelectedBody} render={(v) => getLocalizedValue(t, i18n.language, undefined, undefined, v)} />
                        </FilterGroup>
                      )}
                      {uniqueTransmissions.length > 0 && (
                        <FilterGroup label={t('catalog.transmission')}>
                          <ChipGroup items={uniqueTransmissions} selected={selectedTrans} onChange={setSelectedTrans} render={(v) => getLocalizedValue(t, i18n.language, undefined, undefined, v, 'filter_')} />
                        </FilterGroup>
                      )}
                      {uniqueDriveTypes.length > 0 && (
                        <FilterGroup label={t('catalog.drive_type')}>
                          <ChipGroup items={uniqueDriveTypes} selected={selectedDrive} onChange={setSelectedDrive} render={(v) => getLocalizedValue(t, i18n.language, undefined, undefined, v)} />
                        </FilterGroup>
                      )}
                      {uniqueFuelTypes.length > 0 && (
                        <FilterGroup label={t('catalog.fuel_type')}>
                          <ChipGroup items={uniqueFuelTypes} selected={selectedFuel} onChange={setSelectedFuel} render={(v) => getLocalizedValue(t, i18n.language, undefined, undefined, v, 'filter_')} />
                        </FilterGroup>
                      )}
                      {uniqueColors.length > 0 && (
                        <FilterGroup label={t('catalog.color')}>
                          <ChipGroup items={uniqueColors} selected={selectedColor} onChange={setSelectedColor} render={(v) => getLocalizedValue(t, i18n.language, undefined, undefined, v, 'color_')} />
                        </FilterGroup>
                      )}
                    </div>

                    <SheetFooter className="flex-row items-center gap-3 border-t border-border px-6 py-4 sm:justify-between">
                      <span className="nums text-sm text-muted-foreground">{t('catalog.found_cars', { count: filteredCars.length })}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={clearAllFilters} className="btn btn-outline btn-sm">
                          {t('catalog.clear_filters')}
                        </button>
                        <SheetClose asChild>
                          <button type="button" className="btn btn-primary btn-sm">{t('catalog.apply')}</button>
                        </SheetClose>
                      </div>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="icon-btn h-12 w-12 shrink-0 rounded-2xl"
                    aria-label={t('catalog.clear_filters')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick filters + active ranges */}
            <div className="flex flex-wrap items-center gap-2 px-1">
              {uniqueConditions.length > 0 && (
                <>
                  <ToggleChip active={selectedCondition.length === 0} onClick={() => setSelectedCondition([])}>{t('catalog.condition_all')}</ToggleChip>
                  {uniqueConditions.map(c => (
                    <ToggleChip key={c} active={selectedCondition.includes(c)} onClick={() => setSelectedCondition(selectedCondition.includes(c) ? [] : [c])}>
                      {getLocalizedValue(t, i18n.language, undefined, undefined, c, 'filter_')}
                    </ToggleChip>
                  ))}
                  {uniqueBodyTypes.length > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />}
                </>
              )}
              {uniqueBodyTypes.map(type => (
                <ToggleChip key={type} active={selectedBody.includes(type)} onClick={() => setSelectedBody(selectedBody.includes(type) ? selectedBody.filter(b => b !== type) : [...selectedBody, type])}>
                  {getLocalizedValue(t, i18n.language, undefined, undefined, type)}
                </ToggleChip>
              ))}
              {(priceRange[0] > limits.minPrice || priceRange[1] < limits.maxPrice) && (
                <RemovableChip onRemove={() => setPriceRange([limits.minPrice, limits.maxPrice])}>{`$${priceRange[0].toLocaleString()} – $${priceRange[1].toLocaleString()}`}</RemovableChip>
              )}
              {(yearRange[0] > limits.minYear || yearRange[1] < limits.maxYear) && (
                <RemovableChip onRemove={() => setYearRange([limits.minYear, limits.maxYear])}>{`${yearRange[0]} – ${yearRange[1]}`}</RemovableChip>
              )}
              {(mileageRange[0] > limits.minMileage || mileageRange[1] < limits.maxMileage) && (
                <RemovableChip onRemove={() => setMileageRange([limits.minMileage, limits.maxMileage])}>{`${mileageRange[0].toLocaleString()} – ${mileageRange[1].toLocaleString()} km`}</RemovableChip>
              )}
              {(horsepowerRange[0] > limits.minHorsepower || horsepowerRange[1] < limits.maxHorsepower) && (
                <RemovableChip onRemove={() => setHorsepowerRange([limits.minHorsepower, limits.maxHorsepower])}>{`${horsepowerRange[0]} – ${horsepowerRange[1]} ${t('catalog.hp')}`}</RemovableChip>
              )}
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearAllFilters} className="ml-1 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
                  {t('catalog.clear_filters')}
                </button>
              )}
            </div>
          </Reveal>
        )}

        {/* Grid */}
        {loading ? (
          <div className={GRID_CLASSES}>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <CarCardSkeleton key={i} />
            ))}
          </div>
        ) : displayCars.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground">
              <Filter className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('catalog.no_results_title')}</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('catalog.no_results_desc')}</p>
            </div>
            <button type="button" onClick={clearAllFilters} className="btn btn-outline mt-2">
              {t('catalog.clear_filters')}
            </button>
          </div>
        ) : (
          <Stagger className={GRID_CLASSES}>
            {displayCars.map((car, idx) => {
              const mainImage = car.images?.find((i) => i.isMain)?.pathOrUrl || car.images?.[0]?.pathOrUrl || imgBmwM5Competition;

              // Localization logic
              const currentLang = i18n.language;
              const title = currentLang === 'en' ? (car.title_en || car.title) : (car.title_ru || car.title);
              const fuelType = getLocalizedValue(t, currentLang, car.fuelType_ru, car.fuelType_en, car.fuelType, 'filter_');
              const transmission = getLocalizedValue(t, currentLang, car.transmission_ru, car.transmission_en, car.transmission, 'filter_');
              const driveType = getLocalizedValue(t, currentLang, car.driveType_ru, car.driveType_en, car.driveType || "");
              const meta = [fuelType, transmission].filter((v) => Boolean(v && v.trim()));

              // Localized tags
              const rawTags = currentLang === 'en' ? (car.tags_en || car.tags) : (car.tags_ru || car.tags);
              const tags = rawTags ? rawTags.split(',').filter(tag => tag.trim() !== '') : [];

              const yearStr = car.year.toString();
              const filteredTags = tags.filter(tag =>
                tag.trim() !== yearStr &&
                tag.trim().toLowerCase() !== fuelType.toLowerCase() &&
                tag.trim().toLowerCase() !== transmission.toLowerCase()
              );

              const isFeatured = mode === 'preview' && idx === 0;

              // Transform DB data to UI props
              return (
                <Item key={`${car.id}-${idx}`} className={cn("h-full", isFeatured && "lg:col-span-2 lg:row-span-2")}>
                  <CarCard
                    id={car.id}
                    title={title}
                    price={`$${car.priceUsd.toLocaleString()}`}
                    image={mainImage}
                    year={car.year}
                    meta={meta}
                    tags={filteredTags.slice(0, 3)}
                    variant={isFeatured ? 'featured' : 'default'}
                    details={{
                      mileage: car.mileage ? `${car.mileage.toLocaleString()} km` : undefined,
                      engineCapacity: car.engineCapacity,
                      driveType: driveType
                    }}
                    specs={{
                      hp: car.horsepower ? `${car.horsepower} ${t('catalog.hp')}` : '',
                      zeroTo100: car.acceleration ? `${car.acceleration} ${t('catalog.sec')}` : ''
                    }}
                  />
                </Item>
              );
            })}
          </Stagger>
        )}

        {/* Pagination */}
        {mode === 'full' && totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="icon-btn"
              aria-label={t('catalog.prev_page')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageChange(page)}
                  aria-current={page === currentPage ? 'page' : undefined}
                  className={cn(
                    "chip nums min-w-[1.75rem] justify-center border border-transparent transition-colors duration-300",
                    page === currentPage
                      ? "bg-ink text-white"
                      : "bg-transparent hover:bg-surface-2"
                  )}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="icon-btn"
              aria-label={t('catalog.next_page')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}

/* ---- small filter UI pieces ---- */

function FilterGroup({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        {value && <span className="nums text-sm font-semibold text-foreground">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`chip h-9 cursor-pointer select-none px-3.5 text-[13px] transition-[background-color,color,border-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] ${
        active ? "bg-ink text-white" : "chip--outline bg-background text-foreground hover:border-ink/40"
      }`}
    >
      {children}
    </button>
  );
}

function RemovableChip({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <span className="chip nums h-9 gap-2 bg-ink pl-3.5 pr-2 text-[13px] text-white">
      {children}
      <button type="button" onClick={onRemove} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/30" aria-label="×">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ChipGroup({ items, selected, onChange, render }: { items: string[]; selected: string[]; onChange: (next: string[]) => void; render: (v: string) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((v) => (
        <ToggleChip key={v} active={selected.includes(v)} onClick={() => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])}>
          {render(v)}
        </ToggleChip>
      ))}
    </div>
  );
}
