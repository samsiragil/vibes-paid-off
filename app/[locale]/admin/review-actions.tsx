"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { reviewProject, type ReviewResult } from "@/lib/admin/actions";
import { REJECT_CODES, REJECT_NOTE_MAX, type RejectCode } from "@/lib/validation/admin";
import { useActionLog } from "./action-log";

/**
 * Setujui / Tolak on a queue card. Rejecting opens a short form under the buttons: a reason from
 * the fixed list (Q11) and a note for the maker ("other" needs one). The outcome goes to the
 * tab's log, since the card leaves the queue once the page refreshes.
 */
export function ReviewActions({ projectId, title }: { projectId: string; title: string }) {
  const t = useTranslations("admin.queue");
  const tCodes = useTranslations("moderation.rejectCodes");
  const log = useActionLog();
  const [rejecting, setRejecting] = useState(false);
  const [code, setCode] = useState<RejectCode | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<Exclude<ReviewResult, { ok: true }>["error"] | null>(null);
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const noteId = useId();
  const firstReasonRef = useRef<HTMLInputElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (rejecting) firstReasonRef.current?.focus();
  }, [rejecting]);

  function run(approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await reviewProject(
        approve
          ? { projectId, approve: true }
          : { projectId, approve: false, code, note: note.trim() || undefined },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      log(
        result.status === "published"
          ? t("done.approved", { title })
          : t(result.emailQueued ? "done.rejectedEmail" : "done.rejectedMe", { title }),
      );
    });
  }

  const noteRequired = code === "other";

  return (
    <div className="flex shrink-0 flex-col gap-2 md:w-[220px]">
      {!rejecting ? (
        <div className="flex gap-2 md:flex-col">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(true)}
            className={buttonStyles({ variant: "accent", className: "grow" })}
          >
            {pending ? t("saving") : t("approve")}
            <span className="sr-only">: {title}</span>
          </button>
          <button
            ref={rejectRef}
            type="button"
            disabled={pending}
            aria-expanded={false}
            onClick={() => setRejecting(true)}
            className={buttonStyles({ variant: "outline", className: "grow" })}
          >
            {t("reject")}
            <span className="sr-only">: {title}</span>
          </button>
        </div>
      ) : (
        <form
          id={formId}
          aria-label={t("rejectLabel", { title })}
          onSubmit={(event) => {
            event.preventDefault();
            if (code) run(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setRejecting(false);
              requestAnimationFrame(() => rejectRef.current?.focus());
            }
          }}
          className="flex flex-col gap-3 rounded border border-border bg-bg p-3.5"
        >
          <fieldset className="flex flex-col gap-0.5">
            <legend className="mb-1.5 text-sm font-medium">{t("reasonLabel")}</legend>
            {REJECT_CODES.map((value, index) => (
              <label
                key={value}
                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-1.5 text-sm hover:bg-placeholder"
              >
                <input
                  ref={index === 0 ? firstReasonRef : undefined}
                  type="radio"
                  name={`${formId}-reason`}
                  value={value}
                  required
                  checked={code === value}
                  onChange={() => setCode(value)}
                  className="size-4 shrink-0 accent-[var(--accent-text)]"
                />
                {tCodes(value)}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={noteId} className="text-sm font-medium">
                {noteRequired ? t("noteLabelRequired") : t("noteLabel")}
              </label>
              <span className="text-[13px] text-muted tabular-nums">
                {note.length}/{REJECT_NOTE_MAX}
              </span>
            </div>
            <Textarea
              id={noteId}
              value={note}
              required={noteRequired}
              maxLength={REJECT_NOTE_MAX}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("notePlaceholder")}
              className="min-h-20 text-sm"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                requestAnimationFrame(() => rejectRef.current?.focus());
              }}
              className={buttonStyles({ variant: "outline", size: "sm" })}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!code || (noteRequired && !note.trim()) || pending}
              className={buttonStyles({ variant: "primary", size: "sm" })}
            >
              {pending ? t("saving") : t("rejectSubmit")}
            </button>
          </div>
        </form>
      )}
      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ? t(`errors.${error}`) : ""}
      </p>
    </div>
  );
}
