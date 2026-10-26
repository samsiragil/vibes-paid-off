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
import { Link, useRouter } from "@/i18n/navigation";
import { autofillFromLinks, type AutofillSuggestion } from "@/lib/autofill/actions";
import { cn } from "@/lib/cn";
import { donateUrl } from "@/lib/donate";
import type { ProjectMedia } from "@/lib/media/limits";
import { scrollBehavior } from "@/lib/motion";
import { saveProject, type SaveProjectError } from "@/lib/projects/actions";
import {
  errorsOnStep,
  firstStepWithError,
  FORM_STEPS,
  stepIndex,
  type FormStep,
} from "@/lib/projects/form-steps";
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
} from "@/lib/projects/types";
import {
  PROJECT_LIMITS,
  projectFieldErrors,
  projectSchema,
  type ProjectFieldErrors,
  type ProjectInput,
} from "@/lib/validation/project";
import { fieldId, Stepper } from "./form/parts";
import { StepBuild } from "./form/step-build";
import { StepIntro } from "./form/step-intro";
import { StepPrompt } from "./form/step-prompt";
import { StepRepo, type RepoCheck } from "./form/step-repo";
import { StepReview } from "./form/step-review";
import { momentKeys, StepStory } from "./form/step-story";
import { FormSkeleton } from "./form-skeleton";
import type { MediaUploaderHandle } from "./media-uploader";
import { ProjectCardView } from "./project-card";
import { Turnstile, type TurnstileHandle } from "./turnstile";

export type ProjectFormMode =
  | { kind: "create"; isTrusted: boolean }
  | { kind: "edit"; projectId: string; slug: string; legacySessionCount: number };

type Success = { status: ProjectStatus; slug: string; mediaFailed: boolean };

/** What the repo check found, told at the top of step 2. */
type Found =
  | { kind: "public"; commits: number; days: number; pageFailed: boolean; imageFailed: boolean }
  | { kind: "private" }
  | { kind: "failed" };

