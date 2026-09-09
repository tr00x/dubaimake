import CatalogSection from "../components/CatalogSection";
import Showroom from "../components/Showroom";

export default function CatalogPage() {
  return (
    <div className="min-h-[70vh]">
      <Showroom />
      <CatalogSection mode="full" />
    </div>
  );
}
