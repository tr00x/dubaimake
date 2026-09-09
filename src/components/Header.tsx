import React, { useEffect, useRef, useState } from "react";
import { Search, Menu, Phone, Car, FileText, Youtube, MapPin, Clock, Mail, ArrowUpRight, X } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "./ui/sheet";
import { LogoIcon } from "./ui/Icons";
import { EASE } from "./motion/Reveal";

const NAV = [
  { key: "header.youtube", href: "/#youtube", icon: Youtube },
  { key: "header.catalog", href: "/#catalog", icon: Car },
  { key: "header.services", href: "/#services", icon: FileText },
  { key: "header.contacts", href: "/#contacts", icon: Phone },
] as const;

export default function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const lastY = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const isHome = location.pathname === "/";
  const isRu = i18n.language.startsWith("ru");
  // Over the hero video the header is transparent with light text.
  const onDark = isHome && !scrolled;

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      // Hide when scrolling down past the hero, show as soon as the user scrolls up.
      const goingDown = y > lastY.current && y > 320;
      setHidden(goingDown && !menuOpen && !searchOpen);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const toggleLanguage = () => i18n.changeLanguage(isRu ? "en" : "ru");

  const submitSearch = () => {
    const q = searchQuery.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
    setSearchOpen(false);
  };

  const textColor = onDark ? "text-white" : "text-foreground";
  const mutedColor = onDark ? "text-white/70" : "text-muted-foreground";

  return (
    <motion.header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        scrolled || !isHome
          ? "bg-background/80 backdrop-blur-xl border-b border-border/80 supports-[backdrop-filter]:bg-background/70"
          : "bg-transparent border-b border-transparent"
      }`}
      initial={false}
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: reduced ? 0 : 0.5, ease: EASE }}
    >
      <div className="container-x flex h-[72px] items-center justify-between gap-4 md:h-20">
        {/* Logo */}
        <Link
          to="/"
          aria-label="MashynBazar"
          className="group/logo relative flex shrink-0 items-center"
          onClick={(e) => {
            if (isHome) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
              navigate("/", { replace: true });
            }
          }}
        >
          <div
            className={`h-8 w-auto aspect-[96/40] transition-[filter,opacity] duration-500 md:h-10 ${
              onDark ? "brightness-0 invert" : ""
            } group-hover/logo:opacity-80`}
          >
            <LogoIcon className="block size-full" />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className={`group/nav relative px-3.5 py-2 text-[15px] font-semibold tracking-[-0.005em] transition-colors duration-300 ${textColor} hover:opacity-100`}
            >
              <span className={`transition-opacity duration-300 ${onDark ? "opacity-90 group-hover/nav:opacity-100" : "opacity-80 group-hover/nav:opacity-100"}`}>
                {t(item.key)}
              </span>
              <span
                aria-hidden="true"
                className={`absolute inset-x-3.5 -bottom-0.5 h-[2px] origin-left scale-x-0 rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/nav:scale-x-100 ${
                  onDark ? "bg-white" : "bg-brand"
                }`}
              />
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Search (desktop: expanding field) */}
          <div className="hidden items-center md:flex">
            <AnimatePresence initial={false}>
              {searchOpen && (
                <motion.div
                  key="search"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.45, ease: EASE }}
                  className="overflow-hidden"
                >
                  <input
                    ref={searchRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitSearch();
                      if (e.key === "Escape") setSearchOpen(false);
                    }}
                    onBlur={() => !searchQuery && setSearchOpen(false)}
                    placeholder={t("header.search_placeholder")}
                    aria-label={t("header.search_placeholder")}
                    className={`h-11 w-[240px] rounded-xl border px-4 text-sm outline-none transition-colors ${
                      onDark
                        ? "border-white/25 bg-white/10 text-white placeholder:text-white/60 backdrop-blur-md"
                        : "border-border bg-input-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-ink"
                    }`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => (searchOpen ? submitSearch() : setSearchOpen(true))}
              aria-label={t("header.search_placeholder")}
              className={`ml-1 flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 ${
                onDark ? "text-white hover:bg-white/10" : "text-foreground hover:bg-secondary"
              }`}
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Language */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t("header.language")}
            className={`flex h-11 items-center gap-1 rounded-xl px-3 text-[13px] font-bold tracking-wide transition-colors duration-300 ${
              onDark ? "text-white hover:bg-white/10" : "text-foreground hover:bg-secondary"
            }`}
          >
            <span className={isRu ? "" : "opacity-40"}>RU</span>
            <span className={`${mutedColor} font-normal`}>/</span>
            <span className={isRu ? "opacity-40" : ""}>EN</span>
          </button>

          {/* CTA */}
          <Link to="/catalog" className={`btn btn-sm hidden md:inline-flex ${onDark ? "btn-white" : "btn-primary"}`}>
            <Car className="h-4 w-4" />
            {t("header.catalog")}
          </Link>

          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={t("header.menu_title")}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                    onDark ? "text-white hover:bg-white/10" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Menu className="h-6 w-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(92vw,400px)] border-l-0 bg-ink p-0 text-white [&>button]:hidden">
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between px-6 pt-6">
                    <div className="h-8 w-auto aspect-[96/40] brightness-0 invert">
                      <LogoIcon className="block size-full" />
                    </div>
                    <SheetClose asChild>
                      <button
                        type="button"
                        aria-label={t("header.close")}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </SheetClose>
                  </div>
                  <SheetTitle className="sr-only">{t("header.menu_title")}</SheetTitle>

                  {/* Mobile search */}
                  <form
                    className="px-6 pt-8"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      submitSearch();
                    }}
                  >
                    <div className="flex h-12 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-4 focus-within:border-white/40">
                      <Search className="h-4 w-4 text-white/60" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("header.search_placeholder")}
                        aria-label={t("header.search_placeholder")}
                        className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/50"
                      />
                    </div>
                  </form>

                  <nav className="flex flex-col px-6 pt-6" aria-label="Mobile">
                    {NAV.map((item, i) => (
                      <SheetClose asChild key={item.key}>
                        <Link
                          to={item.href}
                          className="group/m flex items-center justify-between border-b border-white/10 py-4 font-display text-[1.6rem] font-medium tracking-[-0.02em] text-white transition-colors hover:text-white/80"
                          style={{ transitionDelay: `${i * 30}ms` }}
                        >
                          <span className="flex items-center gap-4">
                            <span className="text-xs font-sans font-semibold tabular-nums text-white/40">0{i + 1}</span>
                            {t(item.key)}
                          </span>
                          <ArrowUpRight className="h-5 w-5 text-white/40 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/m:translate-x-0.5 group-hover/m:-translate-y-0.5 group-hover/m:text-white" />
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>

                  <div className="mt-auto flex flex-col gap-5 px-6 pb-8 pt-8">
                    <div className="flex items-center justify-between">
                      <SheetClose asChild>
                        <Link to="/catalog" className="btn btn-white">
                          <Car className="h-4 w-4" />
                          {t("header.catalog")}
                        </Link>
                      </SheetClose>
                      <button
                        type="button"
                        onClick={toggleLanguage}
                        className="flex h-12 items-center gap-1.5 rounded-xl border border-white/15 px-4 text-sm font-bold"
                      >
                        <span className={isRu ? "" : "opacity-40"}>RU</span>
                        <span className="font-normal text-white/40">/</span>
                        <span className={isRu ? "opacity-40" : ""}>EN</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm text-white/70">
                      <a href="tel:+971544050707" className="flex items-center gap-3 transition-colors hover:text-white">
                        <Phone className="h-4 w-4 text-white/40" /> +971 54 405 0707
                      </a>
                      <a href="mailto:info@mashynbazar.com" className="flex items-center gap-3 transition-colors hover:text-white">
                        <Mail className="h-4 w-4 text-white/40" /> info@mashynbazar.com
                      </a>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-white/40" /> Dubai, Al Quoz Industrial Area 3
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-white/40" /> {t("header.working_hours")}
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
