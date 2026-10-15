import { cn } from "@/lib/cn";

/** Wordmark. Always written with spaces ("Vibes Paid Off"), per the brief. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[22px] leading-none text-ink", className)}>
      Vibes Paid <span className="text-accent-text italic">Off.</span>
    </span>
  );
}
