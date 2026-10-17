import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/media/url";
import type { ProjectCardData } from "@/lib/projects/cards";
import { toolsSummary } from "@/lib/projects/types";
import { LinkStatusText } from "./link-status-badge";
import { ProjectCardView } from "./project-card";

/**
 * A linked "obrolan" card for grids. On a maker's profile (`showMaker={false}`) the corner shows
 * the link status instead of the maker, so archived projects are labeled.
 */
export async function ProjectGridCard({
  project,
  showMaker = true,
}: {
  project: ProjectCardData;
  showMaker?: boolean;
}) {
  const t = await getTranslations("projectCard");
  const tCategories = await getTranslations("categories");
  const summary = toolsSummary(project.tools);

  return (
    <Link
      href={`/p/${project.slug}`}
      className="group block rounded-[22px] transition-transform hover:-translate-y-0.5"
    >
      <ProjectCardView
        makerName={project.maker.displayName}
        makerAvatarUrl={project.maker.avatarUrl}
        category={tCategories(project.category)}
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
        status={<LinkStatusText status={project.linkStatus} />}
        className="h-full transition-colors group-hover:border-border-strong"
      />
    </Link>
  );
}
