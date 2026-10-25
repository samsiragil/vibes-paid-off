"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Answer, Question, StepQuestion } from "./parts";

/**
 * Step 6: the finished card, large, as the payoff for the steps before it, then the community
 * rules (new projects only). Turnstile and the send button sit in the form's footer.
 */
export function StepReview({ preview, showRules }: { preview: ReactNode; showRules: boolean }) {
  const t = useTranslations("projectForm");

  return (
    <>
      <StepQuestion step="review" />
      <Answer>
        <div className="w-full max-w-[420px] -rotate-[0.4deg] self-center sm:self-start">
          {preview}
        </div>
      </Answer>
      {showRules ? (
        <Question>
          {t.rich("steps.rules", {
            link: (chunks) => (
              <Link
                href="/rules"
                className="font-semibold text-accent-text underline underline-offset-3"
              >
                {chunks}
              </Link>
            ),
          })}
          <ul className="list-disc pl-5 text-ink-2">
            {(["own", "illegal", "privacy", "respect"] as const).map((rule) => (
              <li key={rule}>{t(`rules.${rule}`)}</li>
            ))}
          </ul>
        </Question>
      ) : null}
    </>
  );
}
