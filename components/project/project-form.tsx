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
import { MonoLabel } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { donateUrl } from "@/lib/donate";
import type { ProjectMedia } from "@/lib/media/limits";
import { saveProject, type SaveProjectError } from "@/lib/projects/actions";
import {
  clearDraft,
  emptyFormValues,
  fromProjectInput,
  hasContent,
  parseHours,
  readDraft,
  toProjectInput,
  writeDraft,
  type ProjectFormValues,
  type SessionValues,
} from "@/lib/projects/form-values";
import {
  isAiTool,
  toolsSummary,
  type CatalogTool,
  type ContentLang,
  type ProjectStatus,
} from "@/lib/projects/types";
import {
  PROJECT_LIMITS,
  projectFieldErrors,
  projectSchema,
  type ProjectFieldErrors,
  type ProjectInput,
} from "@/lib/validation/project";
import { FormSkeleton } from "./form-skeleton";
import { MediaUploader, type MediaUploaderHandle } from "./media-uploader";
import { ProjectCardView } from "./project-card";
import { SessionEditor } from "./session-editor";
import { ToolPicker } from "./tool-picker";
import { Turnstile, type TurnstileHandle } from "./turnstile";

export type ProjectFormMode =
  { kind: "create"; isTrusted: boolean } | { kind: "edit"; projectId: string; slug: string };

type Success = { status: ProjectStatus; slug: string; mediaFailed: boolean };

