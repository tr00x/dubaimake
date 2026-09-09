import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Phone, Mail } from "lucide-react";
import { LogoIcon } from "./ui/Icons";
import Wordmark from "./Wordmark";
import Globe from "./Globe";

const NAV_LINKS = [
  { key: "header.youtube", href: "/#youtube" },
  { key: "header.services", href: "/#services" },
  { key: "header.contacts", href: "/#contacts" },
] as const;

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-ink text-white grain">
      <div className="container-x pt-16 pb-8 md:pt-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Brand */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <Link to="/" className="inline-block w-28">
              <LogoIcon className="block h-auto w-full brightness-0 invert" />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-white/60">{t("footer.description")}</p>
            <Link to="/catalog" className="btn btn-white btn-sm w-fit">
              {t("header.catalog")}
            </Link>
          </div>

          {/* Nav */}
          {/* Living globe: Dubai and the delivery destinations */}
          <div className="flex flex-col items-center gap-3 lg:col-span-3">
            <Globe className="max-w-[260px]" />
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{t("footer.globe_caption")}</p>
              <p className="text-xs text-white/50">{t("footer.globe_sub")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-2">
            <span className="text-xs font-bold uppercase tracking-widest text-white/40">{t("footer.company")}</span>
            <nav className="flex flex-col gap-3" aria-label={t("footer.company")}>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.key}
                  to={link.href}
                  className="w-fit text-[15px] text-white/70 underline-offset-4 transition-colors duration-300 hover:text-white hover:underline"
                >
                  {t(link.key)}
                </Link>
              ))}
              <Link
                to="/catalog"
                className="w-fit text-[15px] text-white/70 underline-offset-4 transition-colors duration-300 hover:text-white hover:underline"
              >
                {t("footer.catalog_link")}
              </Link>
            </nav>
          </div>

          {/* Contacts */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <span className="text-xs font-bold uppercase tracking-widest text-white/40">{t("footer.contacts")}</span>
            <div className="flex flex-col gap-3 text-[15px] text-white/70">
              <a href="tel:+971544050707" className="flex w-fit items-center gap-2.5 transition-colors duration-300 hover:text-white">
                <Phone className="h-4 w-4 text-white/40" />
                +971 54 405 0707
              </a>
              <a href="mailto:info@mashynbazar.com" className="flex w-fit items-center gap-2.5 transition-colors duration-300 hover:text-white">
                <Mail className="h-4 w-4 text-white/40" />
                info@mashynbazar.com
              </a>
              <p className="text-white/50">Dubai, Al Quoz Industrial Area 3</p>
              <p className="text-white/50">
                {t("header.working_hours")} · {t("header.sunday_off")}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row">
          <p>{t("footer.copyright", { year })}</p>
          <p>Mashyn Bazar · Dubai</p>
        </div>
      </div>
      <div className="container-x pt-12 pb-6 md:pt-16 md:pb-8">
        <Wordmark />
      </div>
    </footer>
  );
}
