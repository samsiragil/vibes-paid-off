"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Label } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Link, useRouter } from "@/i18n/navigation";
import { autofillFromLinks, type AutofillSuggestion } from "@/lib/autofill/actions";
import { cn } from "@/lib/cn";
import { donateUrl } from "@/lib/donate";
import type { ProjectMedia } from "@/lib/media/limits";
import { scrollBehavior } from "@/lib/motion";
import { saveProject, type SaveProjectError } from "@/lib/projects/actions";
import {
  clearDraft,
  emptyFormValues,
  fromProjectInput,
  hasContent,
  readDraft,
  toProjectInput,
  writeDraft,
  type ProjectFormValues,
} from "@/lib/projects/form-values";
import {
  isAiTool,
  toolsSummary,
  type BuildEffort,
  type CatalogTool,
  type ContentLang,
  type ProjectStatus,
  type StoryMoment,
} from "@/lib/projects/types";
import {
  httpsUrlPattern,
  PROJECT_LIMITS,
  projectFieldErrors,
  projectSchema,
  type ProjectFieldErrors,
  type ProjectInput,
} from "@/lib/validation/project";
import { EffortPicker } from "./effort-picker";
import { FormSkeleton } from "./form-skeleton";
import { MediaUploader, type MediaUploaderHandle } from "./media-uploader";
import { ProjectCardView } from "./project-card";
import { StoryMoments } from "./story-moments";
import { ToolPicker } from "./tool-picker";
import { Turnstile, type TurnstileHandle } from "./turnstile";

export type ProjectFormMode =
  | { kind: "create"; isTrusted: boolean }
  | { kind: "edit"; projectId: string; slug: string; legacySessionCount: number };

type Success = { status: ProjectStatus; slug: string; mediaFailed: boolean };

/** Story moments and the form values that hold them ("redo" is lessons). */
const momentKeys = {
  wow: "momentWow",
  hardest: "momentHardest",
  redo: "lessons",
} as const satisfies Record<StoryMoment, keyof ProjectFormValues>;

type AutofillState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; suggestion: AutofillSuggestion; imageFailed: boolean }
  | { status: "error"; error: "unauthorized" | "rate_limit" | "failed" };

/** Ids of the form controls; errors focus the first one in page order. */
const fieldId = (path: string) => `pf-${path.replaceAll(".", "-")}`;

type ProjectFormProps = {
  mode: ProjectFormMode;
  maker: { name: string; avatarUrl: string | null };
  tools: CatalogTool[];
  quickPickIds: number[];
  categories: string[];
  initialProject?: ProjectInput;
  initialMedia?: ProjectMedia[];
  turnstileSiteKey?: string | null;
  /** Keep a localStorage draft of a new project (default true; off for the UI kit demo). */
  persistDraft?: boolean;
};

const subscribeNothing = () => () => {};

/**
 * The conversational submit/edit form (VPO-Submit): the site asks in short notes, the maker
 * answers in the fields under each one, with a live card preview beside it. Shared by /submit and
 * /p/[slug]/edit. Four answers publish a project (link, key prompt, rough build time, tools);
 * the build story is optional and can come later. Rendered only after hydration, so the submit
 * draft (localStorage) can seed the initial state without a server/client mismatch.
 */
export function ProjectForm(props: ProjectFormProps) {
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return hydrated ? <ProjectFormBody {...props} /> : <FormSkeleton />;
}