/** Ids of the form controls; errors focus the first one in page order. */
const fieldId = (path: string) => `pf-${path.replaceAll(".", "-")}`;
const inputClass = "h-11 rounded-xl bg-bg";
const textareaClass = "rounded-xl bg-bg";

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
 * The conversational submit/edit form (VPO-Submit): the site asks, the maker answers in
 * right-aligned bubbles, with a live card preview beside it. Shared by /submit and
 * /p/[slug]/edit. Rendered only after hydration, so the submit draft (localStorage) can seed
 * the initial state without a server/client mismatch.
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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const uploaderRef = useRef<MediaUploaderHandle>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const focusErrorRef = useRef(false);
  const successRef = useRef<HTMLDivElement>(null);

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
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [errors]);

  useEffect(() => {
    if (success) successRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [success]);

  const toolById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);

  function update<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) {
      setErrors((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([path]) => path !== key)),
      );
    }
    setSavedStatus(null);
  }

  function updateWith<K extends "toolIds" | "suggestions">(
    key: K,
    change: (previous: ProjectFormValues[K]) => ProjectFormValues[K],
  ) {
    setValues((previous) => ({ ...previous, [key]: change(previous[key]) }));
    if (errors[key] || errors.toolIds) {
      setErrors((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([path]) => path !== key && path !== "toolIds"),
        ),
      );
    }
    setSavedStatus(null);
  }

  function updateSessions(sessions: SessionValues[], options?: { reordered?: boolean }) {
    setValues((previous) => ({ ...previous, sessions }));
    setSavedStatus(null);
    // Session errors are keyed by position; after a move they would point at the wrong card.
    if (options?.reordered) {
      setErrors((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([path]) => !path.startsWith("sessions")),
        ),
      );
    }
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
  }

  // Live preview -------------------------------------------------------------------
  const sessionHours = values.sessions.map((session) => parseHours(session.durationHours));
  const totalHours = sessionHours.reduce(
    (sum, hours) =>
      sum +
      (Number.isFinite(hours) && hours > 0 && hours <= PROJECT_LIMITS.maxSessionHours ? hours : 0),
    0,
  );
  const sessionCount = values.sessions.length;
  const timeLabel =
    totalHours > 0
      ? tCard("timeAfterSessions", { hours: totalHours, sessions: sessionCount })
      : t("preview.time");
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
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const submitLabel = isCreate ? (mode.isTrusted ? t("submitTrusted") : t("submit")) : t("save");
  const pendingLabel =
    phase === "uploading" ? t("uploading") : isCreate ? t("sending") : t("saving");

  return (
    <div className="flex flex-col gap-10 pt-11 lg:flex-row lg:items-start lg:gap-14">
      <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-col gap-[18px]">
        {restoredAt ? (
          <SystemMessage tone="soft">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {t("draftRestored", { time: format.relativeTime(restoredAt) })}
              <button
                type="button"
                onClick={startOver}
                className="font-medium text-accent-text underline underline-offset-2"
              >
                {t("draftDiscard")}
              </button>
            </span>
          </SystemMessage>
        ) : null}

        <Question>{t.rich("steps.prompt", { strong })}</Question>
        <Answer
          className={cn("p-1.5 sm:p-1.5", errors.keyPrompt && "border-red-700 dark:border-red-400")}
        >
          <label htmlFor={fieldId("keyPrompt")} className="sr-only">
            {t("keyPrompt")}
          </label>
          <textarea
            {...errorProps("keyPrompt")}
            rows={3}
            value={values.keyPrompt}
            maxLength={PROJECT_LIMITS.keyPrompt}
            placeholder={t("keyPromptPlaceholder")}
            onChange={(event) => update("keyPrompt", event.target.value)}
            className="w-full resize-y rounded-[18px] bg-transparent px-3.5 py-3 font-display text-[19px] leading-[1.35] text-ink placeholder:text-muted focus:outline-none sm:text-[22px]"
          />
          <div className="flex items-baseline justify-between gap-3 px-3.5 pb-2">
            {fieldError("keyPrompt") ? (
              <p
                id={`${fieldId("keyPrompt")}-error`}
                className="text-[13px] text-red-700 dark:text-red-400"
              >
                {fieldError("keyPrompt")}
              </p>
            ) : (
              <span />
            )}
            <span className="font-mono text-xs text-muted">
              {values.keyPrompt.length}/{PROJECT_LIMITS.keyPrompt}
            </span>
          </div>
        </Answer>

        <Question>{t.rich("steps.result", { strong })}</Question>
        <Answer>
          <Field id={fieldId("title")} label={t("title")} error={fieldError("title")}>
            <Input
              {...errorProps("title")}
              value={values.title}
              maxLength={PROJECT_LIMITS.title}
              placeholder={t("titlePlaceholder")}
              onChange={(event) => update("title", event.target.value)}
              className={inputClass}
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
              className={inputClass}
            />
          </Field>
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
              className={textareaClass}
            />
          </Field>
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
                className={inputClass}
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
                className={inputClass}
              />
            </Field>
          </div>
        </Answer>

        <Question>{t.rich("steps.media", { strong })}</Question>
        <Answer>
          <MediaUploader
            ref={uploaderRef}
            projectId={isCreate ? undefined : mode.projectId}
            initialMedia={initialMedia}
            onChange={(change) => setCoverUrl(change.previews[0]?.url ?? null)}
          />
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
              className={inputClass}
            />
          </Field>
        </Answer>

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
                className={inputClass}
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
              <legend className="mb-2 text-sm font-medium text-ink">{t("contentLang")}</legend>
              <div className="flex h-11 items-center gap-5 text-[15px]">
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
        </Answer>

        <Question>{t.rich("steps.sessions", { strong })}</Question>
        <Answer className="bg-bg">
          <SessionEditor
            idPrefix={fieldId("sessions")}
            sessions={values.sessions}
            totalLabel={t("sessions.total", { hours: totalHours, sessions: sessionCount })}
            error={fieldError("sessions")}
            fieldError={(index, field) => fieldError(`sessions.${index}.${field}`)}
            onChange={updateSessions}
          />
        </Answer>

        <Question>{t.rich("steps.lessons", { strong })}</Question>
        <Answer>
          <Field
            id={fieldId("lessons")}
            label={<Optional label={t("lessons")} note={t("optional")} />}
            error={fieldError("lessons")}
          >
            <Textarea
              {...errorProps("lessons")}
              rows={3}
              value={values.lessons}
              maxLength={PROJECT_LIMITS.lessons}
              placeholder={t("lessonsPlaceholder")}
              onChange={(event) => update("lessons", event.target.value)}
              className={textareaClass}
            />
          </Field>
        </Answer>

        {isCreate ? (
          <Question>
            {t.rich("steps.rules", {
              link: (chunks) => (
                <Link href="/rules" className="font-medium text-accent-text underline">
                  {chunks}
                </Link>
              ),
            })}
            <ul className="mt-1.5 list-disc pl-[18px] text-ink-2">
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
              className="rounded-2xl border border-red-700/30 bg-surface px-4 py-3 text-sm text-red-700 sm:max-w-[80%] dark:border-red-400/30 dark:text-red-400"
            >
              {t(`formErrors.${formError}`)}
              {formError === "unauthorized" ? (
                <>
                  {" "}
                  <Link
                    href={`/login?next=${encodeURIComponent(isCreate ? `/${locale}/submit` : `/${locale}/p/${mode.slug}/edit`)}`}
                    className="font-medium underline"
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
        <MonoLabel>{t("preview.label")}</MonoLabel>
        <ProjectCardView
          makerName={maker.name}
          makerAvatarUrl={maker.avatarUrl}
          category={values.category ? tCategories(values.category) : undefined}
          prompt={values.keyPrompt.trim() || t("preview.prompt")}
          timeLabel={timeLabel}
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

/** The site's question, as a left-aligned chat bubble. */
function Question({ children }: { children: ReactNode }) {
  return (
    <SystemMessage className="mt-2 [&>div]:text-base [&>div]:leading-normal">
      {children}
    </SystemMessage>
  );
}

/** The maker's answer: a right-aligned bubble with the inputs. */
function Answer({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3.5 self-end rounded-[22px] rounded-br-md border border-ink bg-surface p-3.5 sm:w-[88%] sm:p-[18px]",
        className,
      )}
    >
      {children}
    </div>
  );
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
  const linkClass = "font-semibold text-accent-ink underline underline-offset-2";
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
    <div ref={ref} className="flex max-w-[760px] flex-col gap-5 pt-11">
      <div className="flex items-end gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm text-on-accent italic"
        >
          V
        </span>
        <div
          role="status"
          className="rounded-[20px] rounded-bl-md bg-accent-soft px-[18px] py-3.5 text-base leading-normal text-accent-ink"
        >
          {t.rich(success.status === "published" ? "published" : "pending", { link })}
        </div>
      </div>
      {success.mediaFailed ? (
        <SystemMessage>
          <span role="alert">{t("mediaFailed")}</span>
        </SystemMessage>
      ) : null}
      <div className="flex flex-wrap gap-3 pl-[46px]">
        <Link href={`/p/${success.slug}`} className={buttonStyles({ variant: "primary" })}>
          {t("view")}
        </Link>
        <Link href={`/p/${success.slug}/edit`} className={buttonStyles({ variant: "outline" })}>
          {t("edit")}
        </Link>
        <Button variant="ghost" onClick={onAnother}>
          {t("another")}
        </Button>
      </div>
    </div>
  );
}
