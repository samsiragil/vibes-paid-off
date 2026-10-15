"use client";

import { cn } from "@/lib/cn";

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange?: (value: T) => void;
  className?: string;
};

/** Pill-shaped segmented control, e.g. the "Paling worth it / Terbaru" sort switch. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex gap-[3px] rounded-full border border-border-strong bg-surface p-[3px]",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange?.(option.value)}
          className={cn(
            "h-9 rounded-full px-3.5 text-[13px] transition-colors",
            option.value === value ? "bg-ink text-bg" : "text-ink hover:bg-bubble",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
