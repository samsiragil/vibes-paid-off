import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/media/url";
import type { ProjectCardData } from "@/lib/projects/cards";
import { toolsSummary } from "@/lib/projects/types";

/**
 * One "Baru masuk" entry on the home page, written like a notebook entry: the date handwritten in
 * the margin, the title, one line of the key prompt, then maker, tools and Worth it. On phones the
 * margin narrows to its line and the date moves above the title.
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
      className="group relative grid grid-cols-[minmax(0,1fr)_72px] items-start gap-x-4 border-b border-rule py-4 pl-6 text-ink sm:grid-cols-[88px_minmax(0,1fr)_96px] sm:gap-x-6 sm:pl-0"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-[100px]"
      />
      {project.publishedAt ? (
        <time
          dateTime={project.publishedAt}
          className="col-span-2 font-hand text-xl leading-8 whitespace-nowrap text-ink-2 sm:col-span-1 sm:text-right"
        >
          {format.dateTime(new Date(project.publishedAt), { day: "numeric", month: "short" })}
        </time>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-lg leading-8 font-semibold break-words group-hover:underline">
          {project.title}
        </h3>
        <p className="truncate text-base leading-6 text-ink-2">{project.keyPrompt}</p>
        {/* A no-break space before each dot keeps it at the end of a line when the meta wraps. */}
        <p className="text-sm leading-5 break-words text-muted">
          {project.maker.displayName}
          {" · "}
          {tools ? t("latestMeta", { tools, time: effort }) : effort}
          {" · "}
          <span className="font-semibold whitespace-nowrap text-ink-2 tabular-nums">
            {tCard("worthIt", { count: project.upvoteCount })}
          </span>
        </p>
      </div>
      <div className="relative mt-1 aspect-[4/3] overflow-hidden rounded-sm border border-border bg-placeholder">
        {project.coverKey ? (
          <Image
            src={mediaUrl(project.coverKey)}
            alt=""
            fill
            unoptimized
            sizes="96px"
            className="object-cover"
          />
        ) : null}
      </div>
    </Link>
  );
}
