import { cn } from "@/lib/cn";

/**
 * The Worth it control on the project page: a secondary button, highlighted (stabilo) once given.
 * Never larger than "Coba live".
 */
export function worthItStyles(voted: boolean, className?: string) {
  return cn(
    "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border-[1.5px] px-4 text-base font-semibold whitespace-nowrap transition-colors duration-150",
    voted
      ? "border-highlight bg-highlight text-highlight-ink"
      : "border-border-strong bg-surface text-ink",
    className,
  );
}
