"use client";

import { useLocale, useTranslations } from "next-intl";
import { createContext, use, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { buttonStyles } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import type { ProjectCardData } from "@/lib/projects/cards";
import {
  activeFilterCount,
  exploreHref,
  MAX_QUERY_LENGTH,
  toggle,
  type ExploreCursor,
  type ExploreFilters,
  type ExploreSort,
} from "@/lib/projects/explore-params";
import { loadMoreProjects } from "@/lib/projects/load-more";

// Interactive parts of /explore. Every filter change is a navigation to the matching URL, so a
// filtered view can be shared and the server renders the results; while it loads, the current
// results fade (ExploreProvider shares the transition).

type ExploreContextValue = {
  filters: ExploreFilters;
  pending: boolean;
  navigate: (next: ExploreFilters) => void;
};

const ExploreContext = createContext<ExploreContextValue | null>(null);

function useExplore() {
  const value = use(ExploreContext);
  if (!value) throw new Error("Explore controls must be inside <ExploreProvider>.");
  return value;
}

export function ExploreProvider({
  filters,
  children,
}: {
  filters: ExploreFilters;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(next: ExploreFilters) {
    startTransition(() => router.push(exploreHref(next), { scroll: false }));
  }

  return <ExploreContext value={{ filters, pending, navigate }}>{children}</ExploreContext>;
}

/** The search pill. A plain GET form underneath, so it also works before hydration. */
export function SearchForm() {
  const t = useTranslations("explore");
  const locale = useLocale();
  const { filters, navigate } = useExplore();
  const inputId = useId();

  return (
    <form
      role="search"
      action={`/${locale}/explore`}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get("q");
        navigate({
          ...filters,
          q: typeof q === "string" ? q.trim().slice(0, MAX_QUERY_LENGTH) : "",
        });
      }}
      className="flex h-14 max-w-[760px] items-center gap-3 rounded-md border-[1.5px] border-border-strong bg-surface py-1.5 pr-1.5 pl-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:border-ink"
    >
      <label htmlFor={inputId} className="sr-only">
        {t("searchLabel")}
      </label>
      <input
        id={inputId}
        // Remount when the URL query changes (back button, "clear filters").
        key={filters.q}
        type="search"
        name="q"
        defaultValue={filters.q}
        maxLength={MAX_QUERY_LENGTH}
        placeholder={t("searchPlaceholder")}
        className="h-11 min-w-0 grow bg-transparent text-base text-ink outline-none placeholder:text-muted"
      />
      {filters.tools.length > 0 ? (
        <input type="hidden" name="tools" value={filters.tools.join(",")} />
      ) : null}
      {filters.categories.length > 0 ? (
        <input type="hidden" name="category" value={filters.categories.join(",")} />
      ) : null}
      {filters.lang ? <input type="hidden" name="lang" value={filters.lang} /> : null}
      {filters.sort !== "worth_it" ? (
        <input type="hidden" name="sort" value={filters.sort} />
      ) : null}
      <button type="submit" className={buttonStyles({ variant: "primary" })}>
        {t("searchButton")}
      </button>
    </form>
  );
}

export function SortSwitch({ className }: { className?: string }) {
  const t = useTranslations("explore");
  const { filters, navigate } = useExplore();
  return (
    <Segmented<ExploreSort>
      label={t("sortLabel")}
      value={filters.sort}
      options={[
        { value: "worth_it", label: t("sortWorthIt") },
        { value: "new", label: t("sortNew") },
      ]}
      onChange={(sort) => navigate({ ...filters, sort })}
      className={className}
    />
  );
}

export type FilterTool = { slug: string; name: string; count: number };
export type FilterToolGroup = { kind: string; label: string; tools: FilterTool[] };
export type FilterCategory = { slug: string; label: string };

const GROUP_PREVIEW = 6;

