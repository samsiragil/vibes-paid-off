import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PromptBubble, SystemMessage, TimeGap } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/copy-link";
import { ExternalLink } from "@/components/ui/external-link";
import { WorthItCount } from "@/components/interactions/project-interactions";
import type { ProjectDetail } from "@/lib/projects/detail";
import { shownLinkStatus } from "@/lib/projects/types";
import { BuildStory } from "./build-timeline";
import { LinkStatusBadge } from "./link-status-badge";
import { MediaGallery } from "./media-gallery";

/** "https://github.com/ragil/kasir/" → "github.com/ragil/kasir". */
function shortUrl(url: string) {
  return url.replace(/^https:\/\//, "").replace(/\/+$/, "");
}

/**
 * The project page (VPO-Proyek) as one notebook page: who made it, the title, then the main focus:
 * the key prompt as a ruled note (date handwritten in the margin) → "satu weekend kemudian" → the
 * screenshots taped in → Coba live with Worth it. Below come the description, "Cara membuatnya"
 * and replies; the sidebar holds the maker, the tip link, meta and other projects.
 * `ownerNotice` is shown to the owner while the project is not public; `ownerActions` holds
 * the owner-only buttons (streamed in separately on the cached public page). The public page
 * passes the interactions (Fase 7): the Worth it toggle, replies and the report link; without
 * them (owner previews of non-public projects) the counter is read-only.
 */
export async function ProjectDetailView({
  project,
  ownerNotice,
  ownerActions,
  worthIt,
  replies,
  reportLink,
}: {
  project: ProjectDetail;
  ownerNotice?: ReactNode;
  ownerActions?: ReactNode;
  worthIt?: ReactNode;
  replies?: ReactNode;
  reportLink?: ReactNode;
}) {
  const t = await getTranslations("project");
  const tCard = await getTranslations("projectCard");
  const tCategories = await getTranslations("categories");
  const tLinkStatus = await getTranslations("linkStatus");
  const format = await getFormatter();

  const maker = project.maker;
  const category = tCategories(project.category);
  const timeLabel = tCard("effortAfter", { effort: project.buildEffort });
  const liveUrl = project.liveUrl;
  const linkStatus = shownLinkStatus(project.linkStatus, liveUrl !== null);
  const checkedDate = project.lastCheckedAt
    ? format.dateTime(new Date(project.lastCheckedAt), { dateStyle: "medium" })
    : null;
  const published = project.publishedAt ? (
    <time dateTime={project.publishedAt}>
      {format.dateTime(new Date(project.publishedAt), { day: "numeric", month: "short" })}
    </time>
  ) : null;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pt-6 sm:px-6">
      <nav aria-label={t("breadcrumb")} className="text-sm text-muted">
        <ol className="flex min-w-0 flex-wrap items-center gap-2">
          <li>
            <Link href="/explore" className="underline-offset-3 hover:text-ink hover:underline">
              {t("explore")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={{ pathname: "/explore", query: { category: project.category } }}
              className="underline-offset-3 hover:text-ink hover:underline"
            >
              {category}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="min-w-0 truncate text-ink">
            {project.title}
          </li>
        </ol>
      </nav>

      {ownerNotice ? <div className="mt-6 max-w-[760px]">{ownerNotice}</div> : null}

      <header className="flex flex-col gap-3 pt-8 pb-8">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          <Avatar name={maker.displayName} src={maker.avatarUrl} size="xs" />
          <Link
            href={`/u/${maker.username}`}
            className="font-semibold text-ink underline-offset-3 hover:underline"
          >
            {maker.displayName}
          </Link>
          {/* From sm up the date is handwritten in the prompt's margin instead. */}
          {published ? (
            <span className="sm:hidden">
              <span aria-hidden="true">· </span>
              {published}
            </span>
          ) : null}
        </p>
        <h1 className="max-w-[24ch] text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
          {project.title}
        </h1>
        <p className="max-w-[68ch] text-lg leading-7 text-ink-2">{project.tagline}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {linkStatus ? <LinkStatusBadge status={linkStatus} /> : null}
          <Badge variant="lang">
            <abbr title={t("contentLang", { lang: project.contentLang })} className="no-underline">
              {project.contentLang.toUpperCase()}
            </abbr>
          </Badge>
          <Badge variant="outline">{category}</Badge>
        </div>
      </header>

      {linkStatus && linkStatus !== "live" ? (
        <SystemMessage tone="soft" className="mb-8 max-w-[760px]">
          {linkStatus === "offline" ? t("offlineNotice") : t("archivedNotice")}
        </SystemMessage>
      ) : null}

      <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-14">
        <article className="flex min-w-0 grow flex-col gap-4">
          <PromptBubble
            size="lg"
            label={t("keyPrompt")}
            margin={published}
            className="pb-8 break-words whitespace-pre-line sm:text-[22px]/8"
          >
            {project.keyPrompt}
          </PromptBubble>

          <TimeGap className="pl-6 sm:pl-[72px]">{timeLabel}</TimeGap>

          <div className="pt-2 sm:pl-[72px]">
            <MediaGallery media={project.media} title={project.title} videoUrl={project.videoUrl} />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 sm:pl-[72px]">
            {liveUrl && linkStatus === "live" ? (
              <ExternalLink
                href={liveUrl}
                className={buttonStyles({ variant: "primary", size: "lg" })}
              >
                {t("tryLive")} <span aria-hidden="true">↗</span>
                <span className="sr-only">{t("newTab")}</span>
              </ExternalLink>
            ) : liveUrl && linkStatus === "offline" ? (
              <ExternalLink
                href={liveUrl}
                className={buttonStyles({ variant: "outline", size: "lg" })}
              >
                {t("tryLiveOffline")} <span aria-hidden="true">↗</span>
                <span className="sr-only">{t("newTab")}</span>
              </ExternalLink>
            ) : null}
            {worthIt ?? <WorthItCount count={project.upvoteCount} />}
            <ShareButton title={project.title} />
            {ownerActions}
          </div>

          {project.description ? (
            <section className="flex flex-col gap-2 pt-10">
              <h2 className="text-lg leading-6 font-semibold">{t("about")}</h2>
              <p className="max-w-[68ch] text-base leading-7 break-words whitespace-pre-line text-ink-2 sm:text-[17px]">
                {project.description}
              </p>
            </section>
          ) : null}

          {project.hasStory ? (
            <section className="flex flex-col gap-6 pt-10">
              <h2 className="text-[22px] leading-7 font-semibold sm:text-[26px] sm:leading-8">
                {t("how")}
              </h2>
              <BuildStory project={project} />
            </section>
          ) : null}

          {replies ? <div className="pt-6">{replies}</div> : null}
        </article>

        <aside className="flex flex-col gap-6 lg:w-[300px] lg:shrink-0">
          <div className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <Avatar name={maker.displayName} src={maker.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-base leading-6 font-semibold">{maker.displayName}</p>
                <p className="truncate text-sm leading-5 text-muted">@{maker.username}</p>
              </div>
            </div>
            {maker.isTrusted ? <Badge className="self-start">{t("trusted")}</Badge> : null}
            {maker.bio ? (
              <p className="line-clamp-3 text-sm leading-5 text-ink-2">{maker.bio}</p>
            ) : null}
            <Link
              href={`/u/${maker.username}`}
              className="self-start text-sm font-semibold text-accent-text underline underline-offset-3"
            >
              {t("viewProfile")}
            </Link>
            {maker.tipUrl ? (
              <ExternalLink
                href={maker.tipUrl}
                className={buttonStyles({ variant: "outline-accent", className: "w-full" })}
              >
                {t("tip", { name: maker.displayName })}
              </ExternalLink>
            ) : null}
          </div>

          <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-sm leading-5">
            {project.tools.length > 0 ? (
              <>
                <MetaTerm>{t("meta.tools")}</MetaTerm>
                <dd className="flex flex-wrap gap-x-2 gap-y-1">
                  {project.tools.map((tool, index) => (
                    <span key={`${tool.name}-${index}`}>
                      {tool.slug ? (
                        <Link
                          href={`/tools/${tool.slug}`}
                          className="text-accent-text underline-offset-3 hover:underline"
                        >
                          {tool.name}
                        </Link>
                      ) : (
                        tool.name
                      )}
                      {index < project.tools.length - 1 ? "," : ""}
                    </span>
                  ))}
                </dd>
              </>
            ) : null}
            <MetaTerm>{t("meta.buildTime")}</MetaTerm>
            <dd>{tCard("effort", { effort: project.buildEffort })}</dd>
            <MetaTerm>{t("meta.category")}</MetaTerm>
            <dd>{category}</dd>
            {project.repoUrl ? (
              <>
                <MetaTerm>{t("meta.repo")}</MetaTerm>
                <dd className="min-w-0">
                  {project.repoPrivate ? (
                    t("meta.repoPrivate")
                  ) : (
                    <ExternalLink
                      href={project.repoUrl}
                      className="block truncate text-accent-text underline-offset-3 hover:underline"
                    >
                      {shortUrl(project.repoUrl)}
                    </ExternalLink>
                  )}
                </dd>
              </>
            ) : null}
            {linkStatus ? (
              <>
                <MetaTerm>{t("meta.linkStatus")}</MetaTerm>
                <dd>
                  {checkedDate
                    ? t("meta.linkChecked", { status: tLinkStatus(linkStatus), date: checkedDate })
                    : tLinkStatus(linkStatus)}
                </dd>
              </>
            ) : null}
          </dl>

          {project.others.length > 0 ? (
            <section className="flex flex-col gap-4 border-t border-border pt-5">
              <h2 className="text-[13px] leading-4 font-semibold text-muted">
                {t("others", { name: maker.displayName })}
              </h2>
              {project.others.map((other) => (
                <Link
                  key={other.slug}
                  href={`/p/${other.slug}`}
                  className="group flex flex-col gap-0.5 border-l-[1.5px] border-margin pl-3"
                >
                  <span className="text-base leading-6 font-semibold group-hover:underline">
                    {other.title}
                  </span>
                  <span className="line-clamp-2 text-sm leading-5 text-ink-2">
                    {other.keyPrompt}
                  </span>
                </Link>
              ))}
            </section>
          ) : null}

          {reportLink}
        </aside>
      </div>
    </main>
  );
}

function MetaTerm({ children }: { children: ReactNode }) {
  return <dt className="text-[13px] leading-5 font-semibold text-muted">{children}</dt>;
}
