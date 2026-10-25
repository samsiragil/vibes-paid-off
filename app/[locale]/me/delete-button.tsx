"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui/button";
import { deleteProject, type DeleteProjectResult } from "@/lib/projects/delete";

/**
 * "Hapus" on a /me row. Always asks first in a small panel under the button, since deleting
 * cannot be undone; the row disappears when the page re-renders after the action.
 */
export function DeleteButton({ projectId, title }: { projectId: string; title: string }) {
  const t = useTranslations("me.delete");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<Exclude<DeleteProjectResult, { ok: true }>["error"] | null>(
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

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProject(projectId);
      if (!result.ok) setError(result.error);
      setConfirming(false);
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        disabled={pending}
        aria-expanded={confirming}
        aria-controls={panelId}
        onClick={() => setConfirming((open) => !open)}
        className={buttonStyles({
          variant: "ghost",
          size: "sm",
          className: "h-11 px-3.5 text-danger lg:h-[38px]",
        })}
      >
        {pending ? t("deleting") : t("delete")}
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
          className="fixed inset-x-4 bottom-4 z-20 flex motion-pop flex-col gap-3 rounded border border-border-strong bg-surface p-4 text-left text-base leading-6 shadow-[0_2px_0_var(--border)] lg:absolute lg:inset-x-auto lg:top-full lg:right-0 lg:bottom-auto lg:mt-2 lg:w-72"
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
              onClick={run}
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
