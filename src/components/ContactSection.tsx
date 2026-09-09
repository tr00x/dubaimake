import React, { useState } from "react";
import { Phone, Mail, MapPin, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { toast } from "sonner";
import { useContactGuard, CaptchaField } from "./ContactGuard";

interface ContactItemProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function ContactItem({ icon, label, children }: ContactItemProps) {
  return (
    <div className="flex gap-4 items-start w-full group">
       <div className="w-10 h-10 rounded-xl bg-muted/50 text-foreground flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
           {icon}
       </div>
       <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          <div className="text-base text-foreground font-medium leading-relaxed">
             {children}
          </div>
       </div>
    </div>
  );
}

export default function ContactSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    message: ""
  });
  const guard = useContactGuard(true);

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
      const contactInfo = `Phone: ${formData.phone}${formData.email ? `, Email: ${formData.email}` : ""}`;
      await guard.waitForMinDelay();

      await client.post('/contact', {
        name: formData.name,
        contact: contactInfo,
        message: formData.message,
        link: window.location.href,
        source: 'Contact Form',
        ...guard.payload(),
      });

      toast.success(t('contact.form.success'));
      setFormData({ name: "", phone: "", email: "", message: "" });
      guard.refresh();
    } catch (error) {
      console.error(error);
      toast.error(guard.handleError(error, t('contact.form.error')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contacts" className="container mx-auto px-4 md:px-10 py-16 md:py-24 flex flex-col lg:flex-row gap-10 lg:gap-20 items-start overflow-hidden">
      {/* Contact Info */}
      <motion.div 
        className="flex flex-col gap-10 w-full lg:w-[450px] shrink-0"
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
          <div className="flex flex-col gap-3">
              <span className="uppercase tracking-widest text-muted-foreground text-xs font-semibold">{t('contact.label')}</span>
              <h2 className="text-3xl md:text-4xl font-medium text-foreground leading-tight">{t('contact.title')}</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                  {t('contact.subtitle')}
              </p>
          </div>
          
          <div className="flex flex-col gap-8">
             <ContactItem icon={<Phone className="w-5 h-5" />} label={t('contact.phone_label')}>
                 <div className="flex flex-col gap-1">
                    <a href="tel:+971544050707" className="hover:text-primary transition-colors">+971 54 405 0707</a>
                    <a href="tel:+971544050303" className="hover:text-primary transition-colors">+971 54 405 0303</a>
                    <span className="text-muted-foreground">{t('contact.office_phone')}</span>
                 </div>
             </ContactItem>

             <ContactItem icon={<Mail className="w-5 h-5" />} label={t('contact.email_label')}>
                 <a href="mailto:info@mashynbazar.com" className="hover:text-primary transition-colors">info@mashynbazar.com</a>
                 <div className="text-muted-foreground text-sm">{t('contact.cooperation')}</div>
             </ContactItem>

             <ContactItem icon={<MapPin className="w-5 h-5" />} label={t('contact.office_label')}>
                 <p>{t('contact.office_city')}</p>
                 <p className="text-muted-foreground text-sm">{t('contact.office_address')}</p>
             </ContactItem>

             <ContactItem icon={<Clock className="w-5 h-5" />} label={t('contact.hours_label')}>
                 <p>{t('header.working_hours')}</p>
                 <p className="text-muted-foreground text-sm">{t('header.sunday_off')}</p>
             </ContactItem>
          </div>
      </motion.div>

      {/* Contact Form */}
      <motion.div 
        className="w-full bg-card rounded-3xl p-6 md:p-10 border border-border"
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
               <h3 className="text-2xl font-medium text-foreground">{t('contact.form.title')}</h3>
               <p className="text-muted-foreground">{t('contact.form.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">{t('contact.form.name')}</label>
                  <input 
                    type="text" 
                    id="name"
                    required
                    className="h-12 px-4 rounded-xl bg-background border border-border focus:border-ring focus:ring-1 focus:ring-ring outline-none transition-all"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
               </div>
               <div className="flex flex-col gap-2">
                  <label htmlFor="phone" className="text-sm font-medium text-foreground">{t('contact.form.phone')}</label>
                  <input 
                    type="tel" 
                    id="phone"
                    required
                    className="h-12 px-4 rounded-xl bg-background border border-border focus:border-ring focus:ring-1 focus:ring-ring outline-none transition-all"
                    placeholder="+971 50 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
               </div>
            </div>

            <div className="flex flex-col gap-2">
               <label htmlFor="email" className="text-sm font-medium text-foreground">{t('contact.form.email')}</label>
               <input 
                 type="email" 
                 id="email"
                 className="h-12 px-4 rounded-xl bg-background border border-border focus:border-ring focus:ring-1 focus:ring-ring outline-none transition-all"
                 placeholder="example@mail.com"
                 value={formData.email}
                 onChange={(e) => setFormData({...formData, email: e.target.value})}
               />
            </div>

            <div className="flex flex-col gap-2">
               <label htmlFor="message" className="text-sm font-medium text-foreground">{t('contact.form.message')}</label>
               <textarea 
                 id="message"
                 rows={4}
                 className="p-4 rounded-xl bg-background border border-border focus:border-ring focus:ring-1 focus:ring-ring outline-none transition-all resize-none"
                 placeholder={t('contact.form.message')}
                 value={formData.message}
                 onChange={(e) => setFormData({...formData, message: e.target.value})}
               />
            </div>

            <CaptchaField guard={guard} variant="form" />

            <button 
              type="submit" 
              disabled={loading || guard.loading}
              className="mt-2 h-12 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? t('contact.form.sending') : t('contact.form.submit')}
            </button>
            
            <p className="text-xs text-muted-foreground text-center mt-2">
              {t('contact.form.agreement')}
            </p>
        </form>
      </motion.div>
    </section>
  );
}
