"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui/button";
import {
  resolveReport,
  setMakerTrusted,
  type ResolveReportResult,
  type SetTrustedResult,
} from "@/lib/admin/actions";
import type { ReportAction } from "@/lib/validation/admin";
import { useActionLog } from "./action-log";

type ErrorCode =
  | Exclude<ResolveReportResult, { ok: true }>["error"]
  | Exclude<SetTrustedResult, { ok: true }>["error"];

/**
 * Verdicts on one reported project or reply (VPO-Admin): Pulihkan or Biarkan (keep), Sembunyikan
 * (hide), Hapus (remove, asks first), plus revoking the maker's trusted status on its own.
 */
export function ReportActions({
  targetType,
  targetId,
  label,
  hidden,
  missing,
  person,
}: {
  targetType: "project" | "comment";
  targetId: string;
  label: string;
  hidden: boolean;
  missing: boolean;
  person: { id: string; username: string | null; isTrusted: boolean } | null;
}) {
  const t = useTranslations("admin.reports");
  const log = useActionLog();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [trusted, setTrusted] = useState(person?.isTrusted ?? false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const removeRef = useRef<HTMLButtonElement>(null);

  function resolve(action: ReportAction) {
    setError(null);
    startTransition(async () => {
      const result = await resolveReport({ targetType, targetId, action });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const verdict = action === "keep" && hidden ? "restored" : action;
      log(t(`done.${verdict}`, { label }));
    });
  }

  function toggleTrust() {
    if (!person) return;
    setError(null);
    startTransition(async () => {
      const next = !trusted;
      const result = await setMakerTrusted({ profileId: person.id, trusted: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTrusted(next);
      log(t(next ? "done.trustGranted" : "done.trustRevoked", { name: `@${person.username}` }));
    });
  }

  const outline = buttonStyles({ variant: "outline" });
  const sr = <span className="sr-only">: {label}</span>;

  return (
    <div className="flex shrink-0 flex-col gap-2 xl:items-end">
      <div className="flex flex-wrap gap-2 xl:justify-end">
        {missing ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => resolve("keep")}
            className={outline}
          >
            {t("actions.close")}
            {sr}
          </button>
        ) : confirmRemove ? (
          <div
            role="group"
            aria-label={t("actions.confirmRemoveLabel", { label })}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm">{t("actions.confirmRemove")}</span>
            <button
              type="button"
              onClick={() => {
                setConfirmRemove(false);
                requestAnimationFrame(() => removeRef.current?.focus());
              }}
              className={buttonStyles({ variant: "outline" })}
            >
              {t("actions.cancel")}
            </button>
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => resolve("remove")}
              className={buttonStyles({ variant: "primary" })}
            >
              {t("actions.confirmRemoveYes")}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve("keep")}
              className={outline}
            >
              {hidden ? t("actions.restore") : t("actions.keep")}
              {sr}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve("hide")}
              className={buttonStyles({ variant: hidden ? "outline" : "primary" })}
            >
              {hidden ? t("actions.keepHidden") : t("actions.hide")}
              {sr}
            </button>
            <button
              ref={removeRef}
              type="button"
              disabled={pending}
              onClick={() => setConfirmRemove(true)}
              className={buttonStyles({ variant: hidden ? "primary" : "outline" })}
            >
              {t("actions.remove")}
              {sr}
            </button>
          </>
        )}
      </div>
      {/* Only for trusted people; after a revoke the same button undoes it. */}
      {person?.username && person.isTrusted && !missing ? (
        <button
          type="button"
          disabled={pending}
          onClick={toggleTrust}
          className={buttonStyles({
            variant: trusted ? "outline" : "ghost",
            className: trusted ? "border-ink" : "text-ink-2",
          })}
        >
          {trusted ? t("actions.revokeTrust") : t("actions.grantTrust")}
          <span className="sr-only">: @{person.username}</span>
        </button>
      ) : null}
      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ? t(`errors.${error}`) : ""}
      </p>
    </div>
  );
}
