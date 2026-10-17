import { Suspense } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getProjectReplies, type ReplyView } from "@/lib/interactions/replies";
import { getViewerVote, loginHref, onboardingHref } from "@/lib/interactions/viewer";
import type { ProjectDetail } from "@/lib/projects/detail";
import { RepliesSection } from "./replies";
import { ReportButton } from "./report-button";
import { WorthItButton } from "./worth-it-button";
import { worthItStyles } from "./worth-it-styles";

// Server parts of the project page interactions. The public page is cached for everyone; the
// visitor-specific bits (their vote, the reply form, report links) stream in per request.

type Target = Pick<ProjectDetail, "id" | "slug" | "upvoteCount"> & { ownerId: string };

async function projectPath(slug: string, hash = "") {
  return `/${await getLocale()}/p/${slug}${hash}`;
}

// ---------------------------------------------------------------------------
// Worth it
// ---------------------------------------------------------------------------

/** The Worth it counter: a toggle for signed-in visitors, a login link otherwise. */
export function ProjectWorthIt({ project }: { project: Target }) {
  return (
    <Suspense fallback={<WorthItCount count={project.upvoteCount} />}>
      <ViewerWorthIt project={project} />
    </Suspense>
  );
}

async function ViewerWorthIt({ project }: { project: Target }) {
  const user = await getCurrentUser();
  if (!user) {
    const t = await getTranslations("interactions.worthIt");
    const format = await getFormatter();
    const href = loginHref(await getLocale(), await projectPath(project.slug));
    return (
      <a href={href} title={t("loginHint")} className={worthItStyles(false, "hover:border-ink")}>
        {t("label")} <span aria-hidden="true">·</span>
        <span className="tabular-nums">{format.number(project.upvoteCount)}</span>
        <span className="sr-only">({t("loginHint")})</span>
      </a>
    );
  }
  // No voting on your own project (Q13): the maker sees the plain counter.
  if (user.id === project.ownerId) return <WorthItCount count={project.upvoteCount} own />;

  const vote = await getViewerVote(project.id, user.id);
  if (!vote) return <WorthItCount count={project.upvoteCount} />;
  return <WorthItButton projectId={project.id} voted={vote.voted} count={vote.count} />;
}

/** Read-only counter: while the visitor loads, for the maker, and on non-public previews. */
export async function WorthItCount({ count, own = false }: { count: number; own?: boolean }) {
  const t = await getTranslations("interactions.worthIt");
  const format = await getFormatter();
  return (
    <span className={worthItStyles(false)} title={own ? t("ownProject") : undefined}>
      {t("label")} <span aria-hidden="true">·</span>
      <span className="tabular-nums">{format.number(count)}</span>
      {own ? <span className="sr-only">({t("ownProject")})</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

/** "Balasan" with the shared (cached) list; the form and per-reply actions follow the visitor. */
export async function ProjectReplies({ project }: { project: Target }) {
  const replies = await getProjectReplies(project.id);
  return (
    <Suspense
      fallback={
        <RepliesSection
          projectId={project.id}
          ownerId={project.ownerId}
          replies={replies}
          viewer={{ kind: "loading" }}
          turnstileSiteKey={null}
        />
      }
    >
      <ViewerReplies project={project} replies={replies} />
    </Suspense>
  );
}

async function ViewerReplies({ project, replies }: { project: Target; replies: ReplyView[] }) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const here = await projectPath(project.slug, "#balasan");

  return (
    <RepliesSection
      projectId={project.id}
      ownerId={project.ownerId}
      replies={replies}
      viewer={
        !user
          ? { kind: "anon", loginHref: loginHref(locale, here) }
          : !user.username
            ? { kind: "needs_username", id: user.id, onboardingHref: onboardingHref(locale, here) }
            : { kind: "user", id: user.id }
      }
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
    />
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const reportLinkClass =
  "inline-flex min-h-11 items-center self-center text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline";

/** "Laporkan proyek ini" under the sidebar; hidden from the maker. */
export function ProjectReportLink({ project }: { project: Target }) {
  return (
    <Suspense fallback={null}>
      <ViewerReportLink project={project} />
    </Suspense>
  );
}

async function ViewerReportLink({ project }: { project: Target }) {
  const user = await getCurrentUser();
  if (user?.id === project.ownerId) return null;
  if (!user) {
    const t = await getTranslations("interactions.report");
    const href = loginHref(await getLocale(), await projectPath(project.slug));
    return (
      <a href={href} className={reportLinkClass}>
        {t("trigger.project")}
      </a>
    );
  }
  return <ReportButton targetType="project" targetId={project.id} className={reportLinkClass} />;
}
