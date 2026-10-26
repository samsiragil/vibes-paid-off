"use client";

import { useLocale, useTranslations } from "next-intl";
import { SystemAvatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { CheckIcon, copyText, useCopied } from "@/components/ui/copy-link";
import { keyPromptHelper, storyHelper } from "@/lib/projects/ai-prompts";
import type { ProjectFormValues } from "@/lib/projects/form-values";
import type { ContentLang } from "@/lib/projects/types";

/**
 * "Bingung nulisnya?": the site offers a ready prompt the maker copies into their AI agent, filled
 * with what the form already knows and written in the site's display language. Drawn as a system
 * message (avatar + ruled note, like the repo check); opening it pastes the prompt in under it.
 */
export function AiPromptHelper({
  step,
  values,
}: {
  step: "prompt" | "story";
  values: ProjectFormValues;
}) {
  const t = useTranslations("projectForm.promptHelper");
  const lang = useLocale() as ContentLang;
  const text = (step === "prompt" ? keyPromptHelper : storyHelper)(values, lang);
  const [copied, markCopied] = useCopied();

  return (
    <details className="group motion-details">
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
        <SystemAvatar />
        <span className="block min-w-0 grow rounded-r border-y border-r border-l-[1.5px] border-y-border border-r-border border-l-margin bg-surface ruled px-4 text-base/8 text-ink transition-colors group-hover:border-y-border-strong group-hover:border-r-border-strong">
          <strong className="font-semibold">{t(`${step}.toggle`)}</strong> {t(`${step}.hint`)}{" "}
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-accent-text underline-offset-3 group-hover:underline">
            {t("show")}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
              className="transition-transform group-open:rotate-90"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-3 sm:pl-12">
        <p className="text-sm leading-5 text-ink-2">{t(`${step}.note`)}</p>
        <pre
          aria-label={t("label")}
          tabIndex={0}
          className="max-h-64 overflow-auto rounded border border-border bg-surface p-3 font-sans text-sm leading-6 whitespace-pre-wrap text-ink shadow-[0_1px_0_var(--border)]"
        >
          {text}
        </pre>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={async () => {
              if (await copyText(text)) markCopied();
            }}
            className={buttonStyles({ variant: "outline", className: "min-w-32" })}
          >
            {copied ? (
              <>
                <CheckIcon />
                {t("copied")}
              </>
            ) : (
              t("copy")
            )}
          </button>
          <p className="text-sm leading-5 text-muted">{t(`${step}.after`)}</p>
        </div>
        <span role="status" className="sr-only">
          {copied ? t("copied") : ""}
        </span>
      </div>
    </details>
  );
}
