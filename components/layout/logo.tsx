import { cn } from "@/lib/cn";

/** Wordmark: "Jadi" upright, "nya." in italic accent. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[22px] leading-none text-ink", className)}>
      Jadi<span className="text-accent-text italic">nya.</span>
    </span>
  );
}
