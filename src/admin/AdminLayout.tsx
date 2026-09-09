import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import {
    Car,
    Settings,
    LogOut,
    User,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    Globe
} from "lucide-react";
import { Toaster } from "../components/ui/sonner";
import "./admin.css";

export default function AdminLayout() {
    const { i18n, t } = useTranslation();
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        client.get("/auth/me")
            .then(() => setAuthorized(true))
            .catch(() => {
                setAuthorized(false);
                if (location.pathname !== "/admin/login") {
                    navigate("/admin/login");
                }
            })
            .finally(() => setLoading(false));
    }, [location.pathname, navigate]);

    if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-sans">{t('catalog.loading')}</div>;

    if (location.pathname === "/admin/login") {
        return <Outlet />;
    }

    if (!authorized) return null;

    const isActive = (path: string) => location.pathname.startsWith(path);

    const SidebarContent = () => (
        <>
            <div className="admin-sidebar-header">
                <span className={`admin-brand ${collapsed ? 'hidden' : ''}`}>
                    MashynBazar Admin
                </span>
                
                {/* Desktop Collapse Toggle */}
                <button 
                    className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors desktop-only flex ${collapsed ? '' : ''}`}
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? t('admin.sidebar.expand') : t('admin.sidebar.collapse')}
                >
                    {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>

                <button 
                    className="admin-mobile-toggle md:hidden" 
                    onClick={() => setMobileMenuOpen(false)}
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            <nav className="admin-nav">
                <Link
                    to="/admin/cars"
                    className={`admin-nav-item ${isActive('/admin/cars') ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                    title={collapsed ? t('admin.sidebar.inventory') : ""}
                >
                    <Car className="admin-nav-icon" />
                    <span className={collapsed ? 'hidden' : ''}>{t('admin.sidebar.inventory')}</span>
                </Link>
                <Link
                    to="/admin/translations"
                    className={`admin-nav-item ${isActive('/admin/translations') ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                    title={collapsed ? t('admin.sidebar.translations') : ""}
                >
                    <Globe className="admin-nav-icon" />
                    <span className={collapsed ? 'hidden' : ''}>{t('admin.sidebar.translations')}</span>
                </Link>
                <Link
                    to="/admin/settings"
                    className={`admin-nav-item ${isActive('/admin/settings') ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                    title={collapsed ? t('admin.sidebar.settings') : ""}
                >
                    <Settings className="admin-nav-icon" />
                    <span className={collapsed ? 'hidden' : ''}>{t('admin.sidebar.settings')}</span>
                </Link>
            </nav>

            <div className="mt-auto border-t border-gray-200 p-4 flex flex-col gap-4">
                {/* User Info */}
                <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                         <User className="w-4 h-4" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-gray-900 truncate">{t('admin.sidebar.admin_user')}</span>
                            <span className="text-xs text-gray-500 truncate">{t('admin.sidebar.super_admin')}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
                    {/* Language Toggle */}
                    <button
                        onClick={() => i18n.changeLanguage(i18n.language.startsWith('ru') ? 'en' : 'ru')}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
                        title={i18n.language.startsWith('ru') ? "Switch to English" : "Переключить на Русский"}
                    >
                         <span className="font-medium text-sm">{i18n.language.startsWith('ru') ? 'RU' : 'EN'}</span>
                    </button>



                    {/* Logout */}
                    <button
                        onClick={() => {
                            client.post("/auth/logout").then(() => {
                                setAuthorized(false);
                                navigate("/admin/login");
                            });
                        }}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                        title={t('admin.sidebar.sign_out')}
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="admin-layout">
            <Toaster />
            <div 
                className={`admin-overlay ${mobileMenuOpen ? 'open' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
            />
            
            <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
                <SidebarContent />
            </aside>

            <div className={`admin-main ${collapsed ? 'collapsed' : ''}`}>
                <header className="admin-header">
                    <div className="admin-header-left">
                        <button 
                            className="admin-mobile-toggle"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <span className="admin-brand mobile-only">MashynBazar Admin</span>
                    </div>
                </header>

                <main className="admin-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
