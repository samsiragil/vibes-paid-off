"use client";

import { useTranslations } from "next-intl";
import { SystemMessage } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Answer, fieldId, Optional, StepQuestion, strong, type StepProps } from "./parts";

/** What the repo check said, as far as this step cares. */
export type RepoCheck =
  | { status: "idle" | "checking" | "public" | "failed" }
  | { status: "not_found" }
  | { status: "no_owner"; owner: string };

/**
 * Step 1, the smallest ask first: the GitHub repo (required) and the live link (optional). "Lanjut"
 * checks the repo; when GitHub cannot find it under an account that exists, the maker is asked
 * here whether it is private, which is a normal answer and not an error.
 */
export function StepRepo({
  values,
  check,
  fieldError,
  errorProps,
  update,
  onConfirmPrivate,
  onUndoPrivate,
}: StepProps & {
  check: RepoCheck;
  onConfirmPrivate: () => void;
  onUndoPrivate: () => void;
}) {
  const t = useTranslations("projectForm");
  const ownerMissing = check.status === "no_owner";
  const repoError =
    fieldError("repoUrl") ??
    (ownerMissing ? t("repoCheck.noOwner", { owner: check.owner }) : undefined);
  const repoProps = errorProps("repoUrl");
  const askPrivate = check.status === "not_found" && !values.repoPrivate;

  return (
    <>
      <StepQuestion step="repo" />
      <Answer>
        <Field id={fieldId("repoUrl")} label={t("repoUrl")} error={repoError}>
          <Input
            {...repoProps}
            aria-invalid={repoError ? true : undefined}
            aria-describedby={repoError ? `${fieldId("repoUrl")}-error` : undefined}
            type="url"
            inputMode="url"
            autoComplete="url"
            value={values.repoUrl}
            placeholder={t("repoUrlPlaceholder")}
            onChange={(event) => update("repoUrl", event.target.value)}
          />
        </Field>

        {askPrivate ? (
          <SystemMessage className="motion-fade-in">
            <div role="status" className="flex flex-col gap-3 py-1">
              <p>{t.rich("repoCheck.question", { strong })}</p>
              <p className="text-sm leading-6 text-ink-2">{t("repoCheck.questionNote")}</p>
              <div className="flex flex-wrap gap-2 pb-2">
                <Button variant="primary" size="sm" onClick={onConfirmPrivate}>
                  {t("repoCheck.yes")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById(fieldId("repoUrl"))?.focus()}
                >
                  {t("repoCheck.recheck")}
                </Button>
              </div>
            </div>
          </SystemMessage>
        ) : null}

        {values.repoPrivate ? (
          <SystemMessage tone="soft" className="motion-fade-in">
            <span role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{t.rich("repoCheck.privateOk", { strong })}</span>
              <button
                type="button"
                onClick={onUndoPrivate}
                className="text-sm text-ink-2 underline underline-offset-3"
              >
                {t("repoCheck.undo")}
              </button>
            </span>
          </SystemMessage>
        ) : null}

        <Field
          id={fieldId("liveUrl")}
          label={<Optional label={t("liveUrl")} note={t("optional")} />}
          hint={t("liveUrlHint")}
          error={fieldError("liveUrl")}
        >
          <Input
            {...errorProps("liveUrl")}
            type="url"
            inputMode="url"
            value={values.liveUrl}
            placeholder={t("liveUrlPlaceholder")}
            onChange={(event) => update("liveUrl", event.target.value)}
          />
        </Field>

        <AutofillAbout />
      </Answer>
    </>
  );
}

/** What "Lanjut" reads from the repo and the live page, folded under the fields. */
function AutofillAbout() {
  const t = useTranslations("projectForm.autofill.about");
  const sources = [
    { heading: t("repo"), items: [t("repoDescription"), t("repoReadme"), t("repoCommits")] },
    { heading: t("web"), items: [t("webTitle"), t("webTagline"), t("webImage"), t("webLang")] },
  ];

  return (
    <details className="group motion-details text-sm leading-5 text-ink-2">
      <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1.5 underline-offset-3 hover:underline [&::-webkit-details-marker]:hidden">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
          className="transition-transform group-open:rotate-90"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        {t("toggle")}
      </summary>
      <div className="mt-2 flex flex-col gap-3 rounded border border-border bg-surface px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((source) => (
            <div key={source.heading}>
              <p className="font-semibold text-ink">{source.heading}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {source.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-muted">{t("note")}</p>
      </div>
    </details>
  );
}
