import Hero from "../components/Hero";
import BrandMarquee from "../components/BrandMarquee";
import YouTubeSection from "../components/YouTubeSection";
import CatalogSection from "../components/CatalogSection";
import ServicesSection from "../components/ServicesSection";
import FeaturesSection from "../components/FeaturesSection";
import ContactSection from "../components/ContactSection";

/**
 * Home page. Each section owns its anchor id and its own reveal animations,
 * so anchors resolve to exactly one element.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <BrandMarquee />
      <YouTubeSection />
      <CatalogSection />
      <ServicesSection />
      <FeaturesSection />
      <ContactSection />
    </>
  );
}
