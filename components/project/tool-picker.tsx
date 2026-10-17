"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Pill, pillStyles } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { newKey, type SuggestionValues } from "@/lib/projects/form-values";
import { TOOL_KINDS, type CatalogTool } from "@/lib/projects/types";
import { PROJECT_LIMITS, toolSuggestionSchema } from "@/lib/validation/project";

type Option = { type: "tool"; tool: CatalogTool } | { type: "suggest"; name: string };

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Tools for a project (§2.8): quick chips for the most used tools, a searchable list grouped by
 * kind, and "not listed?" suggestions that an admin later merges into the catalog.
 */
export function ToolPicker({
  id,
  tools,
  quickPickIds,
  selectedIds,
  suggestions,
  error,
  onSelectedChange,
  onSuggestionsChange,
}: {
  /** Id of the search box; errors focus it. */
  id: string;
  tools: CatalogTool[];
  quickPickIds: number[];
  selectedIds: number[];
  suggestions: SuggestionValues[];
  error?: string;
  /** Updates take the latest list, so quick successive clicks never work on a stale copy. */
  onSelectedChange: (update: (ids: number[]) => number[]) => void;
  onSuggestionsChange: (update: (suggestions: SuggestionValues[]) => SuggestionValues[]) => void;
}) {
  const t = useTranslations("projectForm.tools");
  const tKinds = useTranslations("toolKinds");
  const tForm = useTranslations("projectForm");
  const tErrors = useTranslations("projectForm.errors");
  const listId = useId();
  const hintId = `${id}-hint`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<{ name: string; url: string; error?: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const draftNameRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);
  const selected = new Set(selectedIds);
  const quickPicks = quickPickIds.flatMap((toolId) => byId.get(toolId) ?? []);
  const quickPickSet = new Set(quickPickIds);

  const q = normalize(query);
  const groups = useMemo(() => {
    const matches = tools.filter(
      (tool) =>
        !q || normalize(tool.name).includes(q) || tool.slug.includes(q.replace(/\s+/g, "-")),
    );
    return TOOL_KINDS.map((kind) => ({
      kind,
      tools: matches
        .filter((tool) => tool.kind === kind)
        .sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name)),
    })).filter((group) => group.tools.length > 0);
  }, [tools, q]);

  const exactMatch = q !== "" && tools.some((tool) => normalize(tool.name) === q);
  const options: Option[] = [
    ...groups.flatMap((group) => group.tools.map((tool) => ({ type: "tool" as const, tool }))),
    ...(q && !exactMatch ? [{ type: "suggest" as const, name: query.trim() }] : []),
  ];
  const activeIndex = Math.min(active, options.length - 1);
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function toggle(toolId: number) {
    onSelectedChange((ids) =>
      ids.includes(toolId) ? ids.filter((existing) => existing !== toolId) : [...ids, toolId],
    );
  }

  function choose(option: Option) {
    if (option.type === "tool") {
      toggle(option.tool.id);
      return;
    }
    setOpen(false);
    setDraft({ name: option.name.slice(0, PROJECT_LIMITS.suggestionName), url: "" });
    requestAnimationFrame(() => draftNameRef.current?.focus());
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((Math.max(activeIndex, 0) + step + options.length) % Math.max(options.length, 1));
    } else if (event.key === "Enter") {
      // Never submit the whole form from the search box.
      event.preventDefault();
      if (open && options[activeIndex]) choose(options[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  function addSuggestion() {
    if (!draft) return;
    const name = draft.name.trim();
    // Already in the catalog under that name: select it instead.
    const known = tools.find((tool) => normalize(tool.name) === normalize(name));
    if (known) {
      onSelectedChange((ids) => (ids.includes(known.id) ? ids : [...ids, known.id]));
      setDraft(null);
      setQuery("");
      return;
    }
    const parsed = toolSuggestionSchema.safeParse({ name, url: draft.url });
    if (!parsed.success) {
      setDraft({ ...draft, error: tErrors(parsed.error.issues[0]?.message ?? "invalid") });
      return;
    }
    if (suggestions.length >= PROJECT_LIMITS.maxSuggestions) {
      setDraft({ ...draft, error: tErrors("too_many") });
      return;
    }
    onSuggestionsChange((current) =>
      current.some((suggestion) => normalize(suggestion.name) === normalize(name))
        ? current
        : [...current, { key: newKey(), ...parsed.data }],
    );
    setDraft(null);
    setQuery("");
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addSuggestion();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
    }
  }

  const extraSelected = selectedIds.flatMap((toolId) =>
    quickPickSet.has(toolId) ? [] : (byId.get(toolId) ?? []),
  );
  const toolIndex = new Map(
    options.flatMap((option, index) =>
      option.type === "tool" ? [[option.tool.id, index] as const] : [],
    ),
  );

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("quickPicks")} className="flex flex-wrap gap-2">
        {quickPicks.map((tool) => (
          <Pill key={tool.id} selected={selected.has(tool.id)} onClick={() => toggle(tool.id)}>
            {tool.name}
          </Pill>
        ))}
      </div>

      <div className="relative">
        <label htmlFor={id} className="sr-only">
          {t("search")}
        </label>
        <Input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && options.length > 0 ? optionId(activeIndex) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onSearchKeyDown}
          className="h-11 rounded-xl bg-bg"
        />
        {open ? (
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={t("results")}
            aria-multiselectable="true"
            className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-border-strong bg-surface p-1.5 shadow-lg"
          >
            {groups.map((group) => (
              <div
                key={group.kind}
                role="group"
                aria-labelledby={`${listId}-${group.kind}`}
                className="pb-1"
              >
                <div
                  id={`${listId}-${group.kind}`}
                  className="px-2.5 pt-2 pb-1 font-mono text-[11px] tracking-[0.4px] text-muted uppercase"
                >
                  {tKinds(group.kind)}
                </div>
                {group.tools.map((tool) => {
                  const index = toolIndex.get(tool.id) ?? -1;
                  const isSelected = selected.has(tool.id);
                  return (
                    <div
                      key={tool.id}
                      id={optionId(index)}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose({ type: "tool", tool })}
                      onMouseMove={() => setActive(index)}
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 text-sm",
                        index === activeIndex && "bg-bubble",
                        isSelected && "font-medium text-accent-text",
                      )}
                    >
                      {tool.name}
                      {isSelected ? <CheckIcon /> : null}
                    </div>
                  );
                })}
              </div>
            ))}
            {q && groups.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-muted">
                {t("noResults", { query: query.trim() })}
              </p>
            ) : null}
            {options.at(-1)?.type === "suggest" ? (
              <div
                id={optionId(options.length - 1)}
                data-index={options.length - 1}
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(options[options.length - 1])}
                onMouseMove={() => setActive(options.length - 1)}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border-t border-border px-2.5 text-sm font-medium text-accent-text",
                  activeIndex === options.length - 1 && "bg-accent-soft",
                )}
              >
                <PlusIcon />
                {t("suggest", { query: query.trim() })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {draft ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-(--dashed) p-3.5">
          <p className="text-sm font-medium">{t("suggestTitle")}</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-suggest-name`} className="text-[13px] font-medium">
                {t("suggestName")}
              </label>
              <Input
                ref={draftNameRef}
                id={`${id}-suggest-name`}
                value={draft.name}
                maxLength={PROJECT_LIMITS.suggestionName}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value, error: undefined })
                }
                onKeyDown={onDraftKeyDown}
                className="h-11 rounded-xl bg-bg"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-suggest-url`} className="text-[13px] font-medium">
                {t("suggestUrl")}{" "}
                <span className="font-normal text-muted">{tForm("optional")}</span>
              </label>
              <Input
                id={`${id}-suggest-url`}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={draft.url}
                onChange={(event) =>
                  setDraft({ ...draft, url: event.target.value, error: undefined })
                }
                onKeyDown={onDraftKeyDown}
                className="h-11 rounded-xl bg-bg"
              />
            </div>
          </div>
          {draft.error ? (
            <p role="alert" className="text-[13px] text-red-700 dark:text-red-400">
              {draft.error}
            </p>
          ) : (
            <p className="text-[13px] text-muted">{t("suggestNote")}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={addSuggestion}>
              {t("suggestAdd")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t("suggestCancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {extraSelected.length > 0 || suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-muted">{t("selected")}</span>
          <ul className="flex flex-wrap gap-2">
            {extraSelected.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  aria-label={t("remove", { name: tool.name })}
                  onClick={() => toggle(tool.id)}
                  className={pillStyles({ selected: true })}
                >
                  {tool.name}
                  <CrossIcon />
                </button>
              </li>
            ))}
            {suggestions.map((suggestion) => (
              <li key={suggestion.key}>
                <button
                  type="button"
                  aria-label={t("remove", { name: suggestion.name })}
                  onClick={() =>
                    onSuggestionsChange((current) =>
                      current.filter((item) => item.key !== suggestion.key),
                    )
                  }
                  className={pillStyles({ className: "border-dashed" })}
                >
                  {suggestion.name}
                  <span className="font-mono text-[10px] text-muted uppercase">
                    {t("suggested")}
                  </span>
                  <CrossIcon />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p id={hintId} className="text-[13px] text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : (
        <p id={hintId} className="text-[13px] text-muted">
          {t("hint")}
        </p>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
