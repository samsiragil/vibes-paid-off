"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { PROJECT_LIMITS } from "@/lib/validation/project";
import { Answer, fieldId, StepQuestion, type StepProps } from "./parts";

/** Step 3: the key prompt alone, as the page's ruled note with the margin line (README §6). */
export function StepPrompt({ values, fieldError, errorProps, update }: StepProps) {
  const t = useTranslations("projectForm");
  const error = fieldError("keyPrompt");

  return (
    <>
      <StepQuestion step="prompt" />
      <Answer>
        <div
          className={cn(
            "relative overflow-hidden rounded-md border-[1.5px] bg-surface transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
            error ? "border-danger" : "border-border-strong hover:border-ink",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-6"
          />
          <label htmlFor={fieldId("keyPrompt")} className="sr-only">
            {t("keyPrompt")}
          </label>
          <textarea
            {...errorProps("keyPrompt")}
            rows={4}
            value={values.keyPrompt}
            maxLength={PROJECT_LIMITS.keyPrompt}
            placeholder={t("keyPromptPlaceholder")}
            onChange={(event) => update("keyPrompt", event.target.value)}
            className="block w-full resize-y bg-transparent ruled [background-attachment:local] pt-0 pr-4 pb-0 pl-7 text-lg/8 text-ink placeholder:text-muted focus:outline-none sm:pl-10"
          />
        </div>
        <div className="flex items-baseline justify-between gap-3">
          {error ? (
            <p id={`${fieldId("keyPrompt")}-error`} className="text-sm text-danger">
              {error}
            </p>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-muted tabular-nums">
            {values.keyPrompt.length}/{PROJECT_LIMITS.keyPrompt}
          </span>
        </div>
      </Answer>
    </>
  );
}
