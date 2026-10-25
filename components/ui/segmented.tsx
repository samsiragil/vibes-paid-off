"use client";

import { cn } from "@/lib/cn";

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange?: (value: T) => void;
  className?: string;
};

/** Plain-text switch, e.g. the "Paling worth it / Terbaru" sort; the active option is highlighted. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex gap-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange?.(option.value)}
          className={cn(
            "h-11 rounded-md px-2 text-base transition-colors duration-150 ease-out motion-reduce:transition-none",
            option.value === value ? "text-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          <span className={option.value === value ? "stabilo" : undefined}>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
