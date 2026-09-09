import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, Search, Sparkles, X } from "lucide-react";
import client from "../api/client";

/**
 * Admin: pick and order the cars shown on the 3D showroom turntable (catalog page).
 * Saves the whole selection at once via PUT /api/admin/showroom.
 */

interface AdminCar {
  id: string;
  title: string;
  title_ru?: string | null;
  title_en?: string | null;
  priceUsd: number;
  year: number;
  status: string;
  showroom: boolean;
  showroomOrder: number;
  images: { pathOrUrl: string; isMain: boolean }[];
}

const MAX = 10;

export default function AdminShowroom() {
  const { t, i18n } = useTranslation();
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client
      .get<AdminCar[]>("/admin/showroom")
      .then((res) => {
        setCars(res.data);
        const picked = res.data.filter((c) => c.showroom).sort((a, b) => a.showroomOrder - b.showroomOrder).map((c) => c.id);
        setSelected(picked);
        setInitial(picked);
      })
      .catch(() => toast.error(t("admin.showroom.load_error")))
      .finally(() => setLoading(false));
  }, [t]);

  const byId = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);
  const titleOf = (c: AdminCar) => (i18n.language.startsWith("en") ? c.title_en || c.title : c.title_ru || c.title);
  const imageOf = (c: AdminCar) => c.images?.find((i) => i.isMain)?.pathOrUrl || c.images?.[0]?.pathOrUrl || "";

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cars
      .filter((c) => !selected.includes(c.id))
      .filter((c) => !q || c.title.toLowerCase().includes(q) || (c.title_ru || "").toLowerCase().includes(q) || (c.title_en || "").toLowerCase().includes(q));
  }, [cars, selected, query]);

  const dirty = selected.join("|") !== initial.join("|");

  const add = (id: string) => {
    if (selected.length >= MAX) {
      toast.error(t("admin.showroom.max_reached"));
      return;
    }
    setSelected((s) => [...s, id]);
  };
  const remove = (id: string) => setSelected((s) => s.filter((x) => x !== id));
  const move = (id: string, dir: -1 | 1) =>
    setSelected((s) => {
      const i = s.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await client.put("/admin/showroom", { ids: selected });
      setInitial(selected);
      toast.success(t("admin.showroom.saved"));
    } catch {
      toast.error(t("admin.showroom.save_error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">{t("catalog.loading")}</div>
      </div>
    );
  }

  const Row = ({ car, actions }: { car: AdminCar; actions: React.ReactNode }) => (
    <div className="admin-list-item">
      <div className="flex min-w-0 items-center gap-3">
        {imageOf(car) ? (
          <img src={imageOf(car)} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="admin-no-image h-12 w-16 shrink-0 rounded-lg" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">{titleOf(car)}</span>
            {car.status !== "active" && <span className="admin-status-badge">{t("admin.showroom.hidden_badge")}</span>}
          </div>
          <span className="text-xs text-gray-500">
            {car.year} · ${car.priceUsd.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">{t("admin.showroom.title")}</h2>
          <p className="admin-page-desc">{t("admin.showroom.desc")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* In showroom */}
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon icon-purple">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="admin-card-title">
                {t("admin.showroom.in_showroom")} ({selected.length}/{MAX})
              </h2>
              <p className="admin-card-subtitle">{t("admin.showroom.min_hint")}</p>
            </div>
          </div>

          {selected.length === 0 ? (
            <div className="admin-empty-state">
              <span>{t("admin.showroom.empty")}</span>
            </div>
          ) : (
            <div className="grid gap-2">
              {selected.map((id, i) => {
                const car = byId.get(id);
                if (!car) return null;
                return (
                  <Row
                    key={id}
                    car={car}
                    actions={
                      <>
                        <span className="mr-2 w-6 text-center font-mono text-xs text-gray-400">{i + 1}</span>
                        <button type="button" onClick={() => move(id, -1)} disabled={i === 0} className="admin-action-icon-btn" title={t("admin.showroom.move_up")} aria-label={t("admin.showroom.move_up")}>
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => move(id, 1)} disabled={i === selected.length - 1} className="admin-action-icon-btn" title={t("admin.showroom.move_down")} aria-label={t("admin.showroom.move_down")}>
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => remove(id)} className="admin-action-icon-btn delete" title={t("admin.showroom.remove")} aria-label={t("admin.showroom.remove")}>
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Available */}
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon icon-blue">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <h2 className="admin-card-title">{t("admin.showroom.available")}</h2>
              <p className="admin-card-subtitle">{cars.length - selected.length}</p>
            </div>
          </div>

          <div className="admin-search-container mb-4">
            <Search className="admin-search-icon h-4 w-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.showroom.search_placeholder")} className="admin-search-input" />
          </div>

          <div className="grid gap-2">
            {available.map((car) => (
              <Row
                key={car.id}
                car={car}
                actions={
                  <button type="button" onClick={() => add(car.id)} className="admin-action-icon-btn" title={t("admin.showroom.add")} aria-label={t("admin.showroom.add")}>
                    <Plus className="h-4 w-4" />
                  </button>
                }
              />
            ))}
          </div>
        </section>
      </div>

      <div className="admin-save-bar">
        <button onClick={save} disabled={saving || !dirty} className="admin-button" style={{ width: "auto", paddingLeft: "2rem", paddingRight: "2rem" }}>
          {saving ? (
            <>
              <div className="spinner" />
              {t("admin.settings.saving")}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t("admin.showroom.save")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
