import React from "react";
import { CheckCircle2, FileText, Clock, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Reveal, Stagger, Item } from "./motion/Reveal";
import LivingBackdrop from "./motion/LivingBackdrop";

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function FeaturesSection() {
  const { t } = useTranslation();

  const featuresData: FeatureItem[] = [
    {
      icon: <CheckCircle2 className="h-6 w-6" aria-hidden="true" />,
      title: t('features.card1.title'),
      description: t('features.card1.desc')
    },
    {
      icon: <FileText className="h-6 w-6" aria-hidden="true" />,
      title: t('features.card2.title'),
      description: t('features.card2.desc')
    },
    {
      icon: <Clock className="h-6 w-6" aria-hidden="true" />,
      title: t('features.card3.title'),
      description: t('features.card3.desc')
    },
    {
      icon: <Globe className="h-6 w-6" aria-hidden="true" />,
      title: t('features.card4.title'),
      description: t('features.card4.desc')
    }
  ];

  return (
    <section className="relative overflow-hidden bg-surface">
      {/* Living topographic backdrop: drifting contours + pointer-following glow */}
      <LivingBackdrop />

      <div className="section container-x relative z-10">
        <Reveal className="max-w-2xl">
          <span className="eyebrow">{t('features.subtitle')}</span>
          <h2 className="display-lg mt-4">{t('features.title')}</h2>
        </Reveal>

        <Stagger className="mt-14 grid grid-cols-1 divide-y divide-border/80 md:grid-cols-2 md:divide-y-0 md:divide-x lg:grid-cols-4">
          {featuresData.map((feature, index) => (
            <Item
              key={feature.title}
              className="flex flex-col gap-5 py-8 first:pl-0 last:pr-0 md:px-8 md:py-2"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-brand shadow-sm">
                {feature.icon}
              </div>
              <span className="nums text-[0.6875rem] font-bold tracking-[0.18em] text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-lg font-bold tracking-tight text-foreground">{feature.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
            </Item>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
