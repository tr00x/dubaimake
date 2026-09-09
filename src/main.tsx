import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import CatalogPage from "./pages/Catalog";
import FeaturesPage from "./pages/Features";
import BlogPage from "./pages/Blog";
import CarPage from "./pages/Car";
import AdminLayout from "./admin/AdminLayout";
import AdminLogin from "./admin/AdminLogin";
import AdminCarList from "./admin/AdminCarList";
import CarEditor from "./admin/CarEditor";
import AdminSettings from "./admin/AdminSettings";
import AdminShowroom from "./admin/AdminShowroom";
import TranslationEditor from "./admin/TranslationEditor";
import { registerSW } from 'virtual:pwa-register';
import { toast } from "sonner";
import i18n from "./i18n";
import "./styles/globals.css";

// New build available: offer a one-tap refresh instead of a native confirm() dialog.
const updateSW = registerSW({
  onNeedRefresh() {
    toast(i18n.t("pwa.update_available"), {
      duration: Infinity,
      action: {
        label: i18n.t("pwa.update_action"),
        onClick: () => updateSW(true),
      },
    });
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}>
        <Route index element={<Home />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/catalog/:slug" element={<CarPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/blog" element={<BlogPage />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/cars" replace />} />
        <Route path="cars" element={<AdminCarList />} />
        <Route path="cars/new" element={<CarEditor />} />
        <Route path="cars/:id" element={<CarEditor />} />
        <Route path="translations" element={<TranslationEditor />} />
        <Route path="showroom" element={<AdminShowroom />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

