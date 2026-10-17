import { cn } from "@/lib/cn";

/** The Worth it pill on the project page (VPO-Proyek): outline, or accent-soft once voted. */
export function worthItStyles(voted: boolean, className?: string) {
  return cn(
    "inline-flex h-[50px] shrink-0 items-center gap-2 rounded-full border px-[22px] text-[15px] font-medium whitespace-nowrap transition-colors",
    voted
      ? "border-accent-text bg-accent-soft text-accent-text"
      : "border-border-strong bg-surface text-ink",
    className,
  );
}
