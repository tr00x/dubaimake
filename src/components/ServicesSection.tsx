import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Reveal, Stagger, Item, EASE } from "./motion/Reveal";
import {
  SalesIcon,
  SearchIcon,
  PartsIcon,
  AccIcon,
  RepairIcon,
  TuningIcon,
  RegIcon,
  TransportIcon,
  ContainerIcon
} from "./ui/Icons";

interface ServiceItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
}

export default function ServicesSection() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();

  const servicesData: ServiceItem[] = [
    {
      icon: <SalesIcon/>,
      title: t('services.items.sales.title'),
      description: t('services.items.sales.description'),
      features: t('services.items.sales.features', { returnObjects: true }) as string[]
    },
    {
      icon: <SearchIcon/>,
      title: t('services.items.search.title'),
      description: t('services.items.search.description'),
      features: t('services.items.search.features', { returnObjects: true }) as string[]
    },
    {
      icon: <PartsIcon/>,
      title: t('services.items.parts.title'),
      description: t('services.items.parts.description'),
      features: t('services.items.parts.features', { returnObjects: true }) as string[]
    },
    {
      icon: <AccIcon/>,
      title: t('services.items.accessories.title'),
      description: t('services.items.accessories.description'),
      features: t('services.items.accessories.features', { returnObjects: true }) as string[]
    },
    {
      icon: <RepairIcon/>,
      title: t('services.items.repair.title'),
      description: t('services.items.repair.description'),
      features: t('services.items.repair.features', { returnObjects: true }) as string[]
    },
    {
      icon: <TuningIcon/>,
      title: t('services.items.tuning.title'),
      description: t('services.items.tuning.description'),
      features: t('services.items.tuning.features', { returnObjects: true }) as string[]
    },
    {
      icon: <RegIcon/>,
      title: t('services.items.registration.title'),
      description: t('services.items.registration.description'),
      features: t('services.items.registration.features', { returnObjects: true }) as string[]
    },
    {
      icon: <TransportIcon/>,
      title: t('services.items.logistics.title'),
      description: t('services.items.logistics.description'),
      features: t('services.items.logistics.features', { returnObjects: true }) as string[]
    },
    {
      icon: <ContainerIcon/>,
      title: t('services.items.container.title'),
      description: t('services.items.container.description'),
      features: t('services.items.container.features', { returnObjects: true }) as string[]
    }
  ];

  const [isExpanded, setIsExpanded] = useState(false);
  const visibleServices = isExpanded ? servicesData : servicesData.slice(0, 4);

  const handleToggle = () => {
    if (isExpanded) {
      setIsExpanded(false);
      // Scroll back to the start of the section
      const section = document.getElementById('services');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      setIsExpanded(true);
    }
  };

  const exitVariant = reduced
    ? { opacity: 0, transition: { duration: 0.2 } }
    : { opacity: 0, y: -16, filter: "blur(6px)", transition: { duration: 0.35, ease: EASE } };

  return (
    <section id="services" className="section container-x scroll-mt-24">
      {/* Header */}
      <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-6">
        <div className="lg:col-span-5">
          <span className="eyebrow">{t('services.directions')}</span>
          <h2 className="display-lg mt-4">{t('services.section_title')}</h2>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <p className="lead">{t('services.section_subtitle')}</p>
        </div>
      </Reveal>

      {/* Numbered service list */}
      <Stagger layout className="mt-14 grid grid-cols-1 gap-x-16 md:mt-16 lg:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleServices.map((service, index) => (
            <Item
              key={service.title}
              layout
              exit={exitVariant}
              className="group grid grid-cols-[auto_1fr] gap-5 border-b border-border py-7 md:gap-7 md:py-8"
            >
              <div className="flex flex-col items-center gap-3 pt-1">
                <span className="nums font-display text-sm text-brand" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-foreground transition-colors duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-ink group-hover:text-white">
                  {service.icon}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="font-sans text-xl font-bold tracking-[-0.01em] text-foreground transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 md:text-[1.35rem]">
                  {service.title}
                </h3>
                <p className="leading-relaxed text-muted-foreground">{service.description}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {service.features.map((feature, i) => (
                    <span key={i} className="chip chip--outline">{feature}</span>
                  ))}
                </div>
              </div>
            </Item>
          ))}
        </AnimatePresence>
      </Stagger>

      <div className="mt-10 flex justify-center md:mt-12">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          className="btn btn-outline"
        >
          {isExpanded ? t('services.collapse') : t('services.show_all')}
          <motion.span
            className="inline-flex"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: reduced ? 0 : 0.4, ease: EASE }}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </motion.span>
        </button>
      </div>
    </section>
  );
}
