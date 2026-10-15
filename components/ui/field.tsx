import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-2xl border border-border-strong bg-surface px-4 text-[15px] text-ink placeholder:text-muted transition-colors hover:border-ink focus:border-accent-text focus:outline-none aria-invalid:border-red-700 dark:aria-invalid:border-red-400";

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
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {counter ? <span className="font-mono text-xs text-muted">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3 leading-normal", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-12 pr-10", className)} {...props} />;
}
