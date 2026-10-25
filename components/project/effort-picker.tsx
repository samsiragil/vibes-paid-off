"use client";

import { useTranslations } from "next-intl";
import { BUILD_EFFORTS, type BuildEffort } from "@/lib/projects/types";

/**
 * "Kira-kira berapa lama sampai jadi?": one tap on a rough scale instead of hours per session.
 * A chip the repo's commit history points to is marked "saran dari repo".
 */
export function EffortPicker({
  id,
  value,
  suggested,
  error,
  onChange,
}: {
  /** Id of the first chip, so the form can focus it on an error. */
  id: string;
  value: BuildEffort | "";
  suggested: BuildEffort | null;
  error?: string;
  onChange: (effort: BuildEffort) => void;
}) {
  const t = useTranslations("projectForm");
  const tCard = useTranslations("projectCard");

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t("effortLegend")}</legend>
      {/* The form focuses the first aria-invalid control after a failed submit: the group here. */}
      <div
        role="radiogroup"
        tabIndex={-1}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="flex flex-wrap gap-2 rounded-md focus:outline-none"
      >
        {BUILD_EFFORTS.map((effort, index) => (
          <label
            key={effort}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-4 text-base text-ink transition-colors hover:border-ink has-checked:border-highlight has-checked:bg-highlight has-checked:font-semibold has-checked:text-highlight-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name="buildEffort"
              value={effort}
              id={index === 0 ? id : undefined}
              checked={value === effort}
              onChange={() => onChange(effort)}
              className="sr-only"
            />
            {tCard("effort", { effort })}
            {suggested === effort ? (
              <span className="text-[13px] font-normal text-accent-text">
                {t("autofill.suggested")}
              </span>
            ) : null}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
