import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/media/url";
import type { ProjectCardData } from "@/lib/projects/cards";
import { toolsSummary } from "@/lib/projects/types";
import { LinkStatusText } from "./link-status-badge";
import { ProjectCardView } from "./project-card";

/**
 * A linked "obrolan" card for grids. On a maker's profile (`showMaker={false}`) the corner shows
 * the link status instead of the maker, so archived projects are labeled. Not async, so the
 * explore "load more" list can render it on the client too.
 */
export function ProjectGridCard({
  project,
  showMaker = true,
  showLang = false,
}: {
  project: ProjectCardData;
  showMaker?: boolean;
  /** The content language badge (explore, where language is a filter). */
  showLang?: boolean;
}) {
  const t = useTranslations("projectCard");
  const tCategories = useTranslations("categories");
  const summary = toolsSummary(project.tools);

  return (
    <Link
      href={`/p/${project.slug}`}
      className="group block rounded-[22px] transition-transform hover:-translate-y-0.5"
    >
      <ProjectCardView
        makerName={project.maker.displayName}
        makerAvatarUrl={project.maker.avatarUrl}
        // Explore (VPO-Jelajah) shows the language instead of the category in the corner.
        category={showLang ? undefined : tCategories(project.category)}
        prompt={project.keyPrompt}
        timeLabel={t("timeAfter", { hours: project.buildTimeHours })}
        imageUrl={project.coverKey ? mediaUrl(project.coverKey) : null}
        title={project.title}
        tools={
          summary.rest > 0
            ? `${summary.names} ${t("moreTools", { count: summary.rest })}`
            : summary.names
        }
        worthIt={t("worthIt", { count: project.upvoteCount })}
        showMaker={showMaker}
        lang={showLang ? project.contentLang.toUpperCase() : undefined}
        status={<LinkStatusText status={project.linkStatus} />}
        className="h-full transition-colors group-hover:border-border-strong"
      />
    </Link>
  );
}
