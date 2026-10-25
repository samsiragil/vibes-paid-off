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
      className={cn(
        "flex flex-col gap-2.5 rounded-[22px] border border-border bg-surface p-[18px]",
        className,
      )}
    >
      {showMaker ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Avatar name={makerName} src={makerAvatarUrl} size="xs" />
          <span className="min-w-0 truncate">{makerName}</span>
          {category ? (
            <span className="ml-auto shrink-0 font-mono text-[11px]">{category}</span>
          ) : null}
          {lang ? (
            <Badge variant="lang" className={category ? undefined : "ml-auto"}>
              {lang}
            </Badge>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-[26px] items-center justify-between gap-3 font-mono text-[11px] text-muted uppercase">
          <span className="min-w-0 truncate">{category}</span>
          {status}
        </div>
      )}
      <PromptBubble className={cn("break-words", muted && "text-muted")}>{prompt}</PromptBubble>
      <TimeGap note={story}>{timeLabel}</TimeGap>
      <ResultBubble>
        <div className="relative h-[130px] overflow-hidden rounded-[10px] bg-placeholder">
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
        <h3 className={cn("px-1 text-sm font-semibold break-words", muted && "text-muted")}>
          {title}
        </h3>
      </ResultBubble>
      <div className="flex items-center justify-between gap-3 pt-0.5 text-xs text-muted">
        <span className="min-w-0 truncate">{tools}</span>
        <span className="inline-flex h-[30px] shrink-0 items-center rounded-full border border-border-strong px-3 font-medium text-ink">
          {worthIt}
        </span>
      </div>
    </article>
  );
}
