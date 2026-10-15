import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "accent" | "outline" | "lang" | "live" | "offline" | "archived";

const variants: Record<Variant, string> = {
  accent: "h-6 rounded-full bg-accent-soft px-2.5 font-sans text-xs font-medium text-accent-text",
  outline: "h-7 rounded-full border border-border-strong px-3 font-sans text-xs text-ink",
  lang: "rounded border border-border-strong px-[5px] py-px font-mono text-[10px] text-muted",
  live: "h-7 gap-1.5 rounded-full border border-accent-text px-3 font-sans text-xs font-medium text-accent-text",
  offline: "h-7 gap-1.5 rounded-full border border-ink px-3 font-sans text-xs font-medium text-ink",
  archived:
    "h-7 rounded-full border border-dashed border-muted px-3 font-sans text-xs font-medium text-ink-2",
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

/** Small uppercase mono label used for section eyebrows and meta (e.g. "PROMPT KUNCI"). */
export function MonoLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("font-mono text-[11px] tracking-[0.4px] text-muted uppercase", className)}>
      {children}
    </span>
  );
}
