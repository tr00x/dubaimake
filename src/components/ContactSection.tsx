import React, { useState } from "react";
import { Phone, Mail, MapPin, Clock, Loader2, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { toast } from "sonner";
import { useContactGuard, CaptchaField } from "./ContactGuard";
import { Reveal, Stagger, Item } from "./motion/Reveal";

interface ContactItemProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function ContactItem({ icon, label, children }: ContactItemProps) {
  return (
    <div className="flex w-full items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1 pt-0.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex flex-col gap-0.5 text-base font-medium leading-relaxed text-foreground">{children}</div>
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
    message: "",
  });
  const guard = useContactGuard(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guard.challenge) {
      toast.error(t("contact.captcha.error_expired"));
      guard.refresh();
      return;
    }
    if (!guard.ready) {
      toast.error(t("contact.captcha.error_wrong"));
      return;
    }
    setLoading(true);

    try {
      const contactInfo = `Phone: ${formData.phone}${formData.email ? `, Email: ${formData.email}` : ""}`;
      await guard.waitForMinDelay();

      await client.post("/contact", {
        name: formData.name,
        contact: contactInfo,
        message: formData.message,
        link: window.location.href,
        source: "Contact Form",
        ...guard.payload(),
      });

      toast.success(t("contact.form.success"));
      setFormData({ name: "", phone: "", email: "", message: "" });
      guard.refresh();
    } catch (error) {
      console.error(error);
      toast.error(guard.handleError(error, t("contact.form.error")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contacts" className="section container-x scroll-mt-24">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Contact info */}
        <div className="lg:col-span-5">
          <Stagger className="flex flex-col gap-10">
            <Item className="flex flex-col gap-4">
              <span className="eyebrow">{t("contact.label")}</span>
              <h2 className="display-lg">{t("contact.title")}</h2>
              <p className="lead">{t("contact.subtitle")}</p>
            </Item>

            <div className="flex flex-col gap-7">
              <Item>
                <ContactItem icon={<Phone className="h-5 w-5" />} label={t("contact.phone_label")}>
                  <a href="tel:+971544050707" className="transition-colors duration-300 hover:text-brand">
                    +971 54 405 0707
                  </a>
                  <a href="tel:+971544050303" className="transition-colors duration-300 hover:text-brand">
                    +971 54 405 0303
                  </a>
                  <span className="text-sm font-normal text-muted-foreground">{t("contact.office_phone")}</span>
                </ContactItem>
              </Item>

              <Item>
                <ContactItem icon={<Mail className="h-5 w-5" />} label={t("contact.email_label")}>
                  <a href="mailto:info@mashynbazar.com" className="transition-colors duration-300 hover:text-brand">
                    info@mashynbazar.com
                  </a>
                  <span className="text-sm font-normal text-muted-foreground">{t("contact.cooperation")}</span>
                </ContactItem>
              </Item>

              <Item>
                <ContactItem icon={<MapPin className="h-5 w-5" />} label={t("contact.office_label")}>
                  <span>{t("contact.office_city")}</span>
                  <span className="text-sm font-normal text-muted-foreground">{t("contact.office_address")}</span>
                </ContactItem>
              </Item>

              <Item>
                <ContactItem icon={<Clock className="h-5 w-5" />} label={t("contact.hours_label")}>
                  <span>{t("header.working_hours")}</span>
                  <span className="text-sm font-normal text-muted-foreground">{t("header.sunday_off")}</span>
                </ContactItem>
              </Item>
            </div>
          </Stagger>
        </div>

        {/* Contact form */}
        <div className="lg:col-span-7">
          <Reveal delay={0.1}>
            <div className="rounded-3xl bg-surface p-6 shadow-md md:p-10">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <h3 className="display-md">{t("contact.form.title")}</h3>
                  <p className="text-muted-foreground">{t("contact.form.subtitle")}</p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="text-sm font-semibold text-foreground">
                      {t("contact.form.name")}
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      className="field"
                      placeholder={t("contact.form.name_placeholder")}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="phone" className="text-sm font-semibold text-foreground">
                      {t("contact.form.phone")}
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      required
                      className="field"
                      placeholder="+971 50 000 0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="text-sm font-semibold text-foreground">
                    {t("contact.form.email")}
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="field"
                    placeholder="example@mail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="message" className="text-sm font-semibold text-foreground">
                    {t("contact.form.message")}
                  </label>
                  <textarea
                    id="message"
                    className="field min-h-[140px]"
                    placeholder={t("contact.form.message")}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <CaptchaField guard={guard} variant="form" />

                <button
                  type="submit"
                  disabled={loading || guard.loading}
                  className="btn btn-primary btn-lg w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("contact.form.sending")}
                    </>
                  ) : (
                    <>
                      {t("contact.form.submit")}
                      <ArrowRight className="btn-icon h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="mt-1 text-center text-xs text-muted-foreground">{t("contact.form.agreement")}</p>
              </form>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
