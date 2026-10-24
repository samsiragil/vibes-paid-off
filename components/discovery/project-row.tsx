import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { mediaUrl } from "@/lib/media/url";
import type { ProjectCardData } from "@/lib/projects/cards";
import { toolsSummary } from "@/lib/projects/types";

/**
 * One "Baru masuk" line on the home page: maker and date, the key prompt, a thumbnail with the
 * title, and Worth it. Four columns on desktop, stacked on phones.
 */
export async function ProjectRow({ project }: { project: ProjectCardData }) {
  const t = await getTranslations("home");
  const tCard = await getTranslations("projectCard");
  const format = await getFormatter();
  const summary = toolsSummary(project.tools, 1);
  const tools =
    summary.rest > 0
      ? `${summary.names} ${tCard("moreTools", { count: summary.rest })}`
      : summary.names;
  const effort = tCard("effort", { effort: project.buildEffort });

  return (
    <Link
      href={`/p/${project.slug}`}
      className="group grid gap-3 border-t border-border py-[18px] text-ink lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,0.9fr)_140px] lg:items-center lg:gap-6"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={project.maker.displayName} src={project.maker.avatarUrl} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{project.maker.displayName}</div>
          {project.publishedAt ? (
            <time dateTime={project.publishedAt} className="block font-mono text-[11px] text-muted">
              {format.dateTime(new Date(project.publishedAt), { day: "numeric", month: "short" })}
            </time>
          ) : null}
        </div>
      </div>
      <p className="justify-self-start rounded-2xl rounded-br-sm bg-bubble px-4 py-3 text-[15px] leading-[1.45] break-words max-lg:ml-auto max-lg:max-w-[92%]">
        {project.keyPrompt}
      </p>
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-[52px] w-[72px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-placeholder">
          {project.coverKey ? (
            <Image
              src={mediaUrl(project.coverKey)}
              alt=""
              fill
              unoptimized
              sizes="72px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold group-hover:underline">{project.title}</h3>
          <p className="truncate text-xs text-muted">
            {tools ? t("latestMeta", { tools, time: effort }) : effort}
          </p>
        </div>
      </div>
      <span className="inline-flex h-8 items-center justify-self-start rounded-full border border-border-strong px-3 text-[13px] lg:justify-self-end">
        {tCard("worthIt", { count: project.upvoteCount })}
      </span>
    </Link>
  );
}
