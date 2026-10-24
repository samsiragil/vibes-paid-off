import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge, MonoLabel } from "@/components/ui/badge";
import { SystemMessage, TimeGap } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/copy-link";
import { ExternalLink } from "@/components/ui/external-link";
import { WorthItCount } from "@/components/interactions/project-interactions";
import type { ProjectDetail } from "@/lib/projects/detail";
import { BuildStory } from "./build-timeline";
import { LinkStatusBadge } from "./link-status-badge";
import { MediaGallery } from "./media-gallery";

/** "https://github.com/ragil/kasir/" → "github.com/ragil/kasir". */
function shortUrl(url: string) {
  return url.replace(/^https:\/\//, "").replace(/\/+$/, "");
}

/**
 * The project page (VPO-Proyek): header with actions, the key prompt → "satu weekend kemudian" →
 * screenshots conversation, "Cara membuatnya" (the story moments and any build sessions from
 * before build_effort), and the meta sidebar.
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
  const checkedDate = project.lastCheckedAt
    ? format.dateTime(new Date(project.lastCheckedAt), { dateStyle: "medium" })
    : null;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 sm:px-6">
      <nav aria-label={t("breadcrumb")} className="text-[13px] text-muted">
        <ol className="flex min-w-0 flex-wrap items-center gap-2">
          <li>
            <Link href="/explore" className="underline-offset-2 hover:text-ink hover:underline">
              {t("explore")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={{ pathname: "/explore", query: { category: project.category } }}
              className="underline-offset-2 hover:text-ink hover:underline"
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

      <section className="flex flex-col gap-6 border-b border-border pt-8 pb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:pt-9">
        <div className="min-w-0">
          <h1 className="font-display text-[40px] leading-[1.02] font-normal tracking-[-1px] break-words sm:text-[56px] sm:tracking-[-1.4px]">
            {project.title}
          </h1>
          <p className="mt-3 text-lg leading-normal text-ink-2">{project.tagline}</p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <LinkStatusBadge status={project.linkStatus} />
            <Badge variant="outline" className="font-mono">
              <abbr
                title={t("contentLang", { lang: project.contentLang })}
                className="no-underline"
              >
                {project.contentLang.toUpperCase()}
              </abbr>
            </Badge>
            <Badge variant="outline">{category}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0 lg:flex-nowrap">
          {worthIt ?? <WorthItCount count={project.upvoteCount} />}
          {project.linkStatus === "live" ? (
            <ExternalLink
              href={project.liveUrl}
              className={buttonStyles({
                variant: "accent",
                className: "h-[50px] px-[22px] text-[15px]",
              })}
            >
              {t("tryLive")} <span aria-hidden="true">↗</span>
              <span className="sr-only">{t("newTab")}</span>
            </ExternalLink>
          ) : project.linkStatus === "offline" ? (
            <ExternalLink
              href={project.liveUrl}
              className={buttonStyles({
                variant: "outline",
                className: "h-[50px] px-[22px] text-[15px]",
              })}
            >
              {t("tryLiveOffline")} <span aria-hidden="true">↗</span>
              <span className="sr-only">{t("newTab")}</span>
            </ExternalLink>
          ) : null}
          <ShareButton title={project.title} />
          {ownerActions}
        </div>
      </section>

      {project.linkStatus !== "live" ? (
        <SystemMessage tone="soft" className="mt-6 max-w-[760px]">
          {project.linkStatus === "offline" ? t("offlineNotice") : t("archivedNotice")}
        </SystemMessage>
      ) : null}

      <div className="flex flex-col gap-12 pt-10 lg:flex-row lg:items-start lg:gap-14">
        <article className="flex min-w-0 grow flex-col gap-[18px]">
          <div className="flex items-end justify-end gap-3">
            <div className="max-w-[92%] rounded-[26px] rounded-br-md bg-ink px-5 py-[18px] text-bg sm:max-w-[80%] sm:px-[26px] sm:py-[22px]">
              <p className="mb-2 font-mono text-[11px] tracking-[0.4px] uppercase opacity-65">
                {t("keyPrompt")}
              </p>
              <p className="font-display text-[22px] leading-[1.25] break-words whitespace-pre-line sm:text-[30px] sm:leading-[1.2]">
                {project.keyPrompt}
              </p>
            </div>
            <Avatar
              name={maker.displayName}
              src={maker.avatarUrl}
              className="hidden sm:inline-flex"
            />
          </div>

          <TimeGap>{timeLabel}</TimeGap>

          <div className="flex items-end gap-3">
            <span
              aria-hidden="true"
              className="hidden size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-accent-text sm:inline-flex"
            >
              <SparkIcon />
            </span>
            <div className="min-w-0 grow rounded-[26px] rounded-bl-md border border-border bg-surface p-3 sm:p-4">
              <MediaGallery
                media={project.media}
                title={project.title}
                videoUrl={project.videoUrl}
              />
            </div>
          </div>

          {project.description ? (
            <section className="mt-4 flex flex-col gap-2.5">
              <MonoLabel>{t("about")}</MonoLabel>
              <p className="text-[17px] leading-relaxed break-words whitespace-pre-line text-ink-2">
                {project.description}
              </p>
            </section>
          ) : null}

          {project.hasStory ? (
            <>
              <div className="flex items-center gap-4 pt-9 pb-2">
                <span aria-hidden="true" className="h-px grow bg-border" />
                <h2 className="font-display text-[28px] font-normal sm:text-[32px]">
                  {t("howLead")} <span className="italic">{t("howTail")}</span>
                </h2>
                <span aria-hidden="true" className="h-px grow bg-border" />
              </div>

              <BuildStory project={project} />
            </>
          ) : null}

          {replies}
        </article>

        <aside className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
          <Link
            href={`/u/${maker.username}`}
            className="flex flex-col gap-3.5 rounded-[22px] border border-border bg-surface p-5 transition-colors hover:border-border-strong"
          >
            <span className="flex items-center gap-3">
              <Avatar
                name={maker.displayName}
                src={maker.avatarUrl}
                className="size-12 text-[15px]"
              />
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold">{maker.displayName}</span>
                <span className="block truncate font-mono text-xs text-muted">
                  @{maker.username}
                  {maker.isTrusted ? ` · ${t("trusted")}` : ""}
                </span>
              </span>
            </span>
            {maker.bio ? (
              <span className="line-clamp-3 text-sm leading-normal text-ink-2">{maker.bio}</span>
            ) : null}
            <span className="text-sm font-medium text-accent-text">{t("viewProfile")} →</span>
          </Link>

          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-3.5 rounded-[22px] border border-border bg-surface p-5 text-sm">
            {project.tools.length > 0 ? (
              <>
                <MetaTerm>{t("meta.tools")}</MetaTerm>
                <dd className="flex flex-wrap gap-x-2 gap-y-1">
                  {project.tools.map((tool, index) => (
                    <span key={`${tool.name}-${index}`}>
                      {tool.slug ? (
                        <Link
                          href={`/tools/${tool.slug}`}
                          className="text-accent-text underline-offset-2 hover:underline"
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
                  <ExternalLink
                    href={project.repoUrl}
                    className="block truncate text-accent-text underline-offset-2 hover:underline"
                  >
                    {shortUrl(project.repoUrl)}
                  </ExternalLink>
                </dd>
              </>
            ) : null}
            <MetaTerm>{t("meta.linkStatus")}</MetaTerm>
            <dd>
              {checkedDate
                ? t("meta.linkChecked", {
                    status: tLinkStatus(project.linkStatus),
                    date: checkedDate,
                  })
                : tLinkStatus(project.linkStatus)}
            </dd>
          </dl>

          {maker.tipUrl ? (
            <ExternalLink
              href={maker.tipUrl}
              className={buttonStyles({ variant: "outline-accent", size: "lg", className: "h-12" })}
            >
              {t("tip", { name: maker.displayName })}
            </ExternalLink>
          ) : null}

          {project.others.length > 0 ? (
            <section className="flex flex-col gap-2.5 border-t border-border pt-4">
              <h2 className="font-mono text-[11px] tracking-[0.4px] text-muted uppercase">
                {t("others", { name: maker.displayName })}
              </h2>
              {project.others.map((other) => (
                <Link
                  key={other.slug}
                  href={`/p/${other.slug}`}
                  className="rounded-[14px] rounded-br-sm bg-bubble px-3.5 py-2.5 text-sm leading-[1.45] transition-colors hover:bg-placeholder"
                >
                  <span className="sr-only">{other.title}: </span>
                  {other.keyPrompt}
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
  return (
    <dt className="pt-0.5 font-mono text-[11px] tracking-[0.4px] text-muted uppercase">
      {children}
    </dt>
  );
}

function SparkIcon() {
  return (
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
  );
}
