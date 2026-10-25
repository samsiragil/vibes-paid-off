import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border-[1.5px] border-border-strong bg-surface px-3 text-base text-ink placeholder:text-muted transition-colors duration-150 ease-out hover:border-ink aria-invalid:border-danger motion-reduce:transition-none";

/**
 * Label + control + hint/error. Pass the same `id` you give the control so the
 * label and description are wired up for assistive tech.
 */
export function Field({
  id,
  label,
  hint,
  error,
  counter,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  counter?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] leading-4 font-semibold text-ink">
          {label}
        </label>
        {counter ? (
          <span className="text-sm leading-5 text-muted tabular-nums">{counter}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm leading-5 text-danger">
          {/* Error is never color alone: icon + text (README §3). */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 15.5v2" />
          </svg>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm leading-5 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-2.5 leading-6", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 pr-10", className)} {...props} />;
}
