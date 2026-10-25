import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "accent" | "highlight" | "outline" | "lang" | "live" | "offline" | "archived";

const variants: Record<Variant, string> = {
  // Maker terpercaya.
  accent: "h-6 rounded bg-accent-soft px-2 text-[13px] leading-4 font-semibold text-accent-ink",
  // Pilihan minggu ini: highlighter, the marked state (README §6).
  highlight: "h-6 rounded bg-highlight px-2 text-[13px] leading-4 font-semibold text-highlight-ink",
  outline: "h-6 rounded border border-border px-2 text-[13px] leading-4 text-ink-2",
  lang: "text-[13px] leading-4 text-muted",
  // Link status: dot + text, no filled area.
  live: "gap-1.5 text-sm leading-5 font-semibold text-success",
  offline: "gap-1.5 text-sm leading-5 font-semibold text-warning",
  archived: "gap-1.5 text-sm leading-5 font-semibold text-muted",
};

export function Badge({
  variant = "accent",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small sentence-case label for section eyebrows and meta (e.g. "Prompt kunci"). */
export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("text-[13px] leading-4 font-semibold text-muted", className)}>
      {children}
    </span>
  );
}
