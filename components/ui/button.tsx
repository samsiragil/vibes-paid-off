import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "outline" | "outline-accent" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors ease-out disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

// The design system has one filled button (brick). "primary" and "accent" both render it; pages
// pick one main action per screen and demote the rest to "outline".
const filled = "bg-accent text-on-accent hover:bg-accent/90";

const variants: Record<Variant, string> = {
  primary: filled,
  accent: filled,
  outline: "border-[1.5px] border-border-strong bg-surface text-ink hover:border-ink",
  "outline-accent":
    "border-[1.5px] border-accent-text bg-surface text-accent-text hover:bg-accent-soft",
  ghost: "text-ink hover:bg-placeholder",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-5 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
