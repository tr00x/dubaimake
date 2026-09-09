import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import client from "../api/client";

/**
 * Client side of the contact-form anti-spam layer.
 *
 * - fetches a signed challenge from /api/contact/challenge
 * - renders the captcha it asks for (built-in image or Cloudflare Turnstile)
 * - keeps a hidden honeypot field
 * - exposes `payload()` to merge into the POST body and `handleError()` to
 *   translate server error codes and refresh the challenge.
 */

export type Challenge = {
  token: string;
  minDelayMs: number;
  captcha:
    | { type: "turnstile"; siteKey: string }
    | { type: "image"; svg: string }
    | { type: "none" };
};

const HONEYPOT_FIELD = "website";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let turnstileLoader: Promise<void> | null = null;
const loadTurnstile = (): Promise<void> => {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileLoader) {
    turnstileLoader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        turnstileLoader = null;
        reject(new Error("turnstile_load_failed"));
      };
      document.head.appendChild(script);
    });
  }
  return turnstileLoader;
};

export function useContactGuard(active: boolean = true) {
  const { t } = useTranslation();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [answer, setAnswer] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const issuedAt = useRef<number>(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setAnswer("");
    setTurnstileToken("");
    try {
      const res = await client.get<Challenge>("/contact/challenge", {
        params: { _: Date.now() },
        headers: { "Cache-Control": "no-cache" },
      });
      setChallenge(res.data);
      issuedAt.current = Date.now();
    } catch (error) {
      console.error("Failed to load contact challenge", error);
      setChallenge(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      refresh();
    } else {
      setChallenge(null);
      setAnswer("");
      setTurnstileToken("");
    }
  }, [active, refresh]);

  /** True when the user has done everything the captcha requires. */
  const ready =
    !!challenge &&
    (challenge.captcha.type === "none" ||
      (challenge.captcha.type === "image" && answer.trim().length > 0) ||
      (challenge.captcha.type === "turnstile" && turnstileToken.length > 0));

  /** Fields to merge into the POST /api/contact body. */
  const payload = useCallback(
    () => ({
      challengeToken: challenge?.token ?? "",
      captchaAnswer: answer,
      turnstileToken,
      [HONEYPOT_FIELD]: honeypot,
    }),
    [challenge, answer, turnstileToken, honeypot]
  );

  /** Wait until the server-side minimum delay has passed (cheap, avoids a needless round-trip). */
  const waitForMinDelay = useCallback(async () => {
    if (!challenge) return;
    const elapsed = Date.now() - issuedAt.current;
    const remaining = challenge.minDelayMs - elapsed;
    if (remaining > 0) {
      await new Promise((r) => setTimeout(r, remaining + 50));
    }
  }, [challenge]);

  /**
   * Map a failed submit to a user-facing message and refresh the challenge
   * (tokens are single-use). Returns the message to show.
   */
  const handleError = useCallback(
    (error: unknown, fallback: string): string => {
      const code: string | undefined = (error as any)?.response?.data?.error;
      const status: number | undefined = (error as any)?.response?.status;
      refresh();
      if (status === 429 || code === "too_many_requests") return t("contact.captcha.error_rate");
      switch (code) {
        case "captcha_failed":
        case "captcha_required":
          return t("contact.captcha.error_wrong");
        case "challenge_missing":
        case "challenge_invalid":
        case "challenge_expired":
        case "challenge_used":
        case "challenge_too_fast":
          return t("contact.captcha.error_expired");
        case "captcha_unavailable":
          return t("contact.captcha.error_unavailable");
        default:
          return fallback;
      }
    },
    [refresh, t]
  );

  return {
    challenge,
    loading,
    loadError,
    answer,
    setAnswer,
    turnstileToken,
    setTurnstileToken,
    honeypot,
    setHoneypot,
    ready,
    refresh,
    payload,
    waitForMinDelay,
    handleError,
  };
}

