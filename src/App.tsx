import Header from "./components/Header";
import Footer from "./components/Footer";
import { Outlet } from "react-router-dom";
import ScrollToAnchor from "./components/ScrollToAnchor";
import { Toaster } from "./components/ui/sonner";
import Preloader from "./components/Preloader";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function App() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(() => {
    // Only show preloader if it hasn't been shown in this session
    return !sessionStorage.getItem("hasSeenPreloader");
  });

  useEffect(() => {
    if (!isLoading) return;
    const minTimePromise = new Promise((resolve) => setTimeout(resolve, 1300));
    const loadPromise = new Promise((resolve) => {
      if (document.readyState === "complete") resolve(true);
      else window.addEventListener("load", () => resolve(true), { once: true });
    });
    Promise.all([minTimePromise, loadPromise]).then(() => {
      setIsLoading(false);
      sessionStorage.setItem("hasSeenPreloader", "true");
    });
  }, [isLoading]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
      <a href="#main" className="skip-link">
        {t("header.skip_to_content")}
      </a>
      <Preloader isLoading={isLoading} />
      <ScrollToAnchor />
      <Toaster />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
