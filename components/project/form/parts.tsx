"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SystemAvatar } from "@/components/ui/avatar";
import { SystemMessage } from "@/components/ui/bubble";
import { cn } from "@/lib/cn";
import { FORM_STEPS, stepIndex, type FormStep } from "@/lib/projects/form-steps";
import type { ProjectFormValues } from "@/lib/projects/form-values";

/** Ids of the form controls; errors focus the first one on the step. */
export const fieldId = (path: string) => `pf-${path.replaceAll(".", "-")}`;

/** What every step gets from the form to show and change its answers. */
export type StepProps = {
  values: ProjectFormValues;
  fieldError: (path: string) => string | undefined;
  errorProps: (path: string) => {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  };
  update: <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) => void;
};

export function strong(chunks: ReactNode) {
  return <strong className="font-semibold">{chunks}</strong>;
}

/**
 * The step's one question, said by the site (system avatar) without a box, so the answer field
 * is the only box on screen. It is the step's heading; focus moves here on a new step.
 */
export function StepQuestion({ step }: { step: FormStep }) {
  const t = useTranslations(`projectForm.steps.${step}`);
  return (
    <div className="flex items-start gap-3">
      <SystemAvatar className="mt-0.5" />
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          id={`pf-step-${step}`}
          tabIndex={-1}
          className="text-[22px] leading-8 font-semibold text-balance text-ink focus:outline-none sm:text-[26px] sm:leading-9"
        >
          {t("title")}
        </h2>
        <p className="max-w-[60ch] text-base leading-6 text-ink-2">{t("note")}</p>
      </div>
    </div>
  );
}

/** A note from the site inside a step (the rules before sending): system avatar + ruled note. */
export function Question({ className, children }: { className?: string; children: ReactNode }) {
  return <SystemMessage className={className}>{children}</SystemMessage>;
}

/** The maker's answer: the inputs, written under the question (indented past the avatar). */
export function Answer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-4 sm:pl-12", className)}>{children}</div>;
}

export function Optional({ label, note }: { label: ReactNode; note: ReactNode }) {
  return (
    <>
      {label} <span className="font-normal text-muted">{note}</span>
    </>
  );
}

/**
 * Where the maker is: "Langkah 2 dari 6" handwritten in the margin, then one tab per step. Done
 * steps get a tick and can be reopened; in edit mode every step can be (`reachable`).
 */
export function Stepper({
  current,
  reachable,
  onSelect,
}: {
  current: FormStep;
  /** Index of the furthest step the maker may jump to. */
  reachable: number;
  onSelect: (step: FormStep) => void;
}) {
  const t = useTranslations("projectForm.stepper");
  const index = stepIndex(current);

  return (
    <nav aria-label={t("nav")} className="flex flex-col gap-2">
      <p className="font-hand text-xl leading-7 text-ink-2" aria-live="polite">
        {t("label", { current: index + 1, total: FORM_STEPS.length })}
        <span className="sm:hidden"> · {t(`names.${current}`)}</span>
      </p>
      <ol className="grid grid-cols-6 gap-1.5">
        {FORM_STEPS.map((step, position) => {
          const done = position < index;
          const active = position === index;
          const canOpen = position <= reachable && !active;
          return (
            <li key={step} className="min-w-0">
              <button
                type="button"
                disabled={!canOpen}
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(step)}
                className={cn(
                  "group flex w-full flex-col gap-1.5 text-left disabled:cursor-default",
                  canOpen && "cursor-pointer",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 rounded-full transition-colors duration-300",
                    done || active ? "bg-highlight" : "bg-border",
                    canOpen && "group-hover:bg-accent",
                  )}
                />
                <span
                  className={cn(
                    "hidden truncate text-[13px] leading-4 sm:block",
                    active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-muted",
                  )}
                >
                  {done ? <span aria-hidden="true">✓ </span> : null}
                  {t(`names.${step}`)}
                  {done ? <span className="sr-only"> ({t("done")})</span> : null}
                </span>
                <span className="sr-only sm:hidden">{t(`names.${step}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
