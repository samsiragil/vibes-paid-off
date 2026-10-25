import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Chip: 44 px tap target on phones, 36 px from sm up.
const base =
  "inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ease-out motion-reduce:transition-none sm:h-9";

export function pillStyles({
  selected = false,
  tone = "neutral",
  className,
}: {
  selected?: boolean;
  tone?: "neutral" | "accent";
  className?: string;
} = {}) {
  return cn(
    base,
    // Selected = highlighter fill, not brick (README §6).
    selected
      ? "border-highlight bg-highlight text-highlight-ink"
      : tone === "accent"
        ? "border-border bg-surface text-accent-text hover:border-accent-text"
        : "border-border bg-surface text-ink hover:border-ink",
    className,
  );
}

type PillProps = ComponentProps<"button"> & {
  selected?: boolean;
  tone?: "neutral" | "accent";
};

/** Toggleable chip (tools picker, filters). Exposes its state via aria-pressed. */
export function Pill({ selected = false, tone, className, type = "button", ...props }: PillProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={pillStyles({ selected, tone, className })}
      {...props}
    />
  );
}
