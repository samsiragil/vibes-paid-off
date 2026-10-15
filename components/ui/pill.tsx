import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors";

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
    selected
      ? "border-accent-text bg-accent-soft font-medium text-accent-text"
      : tone === "accent"
        ? "border-accent-text bg-surface text-accent-text hover:bg-accent-soft"
        : "border-border-strong bg-surface text-ink hover:border-ink",
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
