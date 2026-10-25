"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Copies text; true when it worked. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "Copied" for a moment after a successful copy. */
function useCopied() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [
    copied,
    () => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    },
  ] as const;
}

/** Confirmation mark next to "Tersalin". */
function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** The page's own address without query or hash. */
function currentUrl() {
  return window.location.origin + window.location.pathname;
}

/** A read-only link with a copy button ("Bagikan profil ini"). */
export function CopyLinkField({
  url,
  display,
  label,
  className,
}: {
  url: string;
  /** Shorter text to show, e.g. without "https://". */
  display: string;
  label: string;
  className?: string;
}) {
  const t = useTranslations("share");
  const [copied, markCopied] = useCopied();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="flex h-11 min-w-0 grow items-center rounded-md border border-border bg-surface px-3 text-sm"
        title={url}
      >
        <span className="truncate">{display}</span>
      </span>
      <button
        type="button"
        aria-label={`${t("copy")}: ${label}`}
        onClick={async () => {
          if (await copyText(url)) markCopied();
        }}
        className={buttonStyles({ variant: "outline", className: "min-w-28" })}
      >
        {copied ? (
          <>
            <CheckIcon />
            {t("copied")}
          </>
        ) : (
          t("copy")
        )}
      </button>
      <span role="status" className="sr-only">
        {copied ? t("copiedAnnouncement") : ""}
      </span>
    </div>
  );
}

/** Round share button: the system share sheet when there is one, otherwise copies the link. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("share");
  const [copied, markCopied] = useCopied();

  async function share() {
    const url = currentUrl();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the sheet is not an error; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    if (await copyText(url)) markCopied();
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={share}
        aria-label={t("share")}
        className={buttonStyles({ variant: "outline", size: "lg", className: "w-12 px-0" })}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
          <path d="M12 3v12M7 8l5-5 5 5" />
        </svg>
      </button>
      {/* The visible note keeps its text while it fades out; the status below does the announcing. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-full right-0 mt-2 rounded-md bg-ink px-3 py-1.5 text-sm whitespace-nowrap text-bg transition-opacity",
          copied ? "opacity-100" : "opacity-0",
        )}
      >
        {t("copiedAnnouncement")}
      </span>
      <span role="status" className="sr-only">
        {copied ? t("copiedAnnouncement") : ""}
      </span>
    </span>
  );
}
