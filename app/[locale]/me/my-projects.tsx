import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LinkStatusBadge } from "@/components/project/link-status-badge";
import { Badge } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media-image";
import type { MyProject } from "@/lib/profiles/me";
import { rejectReasonText } from "@/lib/projects/reject-reason";
import type { ProjectStatus } from "@/lib/projects/types";
import { ArchiveButton } from "./archive-button";
import { DeleteButton } from "./delete-button";
import { DismissibleNudge } from "./story-nudge";

// The "Proyek saya" tab of /me (VPO-Me) and the offline-link notice above the tabs.

/** "Link X sedang offline…": shown on /me for each published project whose link is down. */
export async function OfflineNotice({ project }: { project: MyProject }) {
  const t = await getTranslations("me");
  const format = await getFormatter();
  const strong = (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>;

  return (
    <SystemMessage>
      {project.lastCheckedAt
        ? t.rich("offlineNotice", {
            title: project.title,
            date: format.dateTime(new Date(project.lastCheckedAt), { dateStyle: "medium" }),
            strong,
          })
        : t.rich("offlineNoticeNoDate", { title: project.title, strong })}
    </SystemMessage>
  );
}

/**
 * "12 orang bilang Kasir Warung worth it. Mereka penasaran gimana kamu bikinnya." A published
 * project without a build story, once people noticed it or after a week live (MyProject.storyNudge).
 */
export async function StoryNudge({ project }: { project: MyProject }) {
  const t = await getTranslations("me.nudge");
  const strong = (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>;

  return (
    <DismissibleNudge
      projectId={project.id}
      action={
        <Link
          href={`/p/${project.slug}/edit#cerita`}
          className={buttonStyles({ variant: "primary", size: "sm" })}
        >
          {t("cta")}
        </Link>
      }
    >
      {project.upvoteCount > 0
        ? t.rich("upvotes", { count: project.upvoteCount, title: project.title, strong })
        : t.rich("aged", { title: project.title, strong })}
    </DismissibleNudge>
  );
}

/**
 * The outcome of a review (Q10: the maker's notification until emails are set up): why a
 * project was rejected and how to resubmit it, or that it was approved and is live now.
 */
export async function ReviewNotice({ project }: { project: MyProject }) {
  const t = await getTranslations("me.review");
  const strong = (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>;
  const edit = (chunks: ReactNode) => (
    <Link
      href={`/p/${project.slug}/edit`}
      className="font-medium text-accent-text underline underline-offset-2"
    >
      {chunks}
    </Link>
  );

  if (project.status !== "rejected") {
    return <SystemMessage>{t.rich("approved", { title: project.title, strong })}</SystemMessage>;
  }
  const reason = await rejectReasonText(project.rejectCode, project.rejectReason);
  return (
    <SystemMessage>
      {reason
        ? t.rich("rejected", { title: project.title, reason, strong, edit })
        : t.rich("rejectedNoReason", { title: project.title, strong, edit })}
    </SystemMessage>
  );
}

/** Status table of the signed-in maker's projects (stacked rows on small screens). */
export async function MyProjects({
  projects,
  isTrusted,
}: {
  projects: MyProject[];
  isTrusted: boolean;
}) {
  const t = await getTranslations("me");

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 pt-7">
        <SystemMessage className="max-w-xl">{t("empty")}</SystemMessage>
        <Link
          href="/submit"
          className={buttonStyles({ variant: "primary", className: "sm:ml-12" })}
        >
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  const columns =
    "lg:grid-cols-[minmax(0,1fr)_140px_120px_72px_72px_330px] lg:items-center lg:gap-5";

  return (
    <section className="flex flex-col pt-6">
      <div
        aria-hidden="true"
        className={`hidden pb-2 text-[13px] leading-4 font-semibold text-muted lg:grid ${columns}`}
      >
        <span>{t("table.project")}</span>
        <span>{t("table.status")}</span>
        <span>{t("table.link")}</span>
        <span>{t("table.worthIt")}</span>
        <span>{t("table.replies")}</span>
        <span />
      </div>
      <ul>
        {projects.map((project) => (
          <li key={project.id} className={`grid gap-4 border-t border-border py-4 ${columns}`}>
            <div className="flex min-w-0 items-start gap-3.5 lg:items-center">
              <div className="relative h-[60px] w-[84px] shrink-0 overflow-hidden rounded-sm border border-border bg-placeholder">
                {project.coverKey ? (
                  <MediaImage
                    mediaKey={project.coverKey}
                    alt=""
                    fill
                    sizes="84px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-base leading-6 font-semibold break-words">{project.title}</p>
                <p className="mt-1 max-w-full truncate border-l-[1.5px] border-margin pl-2.5 text-sm leading-5 text-ink-2">
                  {project.keyPrompt}
                </p>
                {project.status === "rejected" ? <RejectReason project={project} /> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:contents">
              <StatusBadge status={project.status} label={t(`status.${project.status}`)} />
              <span className="lg:justify-self-start">
                <LinkStatusBadge status={project.linkStatus} />
              </span>
              <span className="text-sm tabular-nums max-lg:ml-2">
                <span className="text-muted lg:sr-only">{t("table.worthIt")} </span>
                {project.upvoteCount}
              </span>
              <span className="text-sm tabular-nums max-lg:ml-2">
                <span className="text-muted lg:sr-only">{t("table.replies")} </span>
                {project.commentCount}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:justify-end">
              <Link
                href={`/p/${project.slug}/edit`}
                className={buttonStyles({
                  variant: "outline",
                  size: "sm",
                  className: "h-11 px-4 lg:h-9",
                })}
              >
                {t("edit")}
                <span className="sr-only">: {project.title}</span>
              </Link>
              <Link
                href={`/p/${project.slug}`}
                className={buttonStyles({
                  variant: "ghost",
                  size: "sm",
                  className: "h-11 px-4 text-accent-text lg:h-9",
                })}
              >
                {t("view")}
                <span className="sr-only">: {project.title}</span>
              </Link>
              {project.status === "published" || project.linkStatus === "archived" ? (
                <ArchiveButton
                  projectId={project.id}
                  title={project.title}
                  archived={project.linkStatus === "archived"}
                />
              ) : null}
              <DeleteButton projectId={project.id} title={project.title} />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6 text-sm text-ink-2">
        {isTrusted ? (
          <>
            <Badge className="bg-ink text-bg">{t("trusted")}</Badge>
            {t("trustedNote")}
          </>
        ) : (
          t("notTrustedNote")
        )}
      </div>
    </section>
  );
}

async function RejectReason({ project }: { project: MyProject }) {
  const t = await getTranslations("me");
  const reason = await rejectReasonText(project.rejectCode, project.rejectReason);
  return reason ? (
    <p className="mt-1.5 text-[13px] text-ink-2">{t("rejectReason", { reason })}</p>
  ) : null;
}

function StatusBadge({ status, label }: { status: ProjectStatus; label: string }) {
  if (status === "published") {
    return <Badge className="lg:justify-self-start">{label}</Badge>;
  }
  return (
    <Badge
      variant={status === "pending" ? "archived" : "offline"}
      className="lg:justify-self-start"
    >
      {label}
    </Badge>
  );
}
