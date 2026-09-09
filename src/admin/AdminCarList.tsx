import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import client from "../api/client";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import "./admin.css";

type CarSummary = {
    id: string;
    title: string;
    title_ru?: string;
    title_en?: string;
    priceUsd: number;
    status: string;
    year: number;
    images: { pathOrUrl: string; isMain: boolean }[];
};

export default function AdminCarList() {
    const { t, i18n } = useTranslation();
    const [cars, setCars] = useState<CarSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchCars = () => {
        client.get("/cars?admin=true")
            .then(res => setCars(res.data))
            .catch(err => console.error("Failed to fetch cars", err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchCars();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm(t('admin.delete_confirm'))) return;
        
        try {
            await client.delete(`/cars/${id}`);
            toast.success(t('admin.delete_success'));
            fetchCars();
        } catch (error) {
            console.error("Failed to delete car", error);
            toast.error(t('admin.delete_error'));
        }
    };

    const filteredCars = cars.filter(car => {
        const titleRu = car.title_ru || "";
        const titleEn = car.title_en || "";
        const title = car.title || "";
        const term = searchTerm.toLowerCase();
        
        return title.toLowerCase().includes(term) ||
               titleRu.toLowerCase().includes(term) ||
               titleEn.toLowerCase().includes(term) ||
               car.status.toLowerCase().includes(term);
    });

    if (loading) return <div className="p-8 text-center text-gray-500">{t('catalog.loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="admin-page-header">
                <div>
                    <h2 className="admin-page-title">{t('admin.inventory')}</h2>
                    <p className="admin-page-desc">{t('admin.inventory_desc')}</p>
                </div>
                <Link 
                    to="/admin/cars/new"
                    className="admin-action-btn"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('admin.add_vehicle')}
                </Link>
            </div>

            <div className="admin-search-container">
                <Search className="admin-search-icon" />
                <input
                    type="text"
                    placeholder={t('admin.search_placeholder')}
                    className="admin-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="admin-table-container">
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th scope="col" className="admin-table-image-cell">
                                    {t('admin.image')}
                                </th>
                                <th scope="col">
                                    {t('admin.vehicle_details')}
                                </th>
                                <th scope="col">
                                    {t('admin.status')}
                                </th>
                                <th scope="col">
                                    {t('admin.price')}
                                </th>
                                <th scope="col" className="admin-actions-cell">
                                    <span className="sr-only">{t('admin.actions')}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCars.map((car) => {
                                const mainImage = car.images.find(img => img.isMain) || car.images[0];
                                // Ensure we handle both relative and absolute paths correctly
                                let imageUrl = '';
                                if (mainImage) {
                                    if (mainImage.pathOrUrl.startsWith('http')) {
                                        imageUrl = mainImage.pathOrUrl;
                                    } else {
                                        // Ensure slash between domain and path
                                        const path = mainImage.pathOrUrl.startsWith('/') ? mainImage.pathOrUrl : `/${mainImage.pathOrUrl}`;
                                        
                                        // If it's in uploads, it's on the backend (port 3001)
                                        if (path.startsWith('/uploads')) {
                                            imageUrl = path;
                                        } else {
                                            // Otherwise it's likely in public/images, served by frontend (port 3000)
                                            imageUrl = path;
                                        }
                                    }
                                }

                                // Localization logic for list item
                                const currentLang = i18n.language;
                                // User requested RU by default, but standard i18n practice is to follow currentLang.
                                // If they mean "If RU exists, show it even in EN", that's unusual. 
                                // I'll assume standard i18n behavior + fallback to RU if EN missing (or vice versa).
                                // Actually, let's just use the current language.
                                const displayTitle = currentLang === 'en' 
                                    ? (car.title_en || car.title) 
                                    : (car.title_ru || car.title);

                                const displayStatus = t(`admin.status_${car.status.toLowerCase()}`, { defaultValue: car.status });
                                const displayYear = car.year ? String(car.year) : "—";

                                return (
                                    <tr key={car.id}>
                                        <td className="admin-table-image-cell">
                                            {mainImage ? (
                                                <img 
                                                    src={imageUrl} 
                                                    alt={displayTitle} 
                                                    className="admin-table-image"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/80x60?text=No+Image';
                                                    }}
                                                />
                                            ) : (
                                                <div className="admin-table-image admin-no-image">
                                                    {t('admin.no_image')}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="admin-table-title">{displayTitle}</div>
                                            <div className="admin-table-subtitle">{displayYear}</div>
                                        </td>
                                        <td>
                                            <span className={`admin-status-badge ${car.status === 'active' ? 'status-active' : 'status-sold'}`}>
                                                {displayStatus}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="admin-price">
                                                ${car.priceUsd.toLocaleString().replace(/,/g, ' ')}
                                            </div>
                                        </td>
                                        <td className="admin-actions-cell">
                                            <div className="admin-actions-wrapper">
                                                <Link 
                                                    to={`/admin/cars/${car.id}`} 
                                                    className="admin-action-icon-btn"
                                                    title={t('admin.edit')}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Link>
                                                <button 
                                                    onClick={() => handleDelete(car.id)} 
                                                    className="admin-action-icon-btn delete"
                                                    title={t('admin.delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
