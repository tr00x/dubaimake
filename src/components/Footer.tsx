import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogoIcon } from "./ui/Icons";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const navLinks = [
    { name: t('header.youtube'), href: "/#youtube" },
    { name: t('header.catalog'), href: "/#catalog" },
    { name: t('header.services'), href: "/#services" },
    { name: t('header.contacts'), href: "/#contacts" },
  ];

  return (
    <footer className="bg-primary text-primary-foreground py-16 border-t border-primary-foreground/10">
      <div className="max-w-[1400px] mx-auto px-4 md:px-10 flex flex-col gap-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex flex-col gap-6 max-w-[400px]">
             {/* Logo */}
            <Link to="/" className="inline-block">
                <div className="h-[56px] w-auto bg-white rounded-lg px-3 py-2 flex items-center justify-center">
                    <LogoIcon className="h-full w-auto" />
                </div>
            </Link>
            
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              {t('footer.description')}
            </p>
          </div>
          
          {/* Optional: Header Menu Items */}
          <nav className="flex flex-col gap-6 md:items-end">
            {navLinks.map((link) => (
                <Link 
                    key={link.name}
                    to={link.href}
                    className="text-base font-medium text-primary-foreground/60 hover:text-white transition-colors duration-200"
                >
                    {link.name}
                </Link>
            ))}
          </nav>
        </div>
        
        <div className="h-px bg-primary-foreground/10 w-full" />
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-foreground/50">
          <p>{t('footer.copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