export type ContactGuard = ReturnType<typeof useContactGuard>;

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string) => void;
  onError: () => void;
  language: string;
}

function TurnstileWidget({ siteKey, onToken, onError, language }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          language: language.startsWith("ru") ? "ru" : "en",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            onError();
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          onError();
        }
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
      }
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, language]);

  if (failed) return null;
  return <div ref={containerRef} className="min-h-[65px]" />;
}

interface CaptchaFieldProps {
  guard: ContactGuard;
  /** "form" = large contact section, "modal" = compact manager modal */
  variant?: "form" | "modal";
}

/**
 * Renders the honeypot + whichever captcha the server asked for.
 * Place it inside the <form>, before the submit button.
 */
export function CaptchaField({ guard, variant = "form" }: CaptchaFieldProps) {
  const { t, i18n } = useTranslation();
  const { challenge, loading, loadError, answer, setAnswer, honeypot, setHoneypot, refresh, setTurnstileToken } = guard;
  const compact = variant === "modal";
  const inputId = `captcha-answer-${variant}`;

  const inputClass = compact ? "field h-14" : "field h-[76px]";

  return (
    <>
      {/* Honeypot: hidden from humans, filled by naive bots */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", top: "auto", width: "1px", height: "1px", overflow: "hidden" }}
      >
        <label htmlFor={`${HONEYPOT_FIELD}-${variant}`}>Website</label>
        <input
          type="text"
          id={`${HONEYPOT_FIELD}-${variant}`}
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {loadError && (
        <div className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 ${compact ? "text-xs" : "text-sm"} text-muted-foreground`}>
          <span>{t("contact.captcha.load_error")}</span>
          <button type="button" onClick={refresh} className="inline-flex items-center gap-1 text-foreground hover:underline">
            <RefreshCw className="w-3.5 h-3.5" />
            {t("contact.captcha.retry")}
          </button>
        </div>
      )}

      {!loadError && loading && !challenge && (
        <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} text-muted-foreground`}>
          <ShieldCheck className="w-4 h-4 animate-pulse" />
          {t("contact.captcha.loading")}
        </div>
      )}

      {challenge?.captcha.type === "image" && (
        <div className="flex flex-col gap-2.5">
          <label htmlFor={inputId} className={compact ? "text-xs font-semibold text-muted-foreground" : "text-sm font-semibold text-foreground"}>
            {t("contact.captcha.label")}
          </label>
          <div className={`flex flex-col gap-3 ${compact ? "" : "sm:flex-row sm:items-stretch"}`}>
            <div className="flex items-stretch gap-2">
              <div
                className={`flex-1 select-none overflow-hidden rounded-xl border border-border bg-[#f4f4f5] [&_svg]:block [&_svg]:h-full [&_svg]:w-full ${
                  compact ? "h-16 max-w-[240px]" : "h-[76px] sm:w-[240px] sm:flex-none"
                }`}
                role="img"
                aria-label={t("contact.captcha.image_alt")}
                dangerouslySetInnerHTML={{ __html: challenge.captcha.svg }}
              />
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                aria-label={t("contact.captcha.refresh")}
                title={t("contact.captcha.refresh")}
                className={`icon-btn shrink-0 rounded-xl ${compact ? "h-16 w-14" : "h-[76px] w-16"}`}
              >
                <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="relative flex-1">
              <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                id={inputId}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={t("contact.captcha.placeholder")}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                maxLength={8}
                required
                className={`${inputClass} pl-12 text-lg font-semibold tracking-[0.2em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal`}
              />
            </div>
          </div>
        </div>
      )}

      {challenge?.captcha.type === "turnstile" && (
        <div className={compact ? "flex justify-center" : ""}>
          <TurnstileWidget
            key={challenge.token}
            siteKey={challenge.captcha.siteKey}
            language={i18n.language}
            onToken={setTurnstileToken}
            onError={() => {
              /* the submit handler will surface the server error and refresh */
            }}
          />
        </div>
      )}
    </>
  );
}
