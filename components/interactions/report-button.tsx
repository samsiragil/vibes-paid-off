"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { reportContent, type ReportResult } from "@/lib/interactions/actions";
import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from "@/lib/validation/interactions";

type Done = "sent" | "hidden" | "already";

/**
 * "Laporkan" for a project or a reply: a dialog to pick a reason and add an optional note
 * (bottom sheet on phones). One account counts once per target; the third account's report
 * hides it until an admin looks (§2.2).
 */
export function ReportButton({
  targetType,
  targetId,
  className,
}: {
  targetType: "project" | "comment";
  targetId: string;
  className?: string;
}) {
  const t = useTranslations("interactions.report");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<Exclude<ReportResult, { ok: true }>["error"] | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    dialogRef.current?.close();
  }

  function submit() {
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const result = await reportContent({
        targetType,
        targetId,
        reason,
        note: note.trim() || undefined,
      });
      if (result.ok) setDone(result.targetHidden ? "hidden" : "sent");
      else if (result.error === "already_reported") setDone("already");
      else setError(result.error);
    });
  }

  const subject = targetType === "project" ? "project" : "reply";

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={done !== null}
        onClick={() => dialogRef.current?.showModal()}
        className={cn(
          "underline-offset-2 hover:text-ink hover:underline disabled:no-underline disabled:opacity-100",
          className,
        )}
      >
        {done ? t("reported") : t(`trigger.${subject}`)}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          // A click on the backdrop (the dialog box itself, outside the panel) closes it.
          if (event.target === event.currentTarget) close();
        }}
        className="m-0 mt-auto max-h-[90dvh] w-full max-w-none motion-dialog rounded-t-md border border-border bg-bg p-0 text-ink backdrop:bg-ink/40 sm:m-auto sm:max-w-[460px] sm:rounded"
      >
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <h2 id={titleId} className="text-[22px] leading-7 font-semibold">
            {t(`title.${subject}`)}
          </h2>

          {done ? (
            <>
              <p role="status" className="text-base leading-6 text-ink-2">
                {t(`done.${done === "hidden" ? `hidden_${subject}` : done}`)}
              </p>
              <button
                type="button"
                autoFocus
                onClick={close}
                className={buttonStyles({ variant: "primary", className: "self-end" })}
              >
                {t("close")}
              </button>
            </>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
              className="flex flex-col gap-5"
            >
              <p className="text-base leading-6 text-ink-2">{t("intro")}</p>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-2 text-[13px] leading-4 font-semibold">
                  {t("reasonLabel")}
                </legend>
                {REPORT_REASONS.map((value) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-base hover:bg-placeholder"
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={value}
                      required
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="size-4 accent-accent"
                    />
                    {t(`reasons.${value}`)}
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={noteId} className="text-[13px] leading-4 font-semibold">
                    {t("noteLabel")}
                  </label>
                  <span className="text-[13px] text-muted tabular-nums">
                    {note.length}/{REPORT_NOTE_MAX}
                  </span>
                </div>
                <Textarea
                  id={noteId}
                  value={note}
                  maxLength={REPORT_NOTE_MAX}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("notePlaceholder")}
                  className="min-h-24"
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {t(`errors.${error}`)}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className={buttonStyles({ variant: "outline" })}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={!reason || pending}
                  className={buttonStyles({ variant: "primary" })}
                >
                  {pending ? t("sending") : t("submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
