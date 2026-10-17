"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { MonoLabel } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { emptySession, type SessionValues } from "@/lib/projects/form-values";
import { PROJECT_LIMITS } from "@/lib/validation/project";

const fieldClass = "rounded-xl bg-bg";

/**
 * "Sesi pembuatan": 1 to 10 build sessions, each with duration, prompt and result, plus an
 * optional problem and solution. Field ids are `${idPrefix}-${index}-${field}` so the form can
 * focus the first error.
 */
export function SessionEditor({
  idPrefix,
  sessions,
  totalLabel,
  error,
  fieldError,
  onChange,
}: {
  idPrefix: string;
  sessions: SessionValues[];
  totalLabel: string;
  /** Error for the list itself (none, too many). */
  error?: string;
  /** Translated error for `sessions.<index>.<field>`, if any. */
  fieldError: (index: number, field: string) => string | undefined;
  onChange: (sessions: SessionValues[], options?: { reordered?: boolean }) => void;
}) {
  const t = useTranslations("projectForm.sessions");
  const tForm = useTranslations("projectForm");

  function patch(index: number, change: Partial<SessionValues>) {
    onChange(sessions.map((session, i) => (i === index ? { ...session, ...change } : session)));
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...sessions];
    const [moved] = next.splice(index, 1);
    next.splice(index + offset, 0, moved);
    onChange(next, { reordered: true });
  }

  function remove(index: number) {
    onChange(
      sessions.filter((_, i) => i !== index),
      { reordered: true },
    );
  }

  const full = sessions.length >= PROJECT_LIMITS.maxSessions;

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {sessions.map((session, index) => {
          const number = index + 1;
          const id = (field: string) => `${idPrefix}-${index}-${field}`;
          const describe = (field: string) =>
            fieldError(index, field) ? `${id(field)}-error` : undefined;

          return (
            <li
              key={session.key}
              className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-3.5 sm:p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <MonoLabel className="text-accent-text">{t("heading", { number })}</MonoLabel>
                <div className="flex gap-1">
                  <IconButton
                    label={t("moveUp", { number })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <path d="M6 15l6-6 6 6" />
                  </IconButton>
                  <IconButton
                    label={t("moveDown", { number })}
                    disabled={index === sessions.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </IconButton>
                  <IconButton
                    label={t("remove", { number })}
                    disabled={sessions.length <= PROJECT_LIMITS.minSessions}
                    onClick={() => remove(index)}
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </IconButton>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <Field
                  id={id("label")}
                  label={
                    <>
                      {t("label")}{" "}
                      <span className="font-normal text-muted">{tForm("optional")}</span>
                    </>
                  }
                  error={fieldError(index, "label")}
                >
                  <Input
                    id={id("label")}
                    value={session.label}
                    maxLength={PROJECT_LIMITS.sessionLabel}
                    placeholder={t("labelPlaceholder")}
                    aria-invalid={fieldError(index, "label") ? true : undefined}
                    aria-describedby={describe("label")}
                    onChange={(event) => patch(index, { label: event.target.value })}
                    className={`h-11 ${fieldClass}`}
                  />
                </Field>
                <Field
                  id={id("durationHours")}
                  label={t("duration")}
                  error={fieldError(index, "durationHours")}
                >
                  <Input
                    id={id("durationHours")}
                    inputMode="decimal"
                    autoComplete="off"
                    value={session.durationHours}
                    placeholder="2"
                    aria-invalid={fieldError(index, "durationHours") ? true : undefined}
                    aria-describedby={describe("durationHours")}
                    title={t("durationHint")}
                    onChange={(event) => patch(index, { durationHours: event.target.value })}
                    className={`h-11 ${fieldClass}`}
                  />
                </Field>
              </div>

              <Field
                id={id("prompt")}
                label={t("prompt")}
                error={fieldError(index, "prompt")}
                counter={`${session.prompt.length}/${PROJECT_LIMITS.sessionPrompt}`}
              >
                <Textarea
                  id={id("prompt")}
                  rows={3}
                  value={session.prompt}
                  maxLength={PROJECT_LIMITS.sessionPrompt}
                  placeholder={t("promptPlaceholder")}
                  aria-invalid={fieldError(index, "prompt") ? true : undefined}
                  aria-describedby={describe("prompt")}
                  onChange={(event) => patch(index, { prompt: event.target.value })}
                  className={`min-h-24 ${fieldClass}`}
                />
              </Field>

              <Field
                id={id("result")}
                label={t("result")}
                error={fieldError(index, "result")}
                counter={`${session.result.length}/${PROJECT_LIMITS.sessionResult}`}
              >
                <Textarea
                  id={id("result")}
                  rows={2}
                  value={session.result}
                  maxLength={PROJECT_LIMITS.sessionResult}
                  placeholder={t("resultPlaceholder")}
                  aria-invalid={fieldError(index, "result") ? true : undefined}
                  aria-describedby={describe("result")}
                  onChange={(event) => patch(index, { result: event.target.value })}
                  className={`min-h-20 ${fieldClass}`}
                />
              </Field>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 self-start text-sm">
                <input
                  type="checkbox"
                  checked={session.hasChallenge}
                  onChange={(event) => patch(index, { hasChallenge: event.target.checked })}
                  className="size-[18px] accent-(--accent)"
                />
                {t("hasChallenge")}
              </label>

              {session.hasChallenge ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id={id("challenge")}
                    label={t("challenge")}
                    error={fieldError(index, "challenge")}
                  >
                    <Textarea
                      id={id("challenge")}
                      rows={3}
                      value={session.challenge}
                      maxLength={PROJECT_LIMITS.challenge}
                      placeholder={t("challengePlaceholder")}
                      aria-invalid={fieldError(index, "challenge") ? true : undefined}
                      aria-describedby={describe("challenge")}
                      onChange={(event) => patch(index, { challenge: event.target.value })}
                      className={`min-h-24 ${fieldClass}`}
                    />
                  </Field>
                  <Field
                    id={id("solution")}
                    label={t("solution")}
                    error={fieldError(index, "solution")}
                  >
                    <Textarea
                      id={id("solution")}
                      rows={3}
                      value={session.solution}
                      maxLength={PROJECT_LIMITS.solution}
                      placeholder={t("solutionPlaceholder")}
                      aria-invalid={fieldError(index, "solution") ? true : undefined}
                      aria-describedby={describe("solution")}
                      onChange={(event) => patch(index, { solution: event.target.value })}
                      className={`min-h-24 ${fieldClass}`}
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          id={`${idPrefix}-add`}
          variant="outline"
          disabled={full}
          aria-invalid={error ? true : undefined}
          onClick={() => onChange([...sessions, emptySession()])}
        >
          <PlusIcon />
          {t("add")}
        </Button>
        <span className="font-mono text-xs text-muted" aria-live="polite">
          {totalLabel} · {t("count", { count: sessions.length, max: PROJECT_LIMITS.maxSessions })}
        </span>
      </div>
      {error ? <p className="text-[13px] text-red-700 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
