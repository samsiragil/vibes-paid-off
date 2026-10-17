import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SystemMessage } from "@/components/ui/bubble";
import { cn } from "@/lib/cn";
import { getOpenReports, type ReportGroup } from "@/lib/admin/data";
import { ActionLogProvider } from "./action-log";
import { ReportActions } from "./report-actions";
import { PanelHeading } from "./review-queue";

/** "Laporan": open reports grouped per project or reply, hidden ones first. */
export async function ReportsPanel() {
  const t = await getTranslations("admin.reports");
  const groups = await getOpenReports();

  return (
    <>
      <PanelHeading title={t("title")} lede={t("lede")} />
      <ActionLogProvider>
        {groups.length === 0 ? (
          <SystemMessage className="max-w-xl">{t("empty")}</SystemMessage>
        ) : (
          <ul className="flex flex-col gap-[18px]">
            {groups.map((group) => (
              <li key={`${group.targetType}:${group.targetId}`}>
                <ReportCard group={group} />
              </li>
            ))}
          </ul>
        )}
      </ActionLogProvider>
    </>
  );
}

export async function ReportCard({ group }: { group: ReportGroup }) {
  const t = await getTranslations("admin.reports");
  const tReasons = await getTranslations("interactions.report.reasons");

  const isProject = group.targetType === "project";
  const missing = isProject ? !group.project : !group.comment;
  // Whose trust is at stake: the maker for a project, the author for a reply.
  const person = isProject ? group.project?.owner : group.comment?.author;
  const titleId = `report-${group.targetId}`;
  const label = isProject
    ? (group.project?.title ?? t("deletedProject"))
    : group.project
      ? t("replyLabel", { project: group.project.title })
      : t("deletedReply");

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-5 rounded-[22px] border bg-surface p-4 sm:p-5 xl:flex-row xl:items-center",
        group.hidden ? "border-ink" : "border-border",
      )}
    >
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {group.hidden ? (
            <span className="inline-flex h-6 items-center rounded-full bg-ink px-2.5 text-[11px] text-bg">
              {group.count >= 3 ? t("autoHidden") : t("hidden")}
            </span>
          ) : null}
          <span className="font-mono text-xs text-muted uppercase">
            {t(isProject ? "metaProject" : "metaReply", { count: group.count })}
            {!isProject && group.project ? (
              <span className="normal-case">
                {" "}
                · {t("onProject", { title: group.project.title })}
              </span>
            ) : null}
          </span>
        </div>

        <h2 id={titleId} className={cn(isProject ? "text-[17px] font-semibold" : "sr-only")}>
          {group.project && isProject ? (
            <Link href={`/p/${group.project.slug}`} className="hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
        </h2>
        {isProject && group.project ? (
          <p className="text-sm text-ink-2">{group.project.tagline}</p>
        ) : null}
        {group.comment ? (
          <p className="max-w-full self-start rounded-[14px] rounded-bl-[4px] bg-bubble px-3.5 py-2.5 text-sm break-words whitespace-pre-line">
            {group.comment.body}
          </p>
        ) : null}
        {missing ? <p className="text-sm text-ink-2 italic">{t("targetGone")}</p> : null}

        <p className="text-sm text-ink-2">
          {t("reasons", {
            reasons: group.reasons
              .map(({ reason, count }) => `${tReasons(reason).toLowerCase()} (${count})`)
              .join(", "),
          })}
          {person?.username ? (
            <>
              {" · "}
              {t(isProject ? "byMaker" : "byAuthor")}{" "}
              <Link href={`/u/${person.username}`} className="hover:underline">
                @{person.username}
              </Link>
              {person.isTrusted ? ` (${t("trusted")})` : null}
            </>
          ) : null}
        </p>
        {group.notes.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1 text-[13px] text-ink-2">
            {group.notes.map((note, index) => (
              <li key={index} className="break-words">
                “{note.note}”{note.reporter ? ` · @${note.reporter}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ReportActions
        targetType={group.targetType}
        targetId={group.targetId}
        label={label}
        hidden={group.hidden}
        missing={missing}
        person={
          person ? { id: person.id, username: person.username, isTrusted: person.isTrusted } : null
        }
      />
    </article>
  );
}
