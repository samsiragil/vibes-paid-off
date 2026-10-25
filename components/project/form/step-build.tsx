"use client";

import { useTranslations } from "next-intl";
import { TimeGap } from "@/components/ui/bubble";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ProjectFormValues } from "@/lib/projects/form-values";
import type { BuildEffort, CatalogTool } from "@/lib/projects/types";
import { PROJECT_LIMITS } from "@/lib/validation/project";
import { EffortPicker } from "../effort-picker";
import { ToolPicker } from "../tool-picker";
import { Answer, fieldId, Optional, StepQuestion, type StepProps } from "./parts";

/**
 * Step 4: rough build time (drawn right away as the card's "satu weekend kemudian"), tools,
 * category and language, with description and demo video folded under "Detail lain".
 */
export function StepBuild({
  values,
  fieldError,
  errorProps,
  update,
  updateList,
  suggestedEffort,
  tools,
  quickPickIds,
  categories,
}: StepProps & {
  updateList: <K extends "toolIds" | "suggestions">(
    key: K,
    change: (previous: ProjectFormValues[K]) => ProjectFormValues[K],
  ) => void;
  suggestedEffort: BuildEffort | null;
  tools: CatalogTool[];
  quickPickIds: number[];
  categories: string[];
}) {
  const t = useTranslations("projectForm");
  const tCard = useTranslations("projectCard");
  const tCategories = useTranslations("categories");
  const extrasOpen = Boolean(
    values.description.trim() ||
    values.videoUrl.trim() ||
    fieldError("description") ||
    fieldError("videoUrl"),
  );

  return (
    <>
      <StepQuestion step="build" />
      <Answer>
        <EffortPicker
          id={fieldId("buildEffort")}
          value={values.buildEffort}
          suggested={suggestedEffort}
          error={fieldError("buildEffort")}
          onChange={(effort) => update("buildEffort", effort)}
        />
        {values.buildEffort ? (
          // Keyed so the handwriting and arrow draw again for each pick.
          <TimeGap key={values.buildEffort} className="motion-fade-in">
            {tCard("effortAfter", { effort: values.buildEffort })}
          </TimeGap>
        ) : null}

        <ToolPicker
          id={fieldId("toolIds")}
          tools={tools}
          quickPickIds={quickPickIds}
          selectedIds={values.toolIds}
          suggestions={values.suggestions}
          error={fieldError("toolIds") ?? fieldError("suggestions")}
          onSelectedChange={(change) => updateList("toolIds", change)}
          onSuggestionsChange={(change) => updateList("suggestions", change)}
        />
        <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:gap-3">
          <Field id={fieldId("category")} label={t("category")} error={fieldError("category")}>
            <Select
              {...errorProps("category")}
              value={values.category}
              onChange={(event) => update("category", event.target.value)}
            >
              <option value="" disabled>
                {t("categoryPlaceholder")}
              </option>
              {categories.map((slug) => (
                <option key={slug} value={slug}>
                  {tCategories(slug)}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] leading-4 font-semibold text-ink">
              {t("contentLang")}
            </legend>
            <div className="flex h-11 items-center gap-5 text-base">
              {(["id", "en"] as const).map((lang) => (
                <label key={lang} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="contentLang"
                    value={lang}
                    checked={values.contentLang === lang}
                    onChange={() => update("contentLang", lang)}
                    className="size-4 accent-(--accent)"
                  />
                  {lang.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <details
          open={extrasOpen}
          className="group motion-details rounded border border-border bg-surface px-4 py-2"
        >
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
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
            {t("extras")} <span className="font-normal text-muted">{t("extrasHint")}</span>
          </summary>
          <div className="mt-3 flex flex-col gap-4 pb-2">
            <Field
              id={fieldId("description")}
              label={<Optional label={t("description")} note={t("optional")} />}
              error={fieldError("description")}
            >
              <Textarea
                {...errorProps("description")}
                rows={3}
                value={values.description}
                maxLength={PROJECT_LIMITS.description}
                placeholder={t("descriptionPlaceholder")}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
            <Field
              id={fieldId("videoUrl")}
              label={<Optional label={t("videoUrl")} note={t("videoUrlHint")} />}
              error={fieldError("videoUrl")}
            >
              <Input
                {...errorProps("videoUrl")}
                type="url"
                inputMode="url"
                value={values.videoUrl}
                placeholder={t("videoUrlPlaceholder")}
                onChange={(event) => update("videoUrl", event.target.value)}
              />
            </Field>
          </div>
        </details>
      </Answer>
    </>
  );
}
