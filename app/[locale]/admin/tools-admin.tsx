"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  resolveToolSuggestion,
  saveTool,
  type ResolveSuggestionResult,
  type SaveToolResult,
} from "@/lib/admin/actions";
import type { AdminTool, SuggestionGroup } from "@/lib/admin/data";
import { TOOL_KINDS, type ToolKind } from "@/lib/projects/types";
import {
  slugifyToolName,
  TOOL_LIMITS,
  type ToolFormErrors,
  type ToolFormValues,
} from "@/lib/validation/admin";
import { useActionLog } from "./action-log";

type Editing =
  | { mode: "new" }
  | { mode: "edit"; tool: AdminTool }
  | { mode: "suggestion"; group: SuggestionGroup };

type ErrorCode =
  | Exclude<SaveToolResult, { ok: true }>["error"]
  | Exclude<ResolveSuggestionResult, { ok: true }>["error"];

/** Catalog table with search, the suggestion queue, and the add/edit dialog. */
export function ToolsAdmin({
  tools,
  suggestions,
}: {
  tools: AdminTool[];
  suggestions: SuggestionGroup[];
}) {
  const t = useTranslations("admin.tools");
  const tKinds = useTranslations("toolKinds");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ToolKind | "all">("all");
  const [editing, setEditing] = useState<Editing | null>(null);
  const searchId = useId();
  const kindId = useId();

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tools.filter(
      (tool) =>
        (kind === "all" || tool.kind === kind) &&
        (!needle || tool.name.toLowerCase().includes(needle) || tool.slug.includes(needle)),
    );
  }, [tools, query, kind]);

  const columns =
    "md:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_64px_72px] md:items-center md:gap-4";

  return (
    <>
      {suggestions.length > 0 ? (
        <section aria-labelledby="suggestions-title" className="flex flex-col gap-3">
          <h2 id="suggestions-title" className="text-[13px] font-semibold text-muted">
            {t("suggestions.title", { count: suggestions.length })}
          </h2>
          <p className="max-w-[640px] text-sm text-ink-2">{t("suggestions.lede")}</p>
          <ul className="flex flex-col gap-3">
            {suggestions.map((group) => (
              <li key={group.name.toLowerCase()}>
                <SuggestionCard
                  group={group}
                  tools={tools}
                  onCreate={() => setEditing({ mode: "suggestion", group })}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex grow flex-col gap-1.5">
          <label htmlFor={searchId} className="text-sm font-medium">
            {t("search")}
          </label>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label htmlFor={kindId} className="text-sm font-medium">
            {t("kindFilter")}
          </label>
          <Select
            id={kindId}
            value={kind}
            onChange={(event) => setKind(event.target.value as ToolKind | "all")}
            className="h-11"
          >
            <option value="all">{t("allKinds")}</option>
            {TOOL_KINDS.map((value) => (
              <option key={value} value={value}>
                {tKinds(value)}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ mode: "new" })}
          className={buttonStyles({ variant: "accent" })}
        >
          {t("add")}
        </button>
      </div>

      <div className="rounded border border-border bg-surface px-4 py-2 sm:px-5">
        <div
          aria-hidden="true"
          className={`hidden py-3 text-[13px] font-semibold text-muted md:grid ${columns}`}
        >
          <span />
          <span>{t("table.name")}</span>
          <span>{t("table.slug")}</span>
          <span>{t("table.kind")}</span>
          <span>{t("table.projects")}</span>
          <span />
        </div>
        <p className="py-3 text-[13px] text-muted md:hidden" aria-live="polite">
          {t("shown", { count: shown.length, total: tools.length })}
        </p>
        {shown.length === 0 ? (
          <p className="border-t border-border py-6 text-sm text-ink-2">{t("noMatch")}</p>
        ) : (
          <ul>
            {shown.map((tool) => (
              <li
                key={tool.id}
                className={cn("grid gap-2 border-t border-border py-3 text-base", columns)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "hidden size-10 items-center justify-center rounded border border-border text-base font-bold md:flex",
                    tool.isActive ? "bg-surface text-ink" : "bg-placeholder text-muted",
                  )}
                >
                  {monogram(tool.name)}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                  <span className="break-words">{tool.name}</span>
                  {!tool.isActive ? (
                    <span className="rounded border border-dashed border-muted px-1.5 text-[13px] font-normal text-ink-2">
                      {t("inactive")}
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 text-sm break-all text-ink-2">
                  {tool.isActive ? (
                    <Link href={`/tools/${tool.slug}`} className="hover:underline">
                      /tools/{tool.slug}
                    </Link>
                  ) : (
                    `/tools/${tool.slug}`
                  )}
                </span>
                <span className="text-[13px] text-ink-2">{tKinds(tool.kind)}</span>
                <span className="text-sm tabular-nums">
                  <span className="text-muted md:sr-only">{t("table.projects")} </span>
                  {tool.projectCount}
                </span>
                <span className="md:justify-self-end">
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", tool })}
                    className="inline-flex min-h-11 items-center text-sm text-accent-text hover:underline"
                  >
                    {t("edit")}
                    <span className="sr-only">: {tool.name}</span>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ToolDialog editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function monogram(name: string) {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.slice(0, 2) || "?";
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function SuggestionCard({
  group,
  tools,
  onCreate,
}: {
  group: SuggestionGroup;
  tools: AdminTool[];
  onCreate: () => void;
}) {
  const t = useTranslations("admin.tools");
  const tKinds = useTranslations("toolKinds");
  const tStatus = useTranslations("me.status");
  const log = useActionLog();
  const [toolId, setToolId] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const selectId = useId();

  const active = tools.filter((tool) => tool.isActive);

  function run(input: { action: "merge"; toolId: number } | { action: "reject" }) {
    setError(null);
    startTransition(async () => {
      const result = await resolveToolSuggestion({ name: group.name, ...input });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      log(
        input.action === "merge"
          ? t("done.merged", {
              name: group.name,
              tool: active.find((tool) => tool.id === input.toolId)?.name ?? "",
              count: group.projects.length,
            })
          : t("done.rejected", { name: group.name }),
      );
    });
  }

  return (
    <article className="flex flex-col gap-4 rounded border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[17px] font-semibold break-words">{group.name}</h3>
        {group.urls.length > 0 ? (
          <p className="flex flex-wrap gap-x-3 text-sm">
            {group.urls.map((url) => (
              <ExternalLink
                key={url}
                href={url}
                className="break-all text-accent-text hover:underline"
              >
                {url.replace(/^https:\/\//, "")}
              </ExternalLink>
            ))}
          </p>
        ) : null}
        <p className="text-sm text-ink-2">
          {t("suggestions.usedIn", { count: group.projects.length })}{" "}
          {group.projects.map((project, index) => (
            <span key={project.slug}>
              {index > 0 ? ", " : null}
              <Link href={`/p/${project.slug}`} className="text-ink hover:underline">
                {project.title}
              </Link>
              {project.status !== "published"
                ? ` (${tStatus(project.status).toLowerCase()})`
                : null}
            </span>
          ))}
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <div className="flex grow flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            {t("suggestions.mergeLabel")}
          </label>
          <Select
            id={selectId}
            value={toolId}
            onChange={(event) => setToolId(event.target.value)}
            className="h-11"
          >
            <option value="">{t("suggestions.pickTool")}</option>
            {TOOL_KINDS.map((kind) => (
              <optgroup key={kind} label={tKinds(kind)}>
                {active
                  .filter((tool) => tool.kind === kind)
                  .map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!toolId || pending}
            onClick={() => run({ action: "merge", toolId: Number(toolId) })}
            className={buttonStyles({ variant: "primary" })}
          >
            {t("suggestions.merge")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onCreate}
            className={buttonStyles({ variant: "outline" })}
          >
            {t("suggestions.create")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run({ action: "reject" })}
            className={buttonStyles({ variant: "ghost" })}
          >
            {t("suggestions.reject")}
          </button>
        </div>
      </div>
      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ? t(`errors.${error}`) : ""}
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Add / edit dialog
// ---------------------------------------------------------------------------

const emptyValues: ToolFormValues = {
  name: "",
  slug: "",
  url: "",
  logoUrl: "",
  kind: "ai_agent",
  descriptionId: "",
  descriptionEn: "",
  isActive: true,
};

function initialValues(editing: Editing): ToolFormValues {
  if (editing.mode === "edit") {
    const { tool } = editing;
    return {
      name: tool.name,
      slug: tool.slug,
      url: tool.url ?? "",
      logoUrl: tool.logoUrl ?? "",
      kind: tool.kind,
      descriptionId: tool.descriptionId,
      descriptionEn: tool.descriptionEn,
      isActive: tool.isActive,
    };
  }
  if (editing.mode === "suggestion") {
    return {
      ...emptyValues,
      name: editing.group.name,
      slug: slugifyToolName(editing.group.name),
      url: editing.group.urls[0] ?? "",
    };
  }
  return emptyValues;
}

function ToolDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (editing && dialog && !dialog.open) dialog.showModal();
    if (!editing && dialog?.open) dialog.close();
  }, [editing]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-md border border-border bg-bg p-0 text-ink backdrop:bg-ink/40 sm:m-auto sm:max-w-[560px] sm:rounded"
    >
      {editing ? (
        <ToolForm
          key={editing.mode === "edit" ? editing.tool.id : editing.mode}
          editing={editing}
          titleId={titleId}
          onDone={() => dialogRef.current?.close()}
        />
      ) : null}
    </dialog>
  );
}

function ToolForm({
  editing,
  titleId,
  onDone,
}: {
  editing: Editing;
  titleId: string;
  onDone: () => void;
}) {
  const t = useTranslations("admin.tools");
  const tForm = useTranslations("admin.tools.form");
  const tKinds = useTranslations("toolKinds");
  const log = useActionLog();
  const [values, setValues] = useState<ToolFormValues>(() => initialValues(editing));
  // A new tool's slug follows its name until the admin types a slug of their own.
  const [slugTouched, setSlugTouched] = useState(editing.mode === "edit");
  const [fieldErrors, setFieldErrors] = useState<ToolFormErrors>({});
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  function set<K extends keyof ToolFormValues>(key: K, value: ToolFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugifyToolName(String(value));
      return next;
    });
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result =
        editing.mode === "suggestion"
          ? await resolveToolSuggestion({
              name: editing.group.name,
              action: "create",
              tool: values,
            })
          : await saveTool(editing.mode === "edit" ? editing.tool.id : null, values);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) document.getElementById(`${id}-${first}`)?.focus();
        return;
      }
      log(
        editing.mode === "suggestion"
          ? t("done.created", { name: values.name.trim(), count: editing.group.projects.length })
          : t(editing.mode === "edit" ? "done.saved" : "done.added", { name: values.name.trim() }),
      );
      onDone();
    });
  }

  const fieldError = (field: keyof ToolFormValues) => {
    const code = fieldErrors[field];
    if (!code) return undefined;
    if (field === "slug" && error === "slug_taken") return tForm("errors.slug_taken");
    return tForm(`errors.${code}`, { max: TOOL_LIMITS[field as keyof typeof TOOL_LIMITS] ?? 0 });
  };
  const describe = (field: keyof ToolFormValues) =>
    fieldErrors[field] ? `${id}-${field}-error` : undefined;

  const title =
    editing.mode === "edit"
      ? tForm("titleEdit", { name: editing.tool.name })
      : editing.mode === "suggestion"
        ? tForm("titleFromSuggestion", { name: editing.group.name })
        : tForm("titleNew");

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5 p-5 sm:p-6"
    >
      <h2 id={titleId} className="text-[22px] leading-7 font-semibold">
        {title}
      </h2>
      {editing.mode === "suggestion" ? (
        <p className="text-sm text-ink-2">
          {tForm("suggestionNote", { count: editing.group.projects.length })}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-name`} label={tForm("name")} error={fieldError("name")}>
          <Input
            id={`${id}-name`}
            value={values.name}
            maxLength={TOOL_LIMITS.name}
            onChange={(event) => set("name", event.target.value)}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={describe("name")}
            required
          />
        </Field>
        <Field
          id={`${id}-slug`}
          label={tForm("slug")}
          hint={tForm("slugHint")}
          error={fieldError("slug")}
        >
          <Input
            id={`${id}-slug`}
            value={values.slug}
            maxLength={TOOL_LIMITS.slug}
            onChange={(event) => {
              setSlugTouched(true);
              set("slug", event.target.value);
            }}
            aria-invalid={!!fieldErrors.slug}
            aria-describedby={describe("slug") ?? `${id}-slug-hint`}
            className="text-sm"
            required
          />
        </Field>
      </div>

      <Field id={`${id}-kind`} label={tForm("kind")}>
        <Select
          id={`${id}-kind`}
          value={values.kind}
          onChange={(event) => set("kind", event.target.value as ToolKind)}
        >
          {TOOL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {tKinds(kind)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-url`} label={tForm("url")} error={fieldError("url")}>
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            value={values.url}
            onChange={(event) => set("url", event.target.value)}
            placeholder="https://"
            aria-invalid={!!fieldErrors.url}
            aria-describedby={describe("url")}
          />
        </Field>
        <Field id={`${id}-logoUrl`} label={tForm("logoUrl")} error={fieldError("logoUrl")}>
          <Input
            id={`${id}-logoUrl`}
            type="url"
            inputMode="url"
            value={values.logoUrl}
            onChange={(event) => set("logoUrl", event.target.value)}
            placeholder="https://"
            aria-invalid={!!fieldErrors.logoUrl}
            aria-describedby={describe("logoUrl")}
          />
        </Field>
      </div>

      {(["descriptionId", "descriptionEn"] as const).map((field) => (
        <Field
          key={field}
          id={`${id}-${field}`}
          label={tForm(field)}
          counter={`${values[field].length}/${TOOL_LIMITS.description}`}
          error={fieldError(field)}
        >
          <Textarea
            id={`${id}-${field}`}
            value={values[field]}
            maxLength={TOOL_LIMITS.description}
            onChange={(event) => set(field, event.target.value)}
            aria-invalid={!!fieldErrors[field]}
            aria-describedby={describe(field)}
            className="min-h-20 text-sm"
          />
        </Field>
      ))}

      {editing.mode === "edit" ? (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-base">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => set("isActive", event.target.checked)}
            className="mt-1 size-4 shrink-0 accent-[var(--accent-text)]"
          />
          <span>
            {tForm("isActive")}
            <span className="block text-[13px] text-muted">{tForm("isActiveHint")}</span>
          </span>
        </label>
      ) : null}

      <p role="alert" className="text-sm text-danger empty:hidden">
        {error && error !== "invalid" ? t(`errors.${error}`) : ""}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={buttonStyles({ variant: "outline" })}>
          {tForm("cancel")}
        </button>
        <button type="submit" disabled={pending} className={buttonStyles({ variant: "primary" })}>
          {pending ? tForm("saving") : tForm("save")}
        </button>
      </div>
    </form>
  );
}