function ProjectFormBody({
  mode,
  maker,
  tools,
  quickPickIds,
  categories,
  initialProject,
  initialMedia = [],
  turnstileSiteKey,
  persistDraft = true,
}: ProjectFormProps) {
  const t = useTranslations("projectForm");
  const tCard = useTranslations("projectCard");
  const tCategories = useTranslations("categories");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const isCreate = mode.kind === "create";
  const keepsDraft = isCreate && persistDraft;

  // Drafts live in localStorage, so this component only renders in the browser (see ProjectForm).
  const [draft] = useState(() => {
    if (!keepsDraft) return null;
    const stored = readDraft();
    return stored && hasContent(stored.values) ? stored : null;
  });
  const [values, setValues] = useState<ProjectFormValues>(() =>
    initialProject
      ? fromProjectInput(initialProject)
      : (draft?.values ?? emptyFormValues(locale as ContentLang)),
  );
  const [errors, setErrors] = useState<ProjectFieldErrors>({});
  const [formError, setFormError] = useState<SaveProjectError | null>(null);
  const [phase, setPhase] = useState<"saving" | "uploading">("saving");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<Success | null>(null);
  const [savedStatus, setSavedStatus] = useState<ProjectStatus | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(draft?.savedAt ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [mediaCount, setMediaCount] = useState(initialMedia.length);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [autofill, setAutofill] = useState<AutofillState>({ status: "idle" });
  const [suggestedEffort, setSuggestedEffort] = useState<BuildEffort | null>(null);

  const uploaderRef = useRef<MediaUploaderHandle>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const focusErrorRef = useRef(false);
  const successRef = useRef<HTMLDivElement>(null);
  /** The live/repo links autofill last ran for, so leaving the field does not repeat it. */
  const autofilledForRef = useRef<string | null>(null);

  // Keep the draft current while typing.
  useEffect(() => {
    if (!keepsDraft || success) return;
    const timer = setTimeout(() => {
      if (hasContent(values)) writeDraft(values);
      else clearDraft();
    }, 400);
    return () => clearTimeout(timer);
  }, [keepsDraft, success, values]);

  // After a failed submit, move focus to the first field with an error.
  useEffect(() => {
    if (!focusErrorRef.current) return;
    focusErrorRef.current = false;
    const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    first?.focus();
    first?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, [errors]);

  useEffect(() => {
    if (!success) return;
    successRef.current?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, [success]);

  // "Tambah cerita" links to /p/[slug]/edit#cerita; the form renders after hydration, so the
  // browser's own jump to the anchor happened before the section existed.
  useEffect(() => {
    if (window.location.hash === "#cerita") {
      document.getElementById("cerita")?.scrollIntoView({ block: "start" });
    }
  }, []);

  const toolById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);

  function clearErrors(paths: string[]) {
    setErrors((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([path]) => !paths.includes(path))),
    );
  }

  function update<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) clearErrors([key]);
    setSavedStatus(null);
  }

  function updateWith<K extends "toolIds" | "suggestions">(
    key: K,
    change: (previous: ProjectFormValues[K]) => ProjectFormValues[K],
  ) {
    setValues((previous) => ({ ...previous, [key]: change(previous[key]) }));
    if (errors[key] || errors.toolIds) clearErrors([key, "toolIds"]);
    setSavedStatus(null);
  }

  function fieldError(path: string) {
    const code = errors[path];
    return code ? t(`errors.${code}`) : undefined;
  }

  function errorProps(path: string) {
    const error = errors[path];
    return {
      id: fieldId(path),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${fieldId(path)}-error` : undefined,
    } as const;
  }

  function validate() {
    const parsed = projectSchema.safeParse(toProjectInput(values));
    const fieldErrors = parsed.success ? {} : projectFieldErrors(parsed.error);
    const hasAiTool = values.toolIds.some((toolId) => {
      const tool = toolById.get(toolId);
      return tool ? isAiTool(tool.kind) : false;
    });
    if (!hasAiTool) fieldErrors.toolIds ??= "ai_tool_required";
    return { parsed, fieldErrors };
  }

  function showErrors(fieldErrors: ProjectFieldErrors, error: SaveProjectError) {
    focusErrorRef.current = Object.keys(fieldErrors).length > 0;
    setErrors(fieldErrors);
    setFormError(error);
  }

  /**
   * Fills the form from the live page and repo. Only empty fields are filled, so whatever the
   * maker typed stays; the screenshot is added only while there is none.
   */
  async function runAutofill() {
    const liveUrl = values.liveUrl.trim();
    const repoUrl = values.repoUrl.trim();
    if (!httpsUrlPattern.test(liveUrl) || autofill.status === "loading") return;
    autofilledForRef.current = `${liveUrl} ${repoUrl}`;
    setAutofill({ status: "loading" });

    const result = await autofillFromLinks({ liveUrl, repoUrl });
    if (!result.ok) {
      setAutofill({ status: "error", error: result.error === "invalid" ? "failed" : result.error });
      return;
    }
    const { suggestion } = result;
    setValues((previous) => ({
      ...previous,
      title: previous.title.trim() ? previous.title : (suggestion.title ?? previous.title),
      tagline: previous.tagline.trim()
        ? previous.tagline
        : (suggestion.tagline ?? previous.tagline),
      description: previous.description.trim()
        ? previous.description
        : (suggestion.description ?? previous.description),
      // A new project's language follows the page; an existing one keeps what the maker chose.
      contentLang:
        isCreate && suggestion.contentLang ? suggestion.contentLang : previous.contentLang,
      buildEffort: previous.buildEffort || (suggestion.effort ?? ""),
    }));
    clearErrors(["title", "tagline", "description", "buildEffort"]);
    setSuggestedEffort(suggestion.effort);
    setSavedStatus(null);

    let imageFailed = false;
    if (suggestion.imageUrl && mediaCount === 0) {
      imageFailed = !(await addAutofillImage(suggestion.imageUrl));
    }
    setAutofill({ status: "done", suggestion, imageFailed });
  }

  async function addAutofillImage(url: string) {
    try {
      const response = await fetch("/api/autofill/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) return false;
      const blob = await response.blob();
      const extension = blob.type.split("/")[1] ?? "png";
      uploaderRef.current?.addFiles([
        new File([blob], `screenshot.${extension}`, { type: blob.type }),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  /** Leaving a link field runs autofill once per link pair, while title and tagline are empty. */
  function autofillOnBlur() {
    if (autofilledForRef.current === `${values.liveUrl.trim()} ${values.repoUrl.trim()}`) return;
    if (values.title.trim() || values.tagline.trim()) return;
    void runAutofill();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setSavedStatus(null);

    const { parsed, fieldErrors } = validate();
    if (!parsed.success || Object.keys(fieldErrors).length > 0) {
      showErrors(fieldErrors, "invalid");
      return;
    }
    if (isCreate && turnstileSiteKey && !turnstileToken) {
      showErrors({}, "captcha");
      return;
    }

    setErrors({});
    setFormError(null);
    setPhase("saving");
    startTransition(async () => {
      const result = await saveProject({
        projectId: isCreate ? undefined : mode.projectId,
        turnstileToken: turnstileToken ?? undefined,
        project: parsed.data,
      });
      if (isCreate) {
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }

      if (!result.ok) {
        showErrors(result.fieldErrors ?? {}, result.error);
        return;
      }

      if (!isCreate) {
        setSavedStatus(result.status);
        router.refresh();
        return;
      }

      setPhase("uploading");
      const stored = (await uploaderRef.current?.uploadPending(result.id)) ?? true;
      if (keepsDraft) clearDraft();
      setSuccess({ status: result.status, slug: result.slug, mediaFailed: !stored });
    });
  }

  function startOver() {
    if (keepsDraft) clearDraft();
    setValues(emptyFormValues(values.contentLang));
    setErrors({});
    setFormError(null);
    setRestoredAt(null);
    setAutofill({ status: "idle" });
    setSuggestedEffort(null);
    autofilledForRef.current = null;
  }

  // Live preview -------------------------------------------------------------------
  const timeLabel = values.buildEffort
    ? tCard("effortAfter", { effort: values.buildEffort })
    : t("preview.time");
  const legacySessions = mode.kind === "edit" ? mode.legacySessionCount : 0;
  const hasStory =
    legacySessions > 0 || Object.values(momentKeys).some((key) => values[key].trim() !== "");
  const summary = toolsSummary([
    ...values.toolIds.flatMap((toolId) => {
      const tool = toolById.get(toolId);
      return tool ? [{ name: tool.name, ai: isAiTool(tool.kind) }] : [];
    }),
    ...values.suggestions.map((suggestion) => ({ name: suggestion.name, ai: false })),
  ]);
  const toolsLabel = summary.names
    ? summary.rest > 0
      ? `${summary.names} ${tCard("moreTools", { count: summary.rest })}`
      : summary.names
    : t("preview.tools");

  if (success) {
    return (
      <SuccessMessage
        ref={successRef}
        success={success}
        locale={locale}
        onAnother={() => {
          setValues(emptyFormValues(values.contentLang));
          setSuccess(null);
          setRestoredAt(null);
          setAutofill({ status: "idle" });
          setSuggestedEffort(null);
          autofilledForRef.current = null;
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const submitLabel = isCreate ? (mode.isTrusted ? t("submitTrusted") : t("submit")) : t("save");
  const pendingLabel =
    phase === "uploading" ? t("uploading") : isCreate ? t("sending") : t("saving");
  const canAutofill = httpsUrlPattern.test(values.liveUrl.trim());
  const extrasOpen = Boolean(
    values.description.trim() || values.videoUrl.trim() || errors.description || errors.videoUrl,
  );

  return (
    <div className="flex flex-col gap-10 pt-10 lg:flex-row lg:items-start lg:gap-14">
      <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-col gap-4">
        {restoredAt ? (
          <SystemMessage tone="soft">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {t("draftRestored", { time: format.relativeTime(restoredAt) })}
              <button
                type="button"
                onClick={startOver}
                className="font-semibold text-accent-text underline underline-offset-3"
              >
                {t("draftDiscard")}
              </button>
            </span>
          </SystemMessage>
        ) : null}

        {/* 1. Link: autofill fills title, tagline and the first screenshot. */}
        <Question>{t.rich("steps.link", { strong })}</Question>
        <Answer>
          <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
            <Field id={fieldId("liveUrl")} label={t("liveUrl")} error={fieldError("liveUrl")}>
              <Input
                {...errorProps("liveUrl")}
                type="url"
                inputMode="url"
                autoComplete="url"
                value={values.liveUrl}
                placeholder={t("liveUrlPlaceholder")}
                onChange={(event) => update("liveUrl", event.target.value)}
                onBlur={autofillOnBlur}
              />
            </Field>
            <Field
              id={fieldId("repoUrl")}
              label={<Optional label={t("repoUrl")} note={t("optional")} />}
              error={fieldError("repoUrl")}
            >
              <Input
                {...errorProps("repoUrl")}
                type="url"
                inputMode="url"
                value={values.repoUrl}
                placeholder={t("repoUrlPlaceholder")}
                onChange={(event) => update("repoUrl", event.target.value)}
                onBlur={autofillOnBlur}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canAutofill || autofill.status === "loading"}
              onClick={() => void runAutofill()}
            >
              {autofill.status === "loading" ? t("autofill.fetching") : t("autofill.fetch")}
            </Button>
            <AutofillStatus state={autofill} />
          </div>
          <AutofillAbout />

          <Field id={fieldId("title")} label={t("title")} error={fieldError("title")}>
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
            label={t("tagline")}
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
            <p className="text-[13px] leading-4 font-semibold text-ink">{t("screenshots")}</p>
            <MediaUploader
              ref={uploaderRef}
              projectId={isCreate ? undefined : mode.projectId}
              initialMedia={initialMedia}
              onChange={(change) => {
                setCoverUrl(change.previews[0]?.url ?? null);
                setMediaCount(change.previews.length);
              }}
            />
          </div>
        </Answer>

        {/* 2. Key prompt. */}
        <Question>{t.rich("steps.prompt", { strong })}</Question>
        <Answer>
          {/* The page's main field: a ruled note with the margin line (README §6). */}
          <div
            className={cn(
              "relative overflow-hidden rounded-md border-[1.5px] bg-surface transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
              errors.keyPrompt ? "border-danger" : "border-border-strong hover:border-ink",
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
            {fieldError("keyPrompt") ? (
              <p id={`${fieldId("keyPrompt")}-error`} className="text-sm text-danger">
                {fieldError("keyPrompt")}
              </p>
            ) : (
              <span />
            )}
            <span className="text-[13px] text-muted tabular-nums">
              {values.keyPrompt.length}/{PROJECT_LIMITS.keyPrompt}
            </span>
          </div>
        </Answer>

        {/* 3. Rough build time. */}
        <Question>{t.rich("steps.effort", { strong })}</Question>
        <Answer>
          <EffortPicker
            id={fieldId("buildEffort")}
            value={values.buildEffort}
            suggested={suggestedEffort}
            error={fieldError("buildEffort")}
            onChange={(effort) => update("buildEffort", effort)}
          />
        </Answer>

        {/* 4. Tools, category and language. */}
        <Question>{t.rich("steps.tools", { strong })}</Question>
        <Answer>
          <ToolPicker
            id={fieldId("toolIds")}
            tools={tools}
            quickPickIds={quickPickIds}
            selectedIds={values.toolIds}
            suggestions={values.suggestions}
            error={fieldError("toolIds") ?? fieldError("suggestions")}
            onSelectedChange={(change) => updateWith("toolIds", change)}
            onSuggestionsChange={(change) => updateWith("suggestions", change)}
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

        {/* Optional: the build story, now or later from the edit page. */}
        <div id="cerita" className="scroll-mt-6">
          <Question>{t.rich("steps.story", { strong })}</Question>
        </div>
        <Answer>
          <StoryMoments
            idFor={(moment) => fieldId(momentKeys[moment])}
            values={{
              wow: values.momentWow,
              hardest: values.momentHardest,
              redo: values.lessons,
            }}
            fieldError={(moment) => fieldError(momentKeys[moment])}
            onChange={(moment, value) => update(momentKeys[moment], value)}
          />
          {legacySessions > 0 ? (
            <p className="text-[13px] leading-normal text-muted">
              {t("moments.legacy", { count: legacySessions })}
            </p>
          ) : null}
        </Answer>

        {isCreate ? (
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

        <div className="mt-2 flex flex-col items-stretch gap-3 sm:items-end">
          {isCreate && turnstileSiteKey ? (
            <div className="flex flex-col gap-1.5 sm:items-end">
              <span className="sr-only">{t("turnstile")}</span>
              <Turnstile
                ref={turnstileRef}
                action="submit_project"
                siteKey={turnstileSiteKey}
                language={locale}
                onToken={setTurnstileToken}
              />
            </div>
          ) : null}

          {formError ? (
            <div
              role="alert"
              className="rounded border border-danger bg-surface px-4 py-3 text-base text-danger sm:max-w-[80%]"
            >
              {t(`formErrors.${formError}`)}
              {formError === "unauthorized" ? (
                <>
                  {" "}
                  <Link
                    href={`/login?next=${encodeURIComponent(isCreate ? `/${locale}/submit` : `/${locale}/p/${mode.slug}/edit`)}`}
                    className="font-semibold underline underline-offset-3"
                  >
                    {t("signIn")}
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          {savedStatus ? (
            <SystemMessage tone="soft" className="sm:self-end">
              <span role="status">
                {savedStatus === "pending" ? t("savedPending") : t("saved")}
              </span>
            </SystemMessage>
          ) : null}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            disabled={isPending}
            className="sm:self-end"
          >
            {isPending ? pendingLabel : `${submitLabel} ↑`}
          </Button>
        </div>
      </form>

      <aside className="flex shrink-0 flex-col gap-3 lg:sticky lg:top-6 lg:w-[360px]">
        <Label>{t("preview.label")}</Label>
        <ProjectCardView
          makerName={maker.name}
          makerAvatarUrl={maker.avatarUrl}
          category={values.category ? tCategories(values.category) : undefined}
          prompt={values.keyPrompt.trim() || t("preview.prompt")}
          timeLabel={timeLabel}
          story={hasStory ? tCard("story") : undefined}
          imageUrl={coverUrl}
          title={values.title.trim() || t("preview.title")}
          tools={toolsLabel}
          worthIt={tCard("worthIt", { count: 0 })}
          muted={!values.keyPrompt.trim() && !values.title.trim()}
        />
        <p className="text-[13px] leading-normal text-ink-2">{t("preview.note")}</p>
      </aside>
    </div>
  );
}

function strong(chunks: ReactNode) {
  return <strong className="font-semibold">{chunks}</strong>;
}

/** What autofill found (or why it found nothing), next to the "Ambil info" button. */
function AutofillStatus({ state }: { state: AutofillState }) {
  const t = useTranslations("projectForm");
  const tMedia = useTranslations("media.errors");
  if (state.status === "idle" || state.status === "loading") return null;

  const lines: string[] = [];
  if (state.status === "error") {
    lines.push(
      state.error === "unauthorized"
        ? t("formErrors.unauthorized")
        : state.error === "rate_limit"
          ? tMedia("rate_limit")
          : t("autofill.failed"),
    );
  } else {
    const { suggestion } = state;
    lines.push(suggestion.pageFailed ? t("autofill.nothing") : t("autofill.filled"));
    if (suggestion.repo)
      lines.push(
        t("autofill.repo", {
          commits: suggestion.repo.commits,
          days: suggestion.repo.activeDays,
        }),
      );
    if (suggestion.repoFailed) lines.push(t("autofill.repoFailed"));
    if (state.imageFailed) lines.push(t("autofill.imageFailed"));
  }

  return (
    <p role="status" className="min-w-0 flex-1 text-sm leading-5 text-ink-2">
      {lines.join(" ")}
    </p>
  );
}

/** What "Ambil info" reads from the live page and the repo, folded under the button. */
function AutofillAbout() {
  const t = useTranslations("projectForm.autofill.about");
  const sources = [
    { heading: t("web"), items: [t("webTitle"), t("webTagline"), t("webImage"), t("webLang")] },
    { heading: t("repo"), items: [t("repoDescription"), t("repoReadme"), t("repoCommits")] },
  ];

  return (
    <details className="group -mt-1.5 motion-details text-sm leading-5 text-ink-2">
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

/** The site's question, as a short note from the site (system avatar + ruled note). */
function Question({ children }: { children: ReactNode }) {
  return <SystemMessage className="mt-6">{children}</SystemMessage>;
}

/** The maker's answer: the inputs, written under the question (indented past the avatar). */
function Answer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-4 sm:pl-12", className)}>{children}</div>;
}

function Optional({ label, note }: { label: string; note: string }) {
  return (
    <>
      {label} <span className="font-normal text-muted">{note}</span>
    </>
  );
}

function SuccessMessage({
  success,
  locale,
  onAnother,
  ref,
}: {
  success: Success;
  locale: string;
  onAnother: () => void;
  ref: Ref<HTMLDivElement>;
}) {
  const t = useTranslations("projectForm.success");
  const external = donateUrl(locale);
  const linkClass = "font-semibold text-accent-text underline underline-offset-3";
  const link = (chunks: ReactNode) =>
    external ? (
      <a href={external} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {chunks}
      </a>
    ) : (
      <Link href="/support" className={linkClass}>
        {chunks}
      </Link>
    );

  return (
    <div ref={ref} className="flex max-w-[760px] flex-col gap-5 pt-10 motion-fade-in">
      <SystemMessage>
        <span role="status">
          {t.rich(success.status === "published" ? "published" : "pending", { link })}
        </span>
      </SystemMessage>
      {success.mediaFailed ? (
        <SystemMessage>
          <span role="alert">{t("mediaFailed")}</span>
        </SystemMessage>
      ) : null}
      <SystemMessage>{t("story")}</SystemMessage>
      <div className="flex flex-wrap gap-3 sm:pl-12">
        <Link href={`/p/${success.slug}`} className={buttonStyles({ variant: "primary" })}>
          {t("view")}
        </Link>
        <Link
          href={`/p/${success.slug}/edit#cerita`}
          className={buttonStyles({ variant: "outline" })}
        >
          {t("addStory")}
        </Link>
        <Button variant="ghost" onClick={onAnother}>
          {t("another")}
        </Button>
      </div>
    </div>
  );
}
