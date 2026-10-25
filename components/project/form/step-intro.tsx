"use client";

import { useTranslations } from "next-intl";
import type { ReactNode, Ref } from "react";
import { Field, Input } from "@/components/ui/field";
import type { ProjectMedia } from "@/lib/media/limits";
import { PROJECT_LIMITS } from "@/lib/validation/project";
import { MediaUploader, type MediaUploaderHandle } from "../media-uploader";
import { Answer, fieldId, Optional, StepQuestion, type StepProps } from "./parts";

/**
 * Step 2: title, tagline and screenshots. What the repo check found opens the step (`found`), and
 * fields it filled carry a small "terisi otomatis" tag until the maker changes them.
 */
export function StepIntro({
  values,
  fieldError,
  errorProps,
  update,
  found,
  autofilled,
  uploaderRef,
  projectId,
  initialMedia,
  onMediaChange,
}: StepProps & {
  found: ReactNode;
  autofilled: ReadonlySet<string>;
  uploaderRef: Ref<MediaUploaderHandle>;
  projectId?: string;
  initialMedia: ProjectMedia[];
  onMediaChange: (previews: { url: string }[]) => void;
}) {
  const t = useTranslations("projectForm");
  const label = (key: "title" | "tagline") =>
    autofilled.has(key) ? <Optional label={t(key)} note={t("autofill.filledTag")} /> : t(key);

  return (
    <>
      {found}
      <StepQuestion step="intro" />
      <Answer>
        <Field id={fieldId("title")} label={label("title")} error={fieldError("title")}>
          <Input
            {...errorProps("title")}
            value={values.title}
            maxLength={PROJECT_LIMITS.title}
            placeholder={t("titlePlaceholder")}
            onChange={(event) => update("title", event.target.value)}
          />
        </Field>
        <Field
          id={fieldId("tagline")}
          label={label("tagline")}
          error={fieldError("tagline")}
          counter={`${values.tagline.length}/${PROJECT_LIMITS.tagline}`}
        >
          <Input
            {...errorProps("tagline")}
            value={values.tagline}
            maxLength={PROJECT_LIMITS.tagline}
            placeholder={t("taglinePlaceholder")}
            onChange={(event) => update("tagline", event.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-4 font-semibold text-ink">
            <Optional label={t("screenshots")} note={t("optional")} />
          </p>
          <MediaUploader
            ref={uploaderRef}
            projectId={projectId}
            initialMedia={initialMedia}
            onChange={(change) => onMediaChange(change.previews)}
          />
        </div>
      </Answer>
    </>
  );
}