/** Fields autofill may fill; each carries "terisi otomatis" until the maker changes it. */
const autofillKeys = ["title", "tagline", "description"] as const;

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
 * The conversational submit/edit form (VPO-Submit), one question per step: the site asks in short
 * notes, the maker answers under each one, and the card preview fills in beside it. Step 1 only
 * asks for the GitHub repo (the live link is optional) and checks it, so a private repo is a
 * question rather than an error. Shared by /submit and /p/[slug]/edit, where every step is open
 * and every step can save. Rendered only after hydration, so the submit draft (localStorage) can
 * seed the initial state without a server/client mismatch.
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
  const lastIndex = FORM_STEPS.length - 1;

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
  // "Tambah cerita" links to /p/[slug]/edit#cerita: open on the story step.
  const [step, setStep] = useState<FormStep>(() =>
    !isCreate && window.location.hash === "#cerita" ? "story" : "repo",
  );
  /** Furthest step the maker may jump to with the stepper (edit: all of them). */
  const [reachable, setReachable] = useState(isCreate ? 0 : lastIndex);
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
  const [repoCheck, setRepoCheck] = useState<RepoCheck>({ status: "idle" });
  const [found, setFound] = useState<Found | null>(null);
  const [autofilled, setAutofilled] = useState<ReadonlySet<string>>(new Set());
  const [suggestedEffort, setSuggestedEffort] = useState<BuildEffort | null>(null);
  /** Tools the repo check picked, marked in the tool picker until the maker changes the list. */
  const [detectedToolIds, setDetectedToolIds] = useState<number[]>([]);

  const uploaderRef = useRef<MediaUploaderHandle>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const focusErrorRef = useRef(false);
  const focusStepRef = useRef(false);
  const successRef = useRef<HTMLDivElement>(null);
  /** The live/repo links the repo check last ran for, so "Lanjut" does not repeat it. */
  const checkedForRef = useRef<string | null>(null);
  /** Links the edit page opened with: those need no check before moving on. */
  const savedLinks = initialProject ? linkKey(fromProjectInput(initialProject)) : null;

  // Keep the draft current while typing.
  useEffect(() => {
    if (!keepsDraft || success) return;
    const timer = setTimeout(() => {
      if (hasContent(values)) writeDraft(values);
      else clearDraft();
    }, 400);
    return () => clearTimeout(timer);
  }, [keepsDraft, success, values]);

  // After a failed step or submit, move focus to the first field with an error on that step.
  useEffect(() => {
    if (!focusErrorRef.current) return;
    focusErrorRef.current = false;
    focusStepRef.current = false;
    const first = document.querySelector<HTMLElement>(
      `[data-step="${step}"] [aria-invalid="true"]`,
    );
    first?.focus();
    first?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, [errors, step]);

  // A new step starts at its question, with focus on its heading for screen readers.
  useEffect(() => {
    if (!focusStepRef.current) return;
    focusStepRef.current = false;
    topRef.current?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
    document.getElementById(`pf-step-${step}`)?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (!success) return;
    successRef.current?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, [success]);

  const toolById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);

  function clearErrors(paths: string[]) {
    setErrors((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([path]) => !paths.includes(path))),
    );
  }

  function update<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setValues((previous) => ({
      ...previous,
      [key]: value,
      // A new repo link needs a new answer to "is it private?".
      ...(key === "repoUrl" ? { repoPrivate: false } : {}),
    }));
    if (errors[key]) clearErrors([key]);
    if (key === "repoUrl" || key === "liveUrl") setRepoCheck({ status: "idle" });
    if (autofilled.has(key)) {
      setAutofilled((previous) => new Set([...previous].filter((filled) => filled !== key)));
    }
    setSavedStatus(null);
  }

  function updateList<K extends "toolIds" | "suggestions">(
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

  function goTo(next: FormStep) {
    focusStepRef.current = true;
    setStep(next);
    setReachable((previous) => Math.max(previous, stepIndex(next)));
    setFormError(null);
  }

  /** Shows the errors and opens the step of the first one. */
  function showErrors(fieldErrors: ProjectFieldErrors, error: SaveProjectError | null) {
    const first = firstStepWithError(fieldErrors);
    if (first && first !== step) setStep(first);
    focusErrorRef.current = Object.keys(fieldErrors).length > 0;
    setErrors(fieldErrors);
    setFormError(error);
  }

  /** "Lanjut": checks only this step's answers, so the questions ahead do not complain yet. */
  function next() {
    const own = errorsOnStep(validate().fieldErrors, step);
    if (Object.keys(own).length > 0) {
      showErrors(own, null);
      return;
    }
    setErrors({});
    if (step === "repo") {
      void checkRepo();
      return;
    }
    goTo(FORM_STEPS[Math.min(stepIndex(step) + 1, lastIndex)]);
  }

  function back() {
    setErrors({});
    goTo(FORM_STEPS[Math.max(stepIndex(step) - 1, 0)]);
  }

  /**
   * Reads the repo (and the live page, when given) once per pair of links and fills the empty
   * fields. A repo GitHub cannot find stays on this step to ask whether it is private; anything
   * else moves on, a failed check included (it is only a convenience).
   */
  async function checkRepo() {
    const key = linkKey(values);
    if (key === savedLinks || key === checkedForRef.current) {
      const waiting =
        (repoCheck.status === "not_found" && !values.repoPrivate) ||
        repoCheck.status === "no_owner";
      if (!waiting) goTo("intro");
      return;
    }
    if (repoCheck.status === "checking") return;
    checkedForRef.current = key;
    setRepoCheck({ status: "checking" });

    const result = await autofillFromLinks({
      liveUrl: values.liveUrl.trim(),
      repoUrl: values.repoUrl.trim(),
    });
    if (!result.ok) {
      setRepoCheck({ status: "failed" });
      setFound({ kind: "failed" });
      goTo("intro");
      return;
    }

    const { suggestion } = result;
    fillFrom(suggestion);
    switch (suggestion.repoState) {
      case "not_found":
        setRepoCheck({ status: "not_found" });
        return;
      case "no_owner":
        setRepoCheck({ status: "no_owner", owner: repoOwner(values.repoUrl) });
        requestAnimationFrame(() => document.getElementById(fieldId("repoUrl"))?.focus());
        return;
      case "failed":
        setRepoCheck({ status: "failed" });
        setFound({ kind: "failed" });
        goTo("intro");
        return;
      case "public": {
        setRepoCheck({ status: "public" });
        const stats = suggestion.repo ?? { commits: 0, activeDays: 0 };
        const shown = {
          kind: "public",
          commits: stats.commits,
          days: stats.activeDays,
          pageFailed: suggestion.pageFailed,
          imageFailed: false,
        } as const;
        setFound(shown);
        goTo("intro");
        if (suggestion.imageUrl && mediaCount === 0) {
          const added = await addAutofillImage(suggestion.imageUrl);
          if (!added) setFound({ ...shown, imageFailed: true });
        }
      }
    }
  }

  /** Only empty fields are filled, so whatever the maker typed stays. */
  function fillFrom(suggestion: AutofillSuggestion) {
    const filled = autofillKeys.filter((key) => !values[key].trim() && suggestion[key]);
    const toolIdBySlug = new Map(tools.map((tool) => [tool.slug, tool.id]));
    const detected = values.toolIds.length
      ? []
      : suggestion.toolSlugs
          .flatMap((slug) => toolIdBySlug.get(slug) ?? [])
          .slice(0, PROJECT_LIMITS.maxTools);
    setDetectedToolIds(detected);
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
      toolIds: previous.toolIds.length ? previous.toolIds : detected,
    }));
    setAutofilled((previous) => new Set([...previous, ...filled]));
    setSuggestedEffort(suggestion.effort);
    setSavedStatus(null);
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

  function confirmPrivate() {
    setValues((previous) => ({ ...previous, repoPrivate: true }));
    setFound({ kind: "private" });
    setSavedStatus(null);
  }

  function undoPrivate() {
    setValues((previous) => ({ ...previous, repoPrivate: false }));
    setFound(null);
    requestAnimationFrame(() => document.getElementById(fieldId("repoUrl"))?.focus());
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    // On a new project, Enter in a field means "Lanjut" until the last step.
    if (isCreate && step !== "review") {
      next();
      return;
    }
    save();
  }

  function save() {
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

  function resetChecks() {
    setRepoCheck({ status: "idle" });
    setFound(null);
    setAutofilled(new Set());
    setSuggestedEffort(null);
    setDetectedToolIds([]);
    checkedForRef.current = null;
  }

  function startOver() {
    if (keepsDraft) clearDraft();
    setValues(emptyFormValues(values.contentLang));
    setErrors({});
    setFormError(null);
    setRestoredAt(null);
    setStep("repo");
    setReachable(0);
    resetChecks();
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
          setStep("repo");
          setReachable(0);
          resetChecks();
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const preview = (
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
  );

  const stepProps = { values, fieldError, errorProps, update };
  const submitLabel = isCreate ? (mode.isTrusted ? t("submitTrusted") : t("submit")) : t("save");
  const pendingLabel =
    phase === "uploading" ? t("uploading") : isCreate ? t("sending") : t("saving");
  const checking = repoCheck.status === "checking";
  const storyEmpty = Object.values(momentKeys).every((key) => values[key].trim() === "");
  const nextLabel = checking
    ? t("nav.checking")
    : step === "story"
      ? storyEmpty
        ? t("nav.skip")
        : t("nav.last")
      : t("nav.next");
  const onReview = step === "review";

  return (
    <div
      ref={topRef}
      // Past step 1 the page title and lede step back (see the submit and edit pages).
      data-compact={step === "repo" ? undefined : ""}
      className="flex scroll-mt-6 flex-col gap-10 pt-8 lg:flex-row lg:items-start lg:gap-14"
    >
      <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-col gap-6">
        <Stepper
          current={step}
          reachable={reachable}
          onSelect={(target) => {
            setErrors({});
            goTo(target);
          }}
        />

        {restoredAt && step === "repo" ? (
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

        {/* Every step stays mounted (hidden), so picked screenshots and open moments survive. */}
        <StepSection step="repo" current={step}>
          <StepRepo
            {...stepProps}
            check={repoCheck}
            onConfirmPrivate={confirmPrivate}
            onUndoPrivate={undoPrivate}
          />
        </StepSection>
        <StepSection step="intro" current={step}>
          <StepIntro
            {...stepProps}
            found={found ? <FoundMessage found={found} /> : null}
            autofilled={autofilled}
            uploaderRef={uploaderRef}
            projectId={isCreate ? undefined : mode.projectId}
            initialMedia={initialMedia}
            onMediaChange={(previews) => {
              setCoverUrl(previews[0]?.url ?? null);
              setMediaCount(previews.length);
            }}
          />
        </StepSection>
        <StepSection step="prompt" current={step}>
          <StepPrompt {...stepProps} />
        </StepSection>
        <StepSection step="build" current={step}>
          <StepBuild
            {...stepProps}
            updateList={updateList}
            suggestedEffort={suggestedEffort}
            detectedToolIds={detectedToolIds}
            tools={tools}
            quickPickIds={quickPickIds}
            categories={categories}
          />
        </StepSection>
        <StepSection step="story" current={step}>
          <StepStory {...stepProps} legacySessions={legacySessions} />
        </StepSection>
        <StepSection step="review" current={step}>
          <StepReview preview={preview} showRules={isCreate} />
        </StepSection>

        {/* Peek at the card on small screens; on wide ones it sits beside the form. */}
        {!onReview && step !== "repo" ? (
          <details className="group motion-details rounded border border-border bg-surface px-4 py-2 lg:hidden">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {t("nav.peek")}
            </summary>
            <div className="pt-2 pb-2">{preview}</div>
          </details>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-5">
          {onReview && isCreate && turnstileSiteKey ? (
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
              className="rounded border border-danger bg-surface px-4 py-3 text-base text-danger sm:ml-auto sm:max-w-[80%]"
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

          <div className="flex flex-wrap items-center gap-3">
            {step !== "repo" ? (
              <Button variant="ghost" onClick={back} disabled={isPending}>
                ← {t("nav.back")}
              </Button>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              {/* The submit button is what Enter presses: "Lanjut" on a new project, save on edit. */}
              {!isCreate ? (
                <Button
                  type="submit"
                  variant={onReview ? "accent" : "outline"}
                  size={onReview ? "lg" : "md"}
                  disabled={isPending}
                >
                  {isPending ? pendingLabel : submitLabel}
                </Button>
              ) : null}
              {onReview ? (
                isCreate ? (
                  <Button type="submit" variant="accent" size="lg" disabled={isPending}>
                    {isPending ? pendingLabel : `${submitLabel} ↑`}
                  </Button>
                ) : null
              ) : (
                <Button
                  type={isCreate ? "submit" : "button"}
                  variant={isCreate ? "accent" : "primary"}
                  size={isCreate ? "lg" : "md"}
                  disabled={checking}
                  onClick={isCreate ? undefined : next}
                >
                  {nextLabel} {checking ? null : <span aria-hidden="true">→</span>}
                </Button>
              )}
            </div>
          </div>
          {keepsDraft ? (
            <p className="text-[13px] leading-5 text-muted sm:text-right">{t("nav.autosave")}</p>
          ) : null}
        </div>
      </form>

      {onReview ? null : (
        <aside className="hidden shrink-0 flex-col gap-3 lg:sticky lg:top-6 lg:flex lg:w-[360px]">
          <Label>{t("preview.label")}</Label>
          <div key={step} className="motion-fade-in">
            {preview}
          </div>
          <p className="text-[13px] leading-normal text-ink-2">{t("preview.note")}</p>
        </aside>
      )}
    </div>
  );
}

/** "live repo", the pair of links one repo check is for. */
function linkKey(values: Pick<ProjectFormValues, "liveUrl" | "repoUrl">) {
  return `${values.liveUrl.trim()} ${values.repoUrl.trim()}`;
}

function repoOwner(repoUrl: string) {
  try {
    return new URL(repoUrl.trim()).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return "";
  }
}

/** One step's question and answers; only the current one shows. */
function StepSection({
  step,
  current,
  children,
}: {
  step: FormStep;
  current: FormStep;
  children: ReactNode;
}) {
  const active = step === current;
  return (
    <section
      data-step={step}
      hidden={!active}
      aria-labelledby={`pf-step-${step}`}
      className={cn("flex flex-col gap-5", active && "motion-fade-in")}
    >
      {children}
    </section>
  );
}

/** The small reward for step 1, opening step 2: what the repo check found, in plain words. */
function FoundMessage({ found }: { found: Found }) {
  const t = useTranslations("projectForm.autofill");
  if (found.kind === "failed") {
    return (
      <SystemMessage tone="soft">
        <span role="status">{t("failed")}</span>
      </SystemMessage>
    );
  }
  if (found.kind === "private") {
    return (
      <SystemMessage tone="soft">
        <span role="status">{t("privateRepo")}</span>
      </SystemMessage>
    );
  }
  return (
    <SystemMessage>
      <span role="status" className="flex flex-col py-1">
        {found.commits > 0 ? (
          <span className="font-hand text-[22px] leading-8 text-ink">
            {t("found", { commits: found.commits, days: found.days })}
          </span>
        ) : null}
        <span>{t("filled")}</span>
        {found.pageFailed ? <span className="text-ink-2">{t("nothing")}</span> : null}
        {found.imageFailed ? <span className="text-ink-2">{t("imageFailed")}</span> : null}
      </span>
    </SystemMessage>
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
