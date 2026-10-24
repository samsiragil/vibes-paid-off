import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { PromptBubble, ResultBubble, TimeGap } from "@/components/ui/bubble";
import { mediaUrl } from "@/lib/media/url";
import type { HomeHero } from "@/lib/projects/discovery";

/** The AI's side of the conversation: an outlined circle with a spark. */
function AiAvatar() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-accent-text"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
      </svg>
    </span>
  );
}

/**
 * The home hero conversation: this week's pick (or the newest project) as one big chat.
 * Prompt → "X jam kemudian" → screenshot + title, then Worth it and replies.
 */
export async function HomeHeroCard({ hero }: { hero: HomeHero }) {
  const t = await getTranslations("home");
  const tCard = await getTranslations("projectCard");
  const format = await getFormatter();
  const { project } = hero;

  const toolNames = project.tools.slice(0, 2).map((tool) => tool.name);
  const subtitle =
    toolNames.length > 0
      ? t("builtWith", { tools: format.list(toolNames, { type: "conjunction" }) })
      : project.tagline;

  return (
    <Link
      href={`/p/${project.slug}`}
      aria-label={t("heroLink", { title: project.title })}
      className="group flex min-w-0 flex-col gap-3.5 rounded-[22px] text-ink"
    >
      <div className="flex items-end justify-end gap-2.5">
        <PromptBubble tone="ink" size="lg" className="max-w-[82%] break-words">
          {project.keyPrompt}
        </PromptBubble>
        <Avatar
          name={project.maker.displayName}
          src={project.maker.avatarUrl}
          className="size-9 text-xs"
        />
      </div>
      <TimeGap>{tCard("effortAfter", { effort: project.buildEffort })}</TimeGap>
      <div className="flex items-end gap-2.5">
        <AiAvatar />
        <ResultBubble
          size="lg"
          className="max-w-[88%] grow gap-3 transition-colors group-hover:border-border-strong"
        >
          <div className="relative h-[200px] overflow-hidden rounded-[14px] bg-placeholder sm:h-[230px]">
            {project.coverKey ? (
              <Image
                src={mediaUrl(project.coverKey)}
                alt=""
                fill
                unoptimized
                priority
                sizes="(min-width: 1024px) 520px, 90vw"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1.5 pb-1">
            <div className="min-w-0">
              <h2 className="text-base font-semibold break-words">{project.title}</h2>
              <p className="text-[13px] break-words text-muted">{subtitle}</p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-accent-soft px-2.5 py-[5px] font-mono text-[11px] text-accent-text uppercase">
              {hero.kind === "weekly_pick" ? t("pickBadge") : t("latestBadge")}
            </span>
          </div>
        </ResultBubble>
      </div>
      <div className="flex flex-wrap gap-2 pl-[46px]">
        <span className="inline-flex h-9 items-center rounded-full border border-border-strong bg-surface px-3.5 text-[13px] font-medium">
          {tCard("worthIt", { count: project.upvoteCount })}
        </span>
        <span className="inline-flex h-9 items-center rounded-full border border-border-strong bg-surface px-3.5 text-[13px]">
          {t("replies", { count: project.commentCount })}
        </span>
      </div>
    </Link>
  );
}
