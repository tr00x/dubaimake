import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { Send, Car, User, MessageSquare, Loader2, Phone } from "lucide-react";
import client from "../api/client";
import { WhatsAppIcon, TelegramIcon } from "./ui/Icons";
import { useTranslation } from "react-i18next";
import { useContactGuard, CaptchaField } from "./ContactGuard";

interface ManagerContactModalProps {
  carTitle?: string;
  carId?: string;
  carPrice?: string;
  carImage?: string;
  children: React.ReactNode;
}

export default function ManagerContactModal({
  carTitle,
  carId,
  carPrice,
  carImage,
  children,
}: ManagerContactModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactInfo, setContactInfo] = useState({ whatsapp: '', telegram: '' });
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    message: "",
  });
  const guard = useContactGuard(open);

  React.useEffect(() => {
    if (open) {
      client.get('/contact-info')
        .then(res => setContactInfo(res.data))
        .catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guard.challenge) {
      toast.error(t('contact.captcha.error_expired'));
      guard.refresh();
      return;
    }
    if (!guard.ready) {
      toast.error(t('contact.captcha.error_wrong'));
      return;
    }
    setLoading(true);

    try {
      await guard.waitForMinDelay();
      await client.post('/contact', {
        ...formData,
        carTitle,
        carId,
        carPrice,
        carImage,
        link: window.location.href,
        source: 'Manager Button (Modal)',
        ...guard.payload(),
      });

      toast.success(t('contact.modal.success'));
      setOpen(false);
      setFormData({ name: "", contact: "", message: "" });
    } catch (error) {
      console.error(error);
      toast.error(guard.handleError(error, t('contact.modal.error')));
    } finally {
      setLoading(false);
    }
  };

  const getMessageText = () => {
    if (carTitle) {
      return t('contact.modal.whatsapp_message', { title: carTitle, price: carPrice, url: window.location.href });
    }
    return t('contact.modal.whatsapp_message_general');
  };

  const handleWhatsAppClick = () => {
    const text = encodeURIComponent(getMessageText());
    const waValue = contactInfo.whatsapp || '1234567890';
    let url = '';
    
    // Normalize input: remove spaces, dashes, parentheses, plus signs
    // Also remove 'wa.me/', 'https://', etc if user pasted a full link
    let cleanNumber = waValue.replace(/\s+|-|\(|\)|\+/g, '');
    
    // If it contains wa.me, strip everything before it and the slash
    if (cleanNumber.includes('wa.me')) {
        cleanNumber = cleanNumber.split('wa.me/')[1] || cleanNumber;
    }
    // Remove http/https if still present (though unlikely after wa.me check)
    cleanNumber = cleanNumber.replace(/^https?:\/\//, '');
    
    // Remove any non-digits that might still remain (like query params if they pasted a full url with params)
    // But we want to be careful if they pasted a link with text... 
    // The user instruction says "just number", so let's enforce digits only for the cleanest result.
    cleanNumber = cleanNumber.replace(/[^\d]/g, '');

    url = `https://wa.me/${cleanNumber}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleTelegramClick = () => {
    const text = encodeURIComponent(getMessageText());
    const tgValue = contactInfo.telegram || 'tr00x';
    let url = '';

    // Normalize input
    let username = tgValue.trim();
    
    // Remove https://t.me/ or t.me/
    username = username.replace(/^(https?:\/\/)?(t\.me\/)/, '');
    
    // Remove @ if present
    username = username.replace(/^@/, '');
    
    // Remove any trailing slashes or query params if user pasted full URL
    username = username.split('?')[0].replace(/\/$/, '');

    url = `https://t.me/${username}?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] p-6 gap-0 rounded-3xl overflow-hidden">
        <DialogHeader className="text-center space-y-1.5 pb-5">
          <DialogTitle className="display-md">{t('contact.modal.title')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('contact.modal.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="btn group bg-surface-2 hover:bg-[#25D366] border border-transparent hover:border-[#25D366]"
              onClick={handleWhatsAppClick}
            >
              <WhatsAppIcon className="w-5 h-5 transition-colors duration-300 fill-[#25D366] group-hover:fill-white" />
              <span
                className="transition-colors duration-300 text-[#25D366] group-hover:text-white"
              >
                WhatsApp
              </span>
            </button>
            <button
              type="button"
              className="btn group bg-surface-2 hover:bg-[#229ED9] border border-transparent hover:border-[#229ED9]"
              onClick={handleTelegramClick}
            >
              <TelegramIcon className="w-5 h-5 transition-colors duration-300 fill-[#229ED9] group-hover:fill-white" />
              <span
                className="transition-colors duration-300 text-[#229ED9] group-hover:text-white"
              >
                Telegram
              </span>
            </button>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
              <span className="bg-background px-3 text-muted-foreground">
                {t('contact.modal.or_form')}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3 pt-3">
          {carTitle && (
            <div className="bg-surface-2 rounded-xl p-3 flex items-center gap-4 relative overflow-hidden group">
              <div
                className="absolute right-0 top-0 pointer-events-none translate-x-1/3 -translate-y-1/4 w-[80px] h-[80px]"
              >
                 <Car
                   className="w-full h-full text-foreground/5"
                 />
              </div>
              <div className="z-10 bg-background/80 p-1.5 rounded-md">
                <Car className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex flex-col z-10 min-w-0">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{t('contact.modal.interested_in')}</span>
                <span className="text-sm font-bold text-foreground leading-tight truncate">{carTitle}</span>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="name"
                placeholder={t('contact.modal.name_placeholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="field h-11 pl-10"
              />
            </div>

            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="contact"
                placeholder={t('contact.modal.contact_placeholder')}
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                required
                className="field h-11 pl-10"
              />
            </div>

            <div className="relative">
              <MessageSquare className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <textarea
                id="message"
                placeholder={t('contact.modal.message_placeholder')}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="field min-h-[80px] pl-10 pt-3"
                required
              />
            </div>
          </div>

          <CaptchaField guard={guard} variant="modal" />

          <button
            type="submit"
            disabled={loading || guard.loading}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{t('contact.modal.submit')}</span>
                <Send className="btn-icon w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}