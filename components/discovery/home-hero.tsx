import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ResultBubble, TimeGap } from "@/components/ui/bubble";
import { mediaUrl } from "@/lib/media/url";
import type { HomeHero } from "@/lib/projects/discovery";

/**
 * The home hero: this week's pick (or the newest project) as one big notebook page. The label and
 * maker, the key prompt on the ruled lines, "X jam kemudian" in handwriting, the screenshot taped
 * in, then the title, Worth it and replies. Every row is a multiple of 32 px so text stays on the
 * lines below the screenshot too.
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
      className="group relative block min-w-0 rounded border border-border bg-surface ruled py-8 pr-4 pl-6 text-ink transition-colors hover:border-border-strong sm:pr-8 sm:pl-[72px]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-14"
      />
      <div className="flex min-w-0 items-center gap-2 text-sm/8 text-ink-2">
        <span className={hero.kind === "weekly_pick" ? "stabilo font-semibold" : "font-semibold"}>
          {hero.kind === "weekly_pick" ? t("pickBadge") : t("latestBadge")}
        </span>
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
        <Avatar name={project.maker.displayName} src={project.maker.avatarUrl} size="xs" />
        <span className="min-w-0 truncate">{project.maker.displayName}</span>
      </div>
      <p className="text-[17px]/8 break-words sm:text-lg/8">{project.keyPrompt}</p>
      <TimeGap>{tCard("effortAfter", { effort: project.buildEffort })}</TimeGap>
      {/* 18 px of padding and border + the image = 224 / 256 px: seven or eight ruled lines. */}
      <ResultBubble taped className="p-2">
        <div className="relative h-[206px] overflow-hidden rounded-sm bg-placeholder sm:h-[238px]">
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
      </ResultBubble>
      <h2 className="text-lg/8 font-semibold break-words group-hover:underline sm:text-xl/8">
        {project.title}
      </h2>
      <p className="text-base/8 break-words text-ink-2">{subtitle}</p>
      <p className="flex flex-wrap gap-x-3 text-sm/8 text-ink-2">
        <span className="font-semibold tabular-nums">
          {tCard("worthIt", { count: project.upvoteCount })}
        </span>
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
        <span className="tabular-nums">{t("replies", { count: project.commentCount })}</span>
      </p>
    </Link>
  );
}