/** Tools (grouped by kind, §2.8), categories and content language. */
export function FilterPanel({
  toolGroups,
  categories,
  className,
}: {
  toolGroups: FilterToolGroup[];
  categories: FilterCategory[];
  className?: string;
}) {
  const t = useTranslations("explore");
  const { filters, navigate, pending } = useExplore();
  const [toolQuery, setToolQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const searchId = useId();
  const query = toolQuery.trim().toLowerCase();

  const groups = toolGroups
    .map((group) => {
      const matching = query
        ? group.tools.filter((tool) => tool.name.toLowerCase().includes(query))
        : group.tools;
      const open = query !== "" || expanded.includes(group.kind);
      // Collapsed groups still show selected tools beyond the first six.
      const shown = open
        ? matching
        : matching.filter(
            (tool, index) => index < GROUP_PREVIEW || filters.tools.includes(tool.slug),
          );
      return { ...group, matching, shown, open };
    })
    .filter((group) => group.matching.length > 0);

  return (
    <div className={cn("flex flex-col gap-7", className)} aria-busy={pending}>
      {toolGroups.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-[13px] leading-4 font-semibold text-muted">
            {t("tools")}
          </legend>
          <label htmlFor={searchId} className="sr-only">
            {t("toolSearch")}
          </label>
          <input
            id={searchId}
            type="search"
            value={toolQuery}
            onChange={(event) => setToolQuery(event.target.value)}
            placeholder={t("toolSearch")}
            className="h-11 rounded-md border-[1.5px] border-border-strong bg-surface px-3 text-base text-ink transition-colors placeholder:text-muted hover:border-ink"
          />
          {groups.length === 0 ? (
            <p className="text-sm text-muted">{t("toolSearchEmpty")}</p>
          ) : null}
          {groups.map((group) => (
            <div key={group.kind} className="flex flex-col gap-0.5">
              <div className="pt-2 pb-1 text-sm leading-5 font-semibold text-ink-2">
                {group.label}
              </div>
              {group.shown.map((tool) => (
                <CheckRow
                  key={tool.slug}
                  label={tool.name}
                  count={tool.count}
                  checked={filters.tools.includes(tool.slug)}
                  onChange={() => navigate({ ...filters, tools: toggle(filters.tools, tool.slug) })}
                />
              ))}
              {query === "" && group.matching.length > GROUP_PREVIEW ? (
                <button
                  type="button"
                  aria-expanded={group.open}
                  onClick={() => setExpanded((current) => toggle(current, group.kind))}
                  className="flex min-h-11 items-center self-start text-sm font-semibold text-accent-text underline underline-offset-3"
                >
                  {group.open ? t("seeLess") : t("seeAll", { count: group.matching.length })}
                </button>
              ) : null}
            </div>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-2 text-[13px] leading-4 font-semibold text-muted">
          {t("categories")}
        </legend>
        {categories.map((category) => (
          <CheckRow
            key={category.slug}
            label={category.label}
            checked={filters.categories.includes(category.slug)}
            onChange={() =>
              navigate({ ...filters, categories: toggle(filters.categories, category.slug) })
            }
          />
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] leading-4 font-semibold text-muted">{t("lang")}</legend>
        <div className="flex gap-1.5">
          {(
            [
              [null, t("langAll")],
              ["id", t("langId")],
              ["en", t("langEn")],
            ] as const
          ).map(([lang, label]) => (
            <Pill
              key={label}
              selected={filters.lang === lang}
              onClick={() => navigate({ ...filters, lang })}
            >
              {label}
            </Pill>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-base lg:min-h-9">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-[18px] shrink-0 accent-accent"
      />
      <span className="min-w-0 grow truncate">{label}</span>
      {count !== undefined ? (
        <span className="text-sm text-muted tabular-nums">{count}</span>
      ) : null}
    </label>
  );
}

/** Below `lg` the filters live in a bottom sheet (native modal dialog: focus trap, Escape). */
export function MobileFilters({ children }: { children: ReactNode }) {
  const t = useTranslations("explore");
  const { filters } = useExplore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = activeFilterCount(filters);
  const titleId = useId();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className={buttonStyles({ variant: "outline" })}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {count > 0 ? t("openFiltersCount", { count }) : t("openFilters")}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          // A click on the backdrop (the dialog box itself, outside the sheet) closes it.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-md border-t border-border bg-bg p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex flex-col">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-4 py-3">
            <h2 id={titleId} className="text-lg leading-6 font-semibold">
              {t("filtersLabel")}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={buttonStyles({ variant: "ghost", size: "sm", className: "h-11" })}
            >
              {t("closeFilters")}
            </button>
          </div>
          <div className="px-4 pt-4 pb-4">{children}</div>
          <div className="sticky bottom-0 border-t border-border bg-bg px-4 py-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              {t("showResults")}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

/** Polite status line while new results load. */
export function PendingStatus() {
  const t = useTranslations("explore");
  const { pending } = useExplore();
  return (
    <span role="status" className="sr-only">
      {pending ? t("updating") : ""}
    </span>
  );
}

/**
 * The results grid: the server-rendered first page (`children`) plus pages loaded with
 * "Muat obrolan lainnya". Give it a `key` per filter state so a new search starts over.
 */
export function ResultsGrid({
  filters,
  nextCursor,
  showLang = false,
  children,
}: {
  filters: ExploreFilters;
  nextCursor: ExploreCursor | null;
  showLang?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("explore");
  const explore = use(ExploreContext);
  const [extra, setExtra] = useState<ProjectCardData[]>([]);
  const [cursor, setCursor] = useState(nextCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function loadMore() {
    if (!cursor) return;
    setStatus("loading");
    const page = await loadMoreProjects({ filters, cursor }).catch(() => null);
    if (!page) {
      setStatus("error");
      return;
    }
    // A project can move between pages while browsing; never show it twice.
    setExtra((current) => {
      const seen = new Set(current.map((project) => project.id));
      return [...current, ...page.items.filter((project) => !seen.has(project.id))];
    });
    setCursor(page.nextCursor);
    setStatus("idle");
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-opacity",
        explore?.pending && "pointer-events-none opacity-50",
      )}
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {children}
        {extra.map((project) => (
          <ProjectGridCard key={project.id} project={project} showLang={showLang} />
        ))}
      </div>
      {cursor ? (
        <div className="flex flex-col items-center gap-2 pt-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={status === "loading"}
            className={buttonStyles({ variant: "outline", size: "lg" })}
          >
            {status === "loading" ? t("loading") : t("loadMore")}
          </button>
          <p role="status" className="text-sm text-danger">
            {status === "error" ? t("loadError") : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
