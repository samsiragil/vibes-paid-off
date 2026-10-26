"use client";

import { useTranslations } from "next-intl";
import type { ProjectFormValues } from "@/lib/projects/form-values";
import type { StoryMoment } from "@/lib/projects/types";
import { StoryMoments } from "../story-moments";
import { AiPromptHelper } from "./ai-prompt-helper";
import { Answer, fieldId, StepQuestion, type StepProps } from "./parts";

/** Story moments and the form values that hold them ("redo" is lessons). */
export const momentKeys = {
  wow: "momentWow",
  hardest: "momentHardest",
  redo: "lessons",
} as const satisfies Record<StoryMoment, keyof ProjectFormValues>;

/** Step 5: the optional build story. Skipping it is a normal way forward, not a shortcut. */
export function StepStory({
  values,
  fieldError,
  update,
  legacySessions,
}: Omit<StepProps, "errorProps"> & { legacySessions: number }) {
  const t = useTranslations("projectForm");

  return (
    <>
      <StepQuestion step="story" />
      <Answer>
        <StoryMoments
          idFor={(moment) => fieldId(momentKeys[moment])}
          values={{ wow: values.momentWow, hardest: values.momentHardest, redo: values.lessons }}
          fieldError={(moment) => fieldError(momentKeys[moment])}
          onChange={(moment, value) => update(momentKeys[moment], value)}
        />
        <AiPromptHelper step="story" values={values} />
        {legacySessions > 0 ? (
          <p className="text-[13px] leading-normal text-muted">
            {t("moments.legacy", { count: legacySessions })}
          </p>
        ) : null}
      </Answer>
    </>
  );
}
