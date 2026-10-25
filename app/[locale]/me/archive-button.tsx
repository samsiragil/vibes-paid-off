"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui/button";
import { setProjectArchived, type ArchiveProjectResult } from "@/lib/projects/archive";

/**
 * "Arsipkan" / "Aktifkan lagi" on a /me row (Q8). Archiving asks first in a small panel under
 * the button; reactivating does not. The page re-renders with the new status after the action.
 */
export function ArchiveButton({
  projectId,
  title,
  archived,
}: {
  projectId: string;
  title: string;
  archived: boolean;
}) {
  const t = useTranslations("me.archive");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<Exclude<ArchiveProjectResult, { ok: true }>["error"] | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function close() {
    setConfirming(false);
    triggerRef.current?.focus();
  }

  function run(nextArchived: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setProjectArchived(projectId, nextArchived);
      if (!result.ok) setError(result.error);
      setConfirming(false);
    });
  }

  const buttonClass = buttonStyles({
    variant: "ghost",
    size: "sm",
    className: "h-11 px-3.5 text-ink-2 lg:h-[38px]",
  });

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        disabled={pending}
        aria-expanded={archived ? undefined : confirming}
        aria-controls={archived ? undefined : panelId}
        onClick={() => (archived ? run(false) : setConfirming((open) => !open))}
        className={buttonClass}
      >
        {pending ? t("saving") : archived ? t("unarchive") : t("archive")}
        <span className="sr-only">: {title}</span>
      </button>

      {confirming ? (
        <div
          id={panelId}
          role="group"
          aria-label={t("confirmLabel", { title })}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="fixed inset-x-4 bottom-4 z-20 flex flex-col gap-3 rounded border border-border-strong bg-surface p-4 text-left text-base leading-6 shadow-[0_2px_0_var(--border)] lg:absolute lg:inset-x-auto lg:top-full lg:right-0 lg:bottom-auto lg:mt-2 lg:w-72"
        >
          <p>{t("confirm")}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              {t("cancel")}
            </button>
            <button
              ref={confirmRef}
              type="button"
              disabled={pending}
              onClick={() => run(true)}
              className={buttonStyles({ variant: "primary", size: "sm" })}
            >
              {t("confirmYes")}
            </button>
          </div>
        </div>
      ) : null}

      <span
        role="alert"
        className="absolute top-full left-0 mt-1 w-56 text-sm text-danger lg:right-0 lg:left-auto lg:text-right"
      >
        {error ? t(`errors.${error}`) : ""}
      </span>
    </span>
  );
}
