import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SystemAvatar } from "./avatar";

/**
 * The maker's prompt, drawn as the outgoing (right-aligned) chat bubble.
 * `ink` is the high-contrast version used for featured prompts; `soft` is used in cards.
 */
export function PromptBubble({
  tone = "soft",
  size = "md",
  className,
  children,
}: {
  tone?: "ink" | "soft";
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "max-w-[92%] self-end leading-[1.45]",
        tone === "ink" ? "bg-ink text-bg" : "bg-bubble text-ink",
        size === "lg"
          ? "rounded-[22px] rounded-br-md px-5 py-4 text-lg"
          : "rounded-2xl rounded-br-sm px-3.5 py-3 text-[15px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** What the AI built: the incoming (left-aligned) bubble that holds screenshots and the title. */
export function ResultBubble({
  size = "md",
  className,
  children,
}: {
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[92%] flex-col gap-2 border border-border bg-surface",
        size === "lg" ? "rounded-[22px] rounded-bl-md p-3.5" : "rounded-2xl rounded-bl-sm p-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The "6 jam kemudian" divider between a prompt and its result. */
export function TimeGap({ children }: { children: ReactNode }) {
  return <div className="text-center font-mono text-[11px] text-muted">{children}</div>;
}

/** A message from the site itself (empty states, confirmations, notices). */
export function SystemMessage({
  tone = "surface",
  className,
  children,
}: {
  tone?: "surface" | "soft";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-end gap-2.5", className)}>
      <SystemAvatar />
      <div
        className={cn(
          "rounded-[18px] rounded-bl-md px-[18px] py-3.5 text-[15px] leading-normal",
          tone === "surface" ? "border border-border bg-surface" : "bg-bubble",
        )}
      >
        {children}
      </div>
    </div>
  );
}
