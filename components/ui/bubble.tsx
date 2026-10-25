import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SystemAvatar } from "./avatar";

/*
 * The obrolan, drawn as a page in a notebook (docs/design-system/README.md §6–7): the key prompt is
 * a note, the time it took is handwritten under it, and the result is pasted in. The export names
 * still say "bubble" so pages keep working while they move to the notebook layout.
 */

/**
 * The maker's key prompt as a note. `lg` (hero, detail) is a ruled block with the margin line;
 * `md` (cards) only keeps the margin line on the left, never the ruled lines.
 * `tone` is kept for older call sites and no longer changes the look.
 */
export function PromptBubble({
  size = "md",
  label,
  className,
  children,
}: {
  /** @deprecated The notebook has no dark prompt; ignored. */
  tone?: "ink" | "soft";
  size?: "md" | "lg";
  /** Optional "Prompt kunci" label, sitting on the first ruled line. */
  label?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  if (size === "lg") {
    return (
      <div
        className={cn(
          "relative ruled pr-4 pl-6 text-[17px]/8 text-ink sm:pl-[72px] sm:text-lg/8",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-14"
        />
        {label ? (
          <span className="block text-[13px]/8 font-semibold text-muted">{label}</span>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn("border-l-[1.5px] border-margin pl-3 text-base leading-6 text-ink", className)}
    >
      {label ? (
        <span className="mb-1 block text-[13px] leading-4 font-semibold text-muted">{label}</span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * What the AI built, pasted into the notebook: screenshot on white, then the title.
 * `taped` (main screenshot of a detail or the hero only) tilts it slightly and adds tape.
 */
export function ResultBubble({
  size = "md",
  taped = false,
  className,
  children,
}: {
  size?: "md" | "lg";
  taped?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded border border-border bg-surface shadow-[0_1px_0_var(--border)]",
        size === "lg" ? "gap-3 p-3" : "gap-2 p-2",
        taped && "-rotate-[0.6deg]",
        className,
      )}
    >
      {taped ? (
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-2 bg-highlight/45"
        />
      ) : null}
      {children}
    </div>
  );
}

/** The hook-shaped arrow of the time gap, from the logo's bar and stem. Draws itself once. */
function HookArrow() {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="miter"
      aria-hidden="true"
      className="shrink-0 text-muted"
    >
      <path className="draw-once" pathLength={1} d="M2 4H13V21M8.5 16.5L13 21L17.5 16.5" />
    </svg>
  );
}

/**
 * The "6 jam kemudian" note between a prompt and its result, handwritten next to a hook arrow.
 * `note` (e.g. "ada cerita build") stays in the UI face, in brick.
 */
export function TimeGap({
  note,
  className,
  children,
}: {
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      {/* The arrow hangs in the padding, so a wrapped note lines up under the handwriting. */}
      <div className="flex flex-wrap items-center gap-x-2 pl-7">
        <span className="-ml-7 flex">
          <HookArrow />
        </span>
        <span className="font-hand text-xl leading-8 whitespace-nowrap text-ink-2 sm:text-[22px]">
          {children}
        </span>
        {note ? (
          <span className="text-sm leading-5 whitespace-nowrap text-accent-text">
            <span aria-hidden="true">· </span>
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** A note from the site itself (empty states, confirmations, notices): system avatar + short ruled note. */
export function SystemMessage({
  tone = "surface",
  className,
  children,
}: {
  tone?: "surface" | "soft";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <SystemAvatar />
      <div
        className={cn(
          "min-w-0 grow border-l-[1.5px] border-margin ruled px-4 text-base/8",
          tone === "surface" &&
            "rounded-r border-y border-r border-y-border border-r-border bg-surface",
        )}
      >
        {children}
      </div>
    </div>
  );
}
