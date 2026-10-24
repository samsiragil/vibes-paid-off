"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, Textarea } from "@/components/ui/field";
import { STORY_MOMENTS, type StoryMoment } from "@/lib/projects/types";
import { PROJECT_LIMITS } from "@/lib/validation/project";

export type StoryValues = Record<StoryMoment, string>;

const limits: Record<StoryMoment, number> = {
  wow: PROJECT_LIMITS.moment,
  hardest: PROJECT_LIMITS.moment,
  redo: PROJECT_LIMITS.lessons,
};

/**
 * "Cerita build": three optional moments instead of a session-by-session log. Each one stays a
 * single line with a "Ceritain" button until the maker opens it; none is required.
 */
export function StoryMoments({
  idFor,
  values,
  fieldError,
  onChange,
}: {
  idFor: (moment: StoryMoment) => string;
  values: StoryValues;
  fieldError: (moment: StoryMoment) => string | undefined;
  onChange: (moment: StoryMoment, value: string) => void;
}) {
  const t = useTranslations("projectForm.moments");
  // Moments with text start open; the rest open on "Ceritain".
  const [open, setOpen] = useState<Set<StoryMoment>>(
    () => new Set(STORY_MOMENTS.filter((moment) => values[moment].trim() !== "")),
  );

  function show(moment: StoryMoment) {
    setOpen((previous) => new Set(previous).add(moment));
    // Focus once the textarea exists.
    requestAnimationFrame(() => document.getElementById(idFor(moment))?.focus());
  }

  function hide(moment: StoryMoment) {
    onChange(moment, "");
    setOpen((previous) => {
      const next = new Set(previous);
      next.delete(moment);
      return next;
    });
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {STORY_MOMENTS.map((moment) => {
        const isOpen = open.has(moment) || Boolean(fieldError(moment));
        const id = idFor(moment);
        const value = values[moment];
        return (
          <li key={moment} className="rounded-2xl border border-border bg-bg px-3.5 py-3">
            {isOpen ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{t(moment)}</p>
                  <button
                    type="button"
                    aria-label={t("remove", { moment: t(moment) })}
                    title={t("remove", { moment: t(moment) })}
                    onClick={() => hide(moment)}
                    className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <Field
                  id={id}
                  label={<span className="font-normal text-ink-2">{t(`${moment}Question`)}</span>}
                  error={fieldError(moment)}
                  counter={`${value.length}/${limits[moment]}`}
                >
                  <Textarea
                    id={id}
                    rows={3}
                    value={value}
                    maxLength={limits[moment]}
                    placeholder={t(`${moment}Placeholder`)}
                    aria-invalid={fieldError(moment) ? true : undefined}
                    aria-describedby={fieldError(moment) ? `${id}-error` : undefined}
                    onChange={(event) => onChange(moment, event.target.value)}
                    className="rounded-xl bg-surface"
                  />
                </Field>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-ink">{t(moment)}</p>
                <button
                  type="button"
                  onClick={() => show(moment)}
                  className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-border-strong px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-ink"
                >
                  {t("tell")}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
