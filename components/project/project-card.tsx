import Image from "next/image";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PromptBubble, ResultBubble, TimeGap } from "@/components/ui/bubble";
import { cn } from "@/lib/cn";

/**
 * The "obrolan" card used in grids (home, explore, profile) and as the live preview on the
 * submit form: maker, key prompt, "satu weekend kemudian", screenshot + title, tools and Worth it.
 * Purely presentational; callers pass translated labels.
 */
export function ProjectCardView({
  makerName,
  makerAvatarUrl,
  category,
  prompt,
  timeLabel,
  story,
  imageUrl,
  title,
  tools,
  worthIt,
  muted = false,
  showMaker = true,
  status,
  lang,
  eager = false,
  className,
}: {
  makerName: string;
  makerAvatarUrl?: string | null;
  category?: string;
  prompt: string;
  timeLabel: string;
  /** "ada cerita build", shown after the time label when the project has a build story. */
  story?: string;
  imageUrl?: string | null;
  title: string;
  tools: string;
  worthIt: string;
  /** Placeholder text (empty preview fields) in a softer color. */
  muted?: boolean;
  /** False on a maker's own profile, where every card is theirs: the category moves left. */
  showMaker?: boolean;
  /** Top-right label, e.g. the link status on profile cards. */
  status?: ReactNode;
  /** Content language badge ("ID" / "EN") next to the category. */
  lang?: string;
  /** Load the screenshot right away: the first card of a grid is often the page's LCP image. */
  eager?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn("flex flex-col gap-3 rounded border border-border bg-surface p-4", className)}
    >
      {showMaker ? (
        <div className="flex min-h-6 items-center gap-2 text-sm text-ink-2">
          <Avatar name={makerName} src={makerAvatarUrl} size="xs" />
          <span className="min-w-0 truncate">{makerName}</span>
          {category ? <span className="ml-auto shrink-0 text-muted">{category}</span> : null}
          {lang ? (
            <Badge variant="lang" className={category ? undefined : "ml-auto"}>
              {lang}
            </Badge>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-6 items-center justify-between gap-3 text-sm text-muted">
          <span className="min-w-0 truncate">{category}</span>
          {status}
        </div>
      )}
      <PromptBubble className={cn("line-clamp-3 break-words", muted && "text-muted")}>
        {prompt}
      </PromptBubble>
      <TimeGap note={story}>{timeLabel}</TimeGap>
      <ResultBubble>
        <div className="relative h-[150px] overflow-hidden rounded-sm bg-placeholder">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              unoptimized
              sizes="320px"
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : undefined}
              className="object-cover"
            />
          ) : null}
        </div>
        <h3
          className={cn(
            "px-1 pb-1 text-lg leading-6 font-semibold break-words group-hover:underline",
            muted && "text-muted",
          )}
        >
          {title}
        </h3>
      </ResultBubble>
      <div className="mt-auto flex items-center justify-between gap-3 text-sm text-muted">
        <span className="min-w-0 truncate">{tools}</span>
        <span className="shrink-0 font-semibold text-ink-2 tabular-nums">{worthIt}</span>
      </div>
    </article>
  );
}
