import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { Trash2, Upload, ArrowLeft, Save, Star, Loader2, Plus, GripVertical, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { LocalizedSelect } from "./components/LocalizedSelect";
import { TagInput } from "./components/TagInput";

type CarImageForm = { pathOrUrl: string; isMain: boolean; sortOrder: number };

type CarForm = {
    title: string;
    title_ru?: string;
    title_en?: string;
    priceUsd: number | "";
    year: number | "";
    mileage: number | "";
    transmission: string;
    transmission_ru?: string;
    transmission_en?: string;
    horsepower: number | "";
    topSpeed: number | "";
    acceleration: number | "";
    engineCapacity: string;
    bodyType: string;
    bodyType_ru?: string;
    bodyType_en?: string;
    driveType: string;
    driveType_ru?: string;
    driveType_en?: string;
    color: string;
    color_ru?: string;
    color_en?: string;
    fuelType: string;
    fuelType_ru?: string;
    fuelType_en?: string;
    condition: string;
    condition_ru?: string;
    condition_en?: string;
    descriptionMd: string;
    description_ru?: string;
    description_en?: string;
    status: string;
    tags: string;
    tags_ru?: string;
    tags_en?: string;
    labels: string;
    images: CarImageForm[];
    youtubeUrl: string;
};

const initialForm: CarForm = {
    title: "",
    title_ru: "",
    title_en: "",
    priceUsd: "",
    year: "",
    mileage: "",
    transmission: "",
    transmission_ru: "",
    transmission_en: "",
    horsepower: "",
    topSpeed: "",
    acceleration: "",
    engineCapacity: "",
    bodyType: "",
    bodyType_ru: "",
    bodyType_en: "",
    driveType: "",
    driveType_ru: "",
    driveType_en: "",
    color: "",
    color_ru: "",
    color_en: "",
    fuelType: "",
    fuelType_ru: "",
    fuelType_en: "",
    condition: "",
    condition_ru: "",
    condition_en: "",
    descriptionMd: "",
    description_ru: "",
    description_en: "",
    status: "active",
    tags: "",
    tags_ru: "",
    tags_en: "",
    labels: "",
    images: [],
    youtubeUrl: ""
};

const normalizeCarDataForForm = (data: any): CarForm => {
    const toNumberOrEmpty = (v: any): number | "" => {
        if (v === undefined || v === null || v === "") return "";
        const n = Number(v);
        return Number.isFinite(n) ? n : "";
    };
    const toStringOrEmpty = (v: any): string => (v === undefined || v === null ? "" : String(v));

    return {
        ...initialForm,
        title: toStringOrEmpty(data?.title),
        title_ru: toStringOrEmpty(data?.title_ru || data?.title),
        title_en: toStringOrEmpty(data?.title_en),
        priceUsd: data?.priceUsd === undefined || data?.priceUsd === null ? "" : Number(data.priceUsd),
        year: data?.year === undefined || data?.year === null ? "" : Number(data.year),
        mileage: toNumberOrEmpty(data?.mileage),
        transmission: toStringOrEmpty(data?.transmission) || initialForm.transmission,
        transmission_ru: toStringOrEmpty(data?.transmission_ru),
        transmission_en: toStringOrEmpty(data?.transmission_en),
        horsepower: toNumberOrEmpty(data?.horsepower),
        topSpeed: toNumberOrEmpty(data?.topSpeed),
        acceleration: toNumberOrEmpty(data?.acceleration),
        engineCapacity: toStringOrEmpty(data?.engineCapacity),
        bodyType: toStringOrEmpty(data?.bodyType),
        bodyType_ru: toStringOrEmpty(data?.bodyType_ru),
        bodyType_en: toStringOrEmpty(data?.bodyType_en),
        driveType: toStringOrEmpty(data?.driveType),
        driveType_ru: toStringOrEmpty(data?.driveType_ru),
        driveType_en: toStringOrEmpty(data?.driveType_en),
        color: toStringOrEmpty(data?.color),
        color_ru: toStringOrEmpty(data?.color_ru),
        color_en: toStringOrEmpty(data?.color_en),
        fuelType: toStringOrEmpty(data?.fuelType) || initialForm.fuelType,
        fuelType_ru: toStringOrEmpty(data?.fuelType_ru),
        fuelType_en: toStringOrEmpty(data?.fuelType_en),
        condition: toStringOrEmpty(data?.condition) || initialForm.condition,
        condition_ru: toStringOrEmpty(data?.condition_ru),
        condition_en: toStringOrEmpty(data?.condition_en),
        descriptionMd: toStringOrEmpty(data?.descriptionMd),
        description_ru: toStringOrEmpty(data?.description_ru || data?.descriptionMd),
        description_en: toStringOrEmpty(data?.description_en),
        status: toStringOrEmpty(data?.status) || initialForm.status,
        tags: toStringOrEmpty(data?.tags),
        tags_ru: toStringOrEmpty(data?.tags_ru || data?.tags),
        tags_en: toStringOrEmpty(data?.tags_en || data?.tags),
        labels: toStringOrEmpty(data?.labels),
        images: Array.isArray(data?.images) ? data.images : [],
        youtubeUrl: toStringOrEmpty(data?.youtubeUrl),
    };
};

const normalizeImages = (images: CarImageForm[]) => {
    const withSort = images.map((img, idx) => ({
        ...img,
        sortOrder: idx,
        isMain: Boolean(img.isMain),
        pathOrUrl: img.pathOrUrl || "",
    })).filter((img) => img.pathOrUrl.trim() !== "");

    let mainSeen = false;
    const singleMain = withSort.map((img) => {
        if (!img.isMain) return img;
        if (mainSeen) return { ...img, isMain: false };
        mainSeen = true;
        return img;
    });

    if (!mainSeen && singleMain.length > 0) {
        singleMain[0] = { ...singleMain[0], isMain: true };
    }

    return singleMain.map((img, idx) => ({ ...img, sortOrder: idx }));
};

export default function CarEditor() {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState<CarForm>(initialForm);
    const [loading, setLoading] = useState(id ? true : false);
    const [error, setError] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [addImageUrl, setAddImageUrl] = useState("");

    const updateImages = (getNext: (prev: CarImageForm[]) => CarImageForm[]) => {
        setForm((prev) => {
            const nextImages = normalizeImages(getNext(prev.images || []));
            return { ...prev, images: nextImages };
        });
    };

    useEffect(() => {
        if (id) {
            client.get(`/cars/${id}`)
                .then(res => {
                    const normalized = normalizeCarDataForForm(res.data);
                    setForm({ ...normalized, images: normalizeImages(normalized.images || []) });
                })
                .catch(err => {
                    console.error("Failed to fetch car", err);
                    toast.error(t('admin.fetch_error'));
                    setError(true);
                })
                .finally(() => setLoading(false));
        }
    }, [id, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setForm(prev => ({ 
            ...prev, 
            [name]: type === 'number' ? (value === "" ? "" : Number(value)) : value 
        }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const formData = new FormData();
        Array.from(e.target.files).forEach(file => formData.append("images", file));

        setUploading(true);
        try {
            const res = await client.post("/upload/images", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            const newImages: CarImageForm[] = res.data.paths.map((path: string, idx: number) => ({
                pathOrUrl: path,
                isMain: false,
                sortOrder: 0
            }));
            updateImages((prev) => [...prev, ...newImages]);
            toast.success("Images uploaded successfully");
        } catch (err) {
            toast.error("Upload failed");
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        updateImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSetMainImage = (index: number) => {
        updateImages((prev) => {
            const next = prev.map((img, i) => ({ ...img, isMain: i === index }));
            const picked = next[index];
            if (!picked) return next;
            const rest = next.filter((_, i) => i !== index);
            return [picked, ...rest];
        });
    };

    const moveImage = (from: number, to: number) => {
        if (from === to) return;
        updateImages((prev) => {
            if (from < 0 || from >= prev.length) return prev;
            if (to < 0 || to >= prev.length) return prev;
            const copy = [...prev];
            const [moved] = copy.splice(from, 1);
            copy.splice(to, 0, moved);
            return copy;
        });
    };

    const handleAddImageByUrl = () => {
        const url = addImageUrl.trim();
        if (!url) return;
        updateImages((prev) => [
            ...prev,
            { pathOrUrl: url, isMain: false, sortOrder: 0 }
        ]);
        setAddImageUrl("");
    };

    const [activeTab, setActiveTab] = useState("ru");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        // Ensure legacy/required fields are populated
        // If "Custom" is selected for dropdowns, try to use the English value as the fallback for the main column
        const processCustomField = (val: string, valEn?: string, valRu?: string) => {
            if (val === "Custom") {
                return valEn || valRu || "Custom";
            }
            return val;
        };

        const safePriceUsd = form.priceUsd === "" ? 0 : form.priceUsd;
        const safeYear = form.year === "" ? 0 : form.year;

        const submissionData = {
            ...form,
            title: form.title || form.title_en || form.title_ru || "Untitled",
            descriptionMd: form.descriptionMd || form.description_en || form.description_ru || "",
            tags: form.tags_en || form.tags || "", // Prefer EN tags for main field
            priceUsd: safePriceUsd,
            year: safeYear,
            
            transmission: processCustomField(form.transmission, form.transmission_en, form.transmission_ru),
            fuelType: processCustomField(form.fuelType, form.fuelType_en, form.fuelType_ru),
            condition: processCustomField(form.condition, form.condition_en, form.condition_ru),
            bodyType: processCustomField(form.bodyType, form.bodyType_en, form.bodyType_ru),
            driveType: processCustomField(form.driveType, form.driveType_en, form.driveType_ru),
            color: processCustomField(form.color, form.color_en, form.color_ru),
        };

        try {
            if (id) {
                await client.put(`/cars/${id}`, submissionData);
                toast.success(t('admin.save_success'));
            } else {
                await client.post("/cars", submissionData);
                toast.success(t('admin.save_success'));
            }
            // Delay navigation slightly so user can see the success message
            setTimeout(() => {
                navigate("/admin/cars");
            }, 1000);
        } catch (err) {
            console.error(err);
            toast.error(t('admin.save_error'));
            setSaving(false); // Only reset saving if error, otherwise keep disabled until navigation
        }
    };

    const getImageUrl = (pathOrUrl: string) => {
        if (pathOrUrl.startsWith('http')) return pathOrUrl;
        const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
        return path;
    };

    if (loading) return (
        <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-96 gap-4">
            <p className="text-destructive font-medium text-lg">{t('admin.fetch_error')}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
                {t('admin.retry', { defaultValue: 'Retry' })}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/admin/cars")}>
                {t('admin.back_to_list', { defaultValue: 'Back to List' })}
            </Button>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-8 pb-20">
            {/* Header with Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-[64px] z-30 bg-background/95 backdrop-blur py-4 border-b -mx-8 px-8 mt-[-2rem]">
                <div className="flex items-center gap-4">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate("/admin/cars")}
                        className="shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{id ? t('admin.edit_vehicle') : t('admin.new_vehicle')}</h1>
                        <p className="text-sm text-muted-foreground">{id ? t('admin.edit_vehicle_desc') : t('admin.new_vehicle_desc')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => navigate("/admin/cars")}
                    >
                        {t('admin.cancel')}
                    </Button>
                    <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {id ? t('admin.save_changes') : t('admin.create_vehicle')}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Details */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{t('admin.basic_info')}</CardTitle>
                                    <CardDescription>{t('admin.basic_info_desc')}</CardDescription>
                                </div>
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[200px]">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="ru">RU</TabsTrigger>
                                        <TabsTrigger value="en">EN</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsContent value="ru" className="mt-0 space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title_ru">{t('admin.vehicle_title_ru')}</Label>
                                        <Input
                                            id="title_ru"
                                            name="title_ru"
                                            value={form.title_ru || ""}
                                            onChange={handleChange}
                                            placeholder={t('admin.vehicle_title_ru')}
                                            className="text-lg"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <TagInput 
                                            label={`${t('admin.tags')} (RU)`}
                                            value={form.tags_ru || ""}
                                            onChange={(val) => setForm(prev => ({ ...prev, tags_ru: val }))}
                                            placeholder={t('admin.tags_placeholder')}
                                        />
                                    </div>
                                </TabsContent>
                                <TabsContent value="en" className="mt-0 space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title_en">{t('admin.vehicle_title_en')}</Label>
                                        <Input
                                            id="title_en"
                                            name="title_en"
                                            value={form.title_en || ""}
                                            onChange={handleChange}
                                            placeholder={t('admin.vehicle_title_en')}
                                            className="text-lg"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <TagInput 
                                            label={`${t('admin.tags')} (EN)`}
                                            value={form.tags_en || ""}
                                            onChange={(val) => setForm(prev => ({ ...prev, tags_en: val }))}
                                            placeholder={t('admin.tags_placeholder')}
                                        />
                                    </div>
                                </TabsContent>
                            </Tabs>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="priceUsd">{t('admin.price_usd')}</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                        <Input
                                            id="priceUsd"
                                            type="number"
                                            name="priceUsd"
                                            value={form.priceUsd}
                                            onChange={handleChange}
                                            className="pl-7"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="status">{t('admin.status')}</Label>
                                    <Select 
                                        value={form.status} 
                                        onValueChange={(val) => handleSelectChange("status", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('admin.select_status')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">{t('admin.status_active')}</SelectItem>
                                            <SelectItem value="sold">{t('admin.status_sold')}</SelectItem>
                                            <SelectItem value="hidden">{t('admin.status_hidden')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                        </CardContent>
                    </Card>

                    {/* Specifications */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin.specifications')}</CardTitle>
                            <CardDescription>{t('admin.specifications_desc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="year">{t('admin.year')}</Label>
                                    <Input
                                        id="year"
                                        type="number"
                                        name="year"
                                        value={form.year}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="mileage">{t('admin.mileage')}</Label>
                                    <Input
                                        id="mileage"
                                        type="number"
                                        name="mileage"
                                        value={form.mileage}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="horsepower">{t('admin.horsepower')}</Label>
                                    <Input
                                        id="horsepower"
                                        type="number"
                                        name="horsepower"
                                        value={form.horsepower}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="topSpeed">{t('admin.top_speed')}</Label>
                                    <Input
                                        id="topSpeed"
                                        type="number"
                                        name="topSpeed"
                                        value={form.topSpeed}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="acceleration">{t('admin.acceleration_0_100')}</Label>
                                    <Input
                                        id="acceleration"
                                        type="number"
                                        step="0.1"
                                        name="acceleration"
                                        value={form.acceleration}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="engineCapacity">{t('admin.engine_capacity')}</Label>
                                    <Input
                                        id="engineCapacity"
                                        name="engineCapacity"
                                        value={form.engineCapacity || ""}
                                        onChange={handleChange}
                                        placeholder="e.g. 4.4L"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <LocalizedSelect
                                    t={t}
                                    label={t('admin.body_type')}
                                    value={form.bodyType}
                                    valueRu={form.bodyType_ru}
                                    valueEn={form.bodyType_en}
                                    fieldName="bodyType"
                                    options={[
                                        { value: "Sedan", label: "Sedan" },
                                        { value: "SUV", label: "SUV" },
                                        { value: "Coupe", label: "Coupe" },
                                        { value: "Hatchback", label: "Hatchback" },
                                        { value: "Convertible", label: "Convertible" },
                                        { value: "Van", label: "Van" },
                                        { value: "Truck", label: "Truck" },
                                    ]}
                                    onChange={handleSelectChange}
                                />
                                <LocalizedSelect
                                    t={t}
                                    label={t('admin.drive_type')}
                                    value={form.driveType}
                                    valueRu={form.driveType_ru}
                                    valueEn={form.driveType_en}
                                    fieldName="driveType"
                                    options={[
                                        { value: "AWD", label: "AWD (All Wheel Drive)" },
                                        { value: "RWD", label: "RWD (Rear Wheel Drive)" },
                                        { value: "FWD", label: "FWD (Front Wheel Drive)" },
                                        { value: "4WD", label: "4WD" },
                                    ]}
                                    onChange={handleSelectChange}
                                />
                                <LocalizedSelect
                                    t={t}
                                    label={t('admin.color')}
                                    value={form.color}
                                    valueRu={form.color_ru}
                                    valueEn={form.color_en}
                                    fieldName="color"
                                    options={[
                                        { value: "White", label: t('color_white') },
                                        { value: "Black", label: t('color_black') },
                                        { value: "Silver", label: t('color_silver') },
                                        { value: "Gray", label: t('color_gray') },
                                        { value: "Blue", label: t('color_blue') },
                                        { value: "Red", label: t('color_red') },
                                        { value: "Green", label: t('color_green') },
                                        { value: "Brown", label: t('color_brown') },
                                        { value: "Beige", label: t('color_beige') },
                                    ]}
                                    onChange={handleSelectChange}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <LocalizedSelect
                                    label={t('admin.transmission')}
                                    value={form.transmission}
                                    valueRu={form.transmission_ru}
                                    valueEn={form.transmission_en}
                                    fieldName="transmission"
                                    options={[
                                        { value: "_empty", label: "—" },
                                        { value: "Automatic", label: t('filter_auto') },
                                        { value: "Manual", label: t('filter_manual') },
                                        { value: "Robot", label: t('filter_robot') },
                                    ]}
                                    onChange={handleSelectChange}
                                    t={t}
                                />
                                <LocalizedSelect
                                    label={t('admin.fuel_type')}
                                    value={form.fuelType}
                                    valueRu={form.fuelType_ru}
                                    valueEn={form.fuelType_en}
                                    fieldName="fuelType"
                                    options={[
                                        { value: "_empty", label: "—" },
                                        { value: "Petrol", label: t('filter_petrol') },
                                        { value: "Diesel", label: t('filter_diesel') },
                                        { value: "Electric", label: t('filter_electric') },
                                        { value: "Hybrid", label: t('filter_hybrid') },
                                    ]}
                                    onChange={handleSelectChange}
                                    t={t}
                                />
                                <LocalizedSelect
                                    label={t('admin.condition')}
                                    value={form.condition}
                                    valueRu={form.condition_ru}
                                    valueEn={form.condition_en}
                                    fieldName="condition"
                                    options={[
                                        { value: "_empty", label: "—" },
                                        { value: "Used", label: t('filter_used') },
                                        { value: "New", label: t('filter_new') },
                                    ]}
                                    onChange={handleSelectChange}
                                    t={t}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin.detailed_description')}</CardTitle>
                            <CardDescription>
                                {t('admin.detailed_description_desc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsContent value="ru" className="mt-0">
                                    <Textarea
                                        name="description_ru"
                                        value={form.description_ru || ""}
                                        onChange={handleChange}
                                        placeholder={t('admin.description_placeholder_ru')}
                                        className="min-h-[200px]"
                                    />
                                </TabsContent>
                                <TabsContent value="en" className="mt-0">
                                    <Textarea
                                        name="description_en"
                                        value={form.description_en || ""}
                                        onChange={handleChange}
                                        placeholder={t('admin.description_placeholder_en')}
                                        className="min-h-[200px]"
                                    />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Media */}
                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin.media_gallery')}</CardTitle>
                            <CardDescription>
                                {t('admin.media_gallery_desc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>{t('admin.images')} ({form.images.length})</Label>
                                    <Button type="button" variant="outline" size="sm" className="cursor-pointer relative" disabled={uploading}>
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                        {t('admin.upload')}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {form.images.map((img, idx) => {
                                        const isDragging = draggingIndex === idx;
                                        const isDragTarget = dragOverIndex === idx && draggingIndex !== null && draggingIndex !== idx;

                                        return (
                                            <div
                                                key={`${img.pathOrUrl}-${idx}`}
                                                draggable
                                                onDragStart={(e) => {
                                                    setDraggingIndex(idx);
                                                    e.dataTransfer.effectAllowed = "move";
                                                    e.dataTransfer.setData("text/plain", String(idx));
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                                                    e.dataTransfer.dropEffect = "move";
                                                }}
                                                onDragLeave={() => {
                                                    if (dragOverIndex === idx) setDragOverIndex(null);
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const from = draggingIndex ?? Number(e.dataTransfer.getData("text/plain"));
                                                    const to = idx;
                                                    if (Number.isFinite(from) && Number.isFinite(to)) moveImage(from, to);
                                                    setDraggingIndex(null);
                                                    setDragOverIndex(null);
                                                }}
                                                onDragEnd={() => {
                                                    setDraggingIndex(null);
                                                    setDragOverIndex(null);
                                                }}
                                                className={[
                                                    "relative group aspect-[4/3] rounded-lg overflow-hidden border bg-muted",
                                                    img.isMain ? "ring-2 ring-primary ring-offset-2" : "",
                                                    isDragTarget ? "ring-2 ring-foreground ring-offset-2" : "",
                                                    isDragging ? "opacity-50" : "",
                                                ].join(" ")}
                                            >
                                                <img
                                                    src={getImageUrl(img.pathOrUrl)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />

                                                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                                                    <div className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                        <GripVertical className="w-3 h-3" />
                                                        {idx + 1}
                                                    </div>
                                                </div>

                                                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                                    {img.isMain && (
                                                        <div className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-medium">
                                                            MAIN
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 opacity-100">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <div className="flex items-center gap-0.5">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant={img.isMain ? "default" : "secondary"}
                                                                onClick={() => handleSetMainImage(idx)}
                                                                className="h-5 w-5 p-0 shrink-0"
                                                                title="Main"
                                                            >
                                                                <Star className={`w-3 h-3 ${img.isMain ? "fill-current" : ""}`} />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => window.open(getImageUrl(img.pathOrUrl), "_blank")}
                                                                className="h-5 w-5 p-0 shrink-0"
                                                                title="Open"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                            </Button>
                                                        </div>

                                                        <div className="flex items-center gap-0.5">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => moveImage(idx, Math.max(0, idx - 1))}
                                                                className="h-5 w-5 p-0 shrink-0"
                                                                disabled={idx === 0}
                                                                title="Move Left"
                                                            >
                                                                <ChevronLeft className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => moveImage(idx, Math.min(form.images.length - 1, idx + 1))}
                                                                className="h-5 w-5 p-0 shrink-0"
                                                                disabled={idx === form.images.length - 1}
                                                                title="Move Right"
                                                            >
                                                                <ChevronRight className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleRemoveImage(idx)}
                                                                className="h-5 w-5 p-0 shrink-0"
                                                                title="Remove"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Upload Placeholder */}
                                    <div className="relative aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/30">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                        <Plus className="w-8 h-8" />
                                        <span className="text-xs font-medium">{t('admin.add_photos')}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="https://..."
                                        value={addImageUrl}
                                        onChange={(e) => setAddImageUrl(e.target.value)}
                                        title={t('admin.add_image_url_hint', { defaultValue: 'Вставьте прямую ссылку на изображение (jpg, png, webp)' })}
                                    />
                                    <Button type="button" variant="secondary" onClick={handleAddImageByUrl}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t('admin.add_image_url_hint_text', { defaultValue: 'Поддерживаются прямые ссылки на изображения. Убедитесь, что ссылка доступна публично.' })}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
