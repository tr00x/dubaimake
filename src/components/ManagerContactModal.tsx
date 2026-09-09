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
      <DialogContent className="sm:max-w-[400px] p-5 gap-0 overflow-hidden">
        <DialogHeader className="text-center space-y-1 pb-4">
          <DialogTitle className="text-xl font-bold">{t('contact.modal.title')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('contact.modal.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button"
              className="group flex w-full items-center justify-center gap-2 h-12 bg-muted/50 hover:bg-[#25D366] rounded-xl transition-all duration-300 border border-transparent hover:border-[#25D366] outline-none"
              onClick={handleWhatsAppClick}
            >
              <WhatsAppIcon className="w-5 h-5 transition-colors duration-300 fill-[#25D366] group-hover:fill-white" />
              <span 
                className="font-bold text-sm transition-colors duration-300 text-[#25D366] group-hover:text-white"
              >
                WhatsApp
              </span>
            </button>
            <button 
              type="button"
              className="group flex w-full items-center justify-center gap-2 h-12 bg-muted/50 hover:bg-[#229ED9] rounded-xl transition-all duration-300 border border-transparent hover:border-[#229ED9] outline-none"
              onClick={handleTelegramClick}
            >
              <TelegramIcon className="w-5 h-5 transition-colors duration-300 fill-[#229ED9] group-hover:fill-white" />
              <span 
                className="font-bold text-sm transition-colors duration-300 text-[#229ED9] group-hover:text-white"
              >
                Telegram
              </span>
            </button>
          </div>
          
          <div className="relative py-2">
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

        <form onSubmit={handleSubmit} className="grid gap-3 pt-2">
          {carTitle && (
            <div className="bg-secondary/30 border border-border/50 rounded-lg p-3 flex items-center gap-4 relative overflow-hidden group">
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
            <div className="space-y-1">
              <div className="bg-background rounded-lg border border-foreground/20 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/20 transition-all flex items-center gap-3 px-3 h-10">
                <User className="w-4 h-4 text-muted-foreground" />
                <input
                  id="name"
                  placeholder={t('contact.modal.name_placeholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="bg-background rounded-lg border border-foreground/20 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/20 transition-all flex items-center gap-3 px-3 h-10 shadow-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <input
                  id="contact"
                  placeholder={t('contact.modal.contact_placeholder')}
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  required
                  className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="bg-background rounded-lg border border-foreground/20 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/20 transition-all flex gap-3 px-3 py-2.5 shadow-sm">
                <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
                <textarea
                  id="message"
                  placeholder={t('contact.modal.message_placeholder')}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground min-h-[60px] resize-none"
                  required
                />
              </div>
            </div>
          </div>

          <CaptchaField guard={guard} variant="modal" />

          <button 
            type="submit" 
            disabled={loading || guard.loading} 
            className="mt-1 w-full flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 h-10 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{t('contact.modal.submit')}</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}