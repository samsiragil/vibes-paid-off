"use client";

import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from "react";
import type { TurnstileAction } from "@/lib/turnstile";

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "auto" | "light" | "dark";
      language: string;
      size: "flexible" | "normal";
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const scriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing"));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export type TurnstileHandle = {
  /** Tokens are single use: reset after every submit attempt (and drop the old token). */
  reset(): void;
};

/** Cloudflare Turnstile widget (explicit render). Reports the token, or null when it expires. */
export function Turnstile({
  siteKey,
  action,
  language,
  onToken,
  ref,
}: {
  siteKey: string;
  /** Checked again by verifyTurnstile, so a token only works for the form it was solved on. */
  action: TurnstileAction;
  language: string;
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const report = useEffectEvent(onToken);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => report(token),
          "expired-callback": () => report(null),
          "error-callback": () => report(null),
          theme: "auto",
          language,
          size: "flexible",
        });
      })
      .catch(() => report(null));

    return () => {
      cancelled = true;
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey, action, language]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetRef.current) window.turnstile?.reset(widgetRef.current);
    },
  }));

  return <div ref={containerRef} className="min-h-[65px] w-full max-w-[300px]" />;
}
