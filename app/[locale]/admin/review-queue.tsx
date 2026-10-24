import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { SystemMessage } from "@/components/ui/bubble";
import { ExternalLink } from "@/components/ui/external-link";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@/lib/cn";
import { getReviewQueue, REVIEW_WINDOW_HOURS, type QueueItem } from "@/lib/admin/data";
import { ActionLogProvider } from "./action-log";
import { ReviewActions } from "./review-actions";

const HOUR = 3_600_000;

/** "Antrean review": pending projects, oldest first, each with its 48-hour deadline. */
export async function ReviewQueuePanel() {
  const t = await getTranslations("admin.queue");
  const { items, now } = await getReviewQueue();

  return (
    <>
      <PanelHeading
        title={t.rich("title", { em: (chunks) => <span className="italic">{chunks}</span> })}
        lede={t("lede", { hours: REVIEW_WINDOW_HOURS })}
      />
      <ActionLogProvider>
        {items.length === 0 ? (
          <SystemMessage className="max-w-xl">{t("empty")}</SystemMessage>
        ) : (
          <ul className="flex flex-col gap-[18px]">
            {items.map((item) => (
              <li key={item.id}>
                <QueueCard item={item} now={now} />
              </li>
            ))}
          </ul>
        )}
      </ActionLogProvider>
    </>
  );
}

export async function PanelHeading({
  title,
  lede,
  action,
}: {
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[36px] leading-tight font-normal tracking-[-0.8px] sm:text-[44px] sm:tracking-[-1px]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-1.5 max-w-[640px] text-[15px] leading-normal text-ink-2">{lede}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export async function QueueCard({ item, now }: { item: QueueItem; now: number }) {
  const t = await getTranslations("admin.queue");
  const tCategory = await getTranslations("categories");
  const format = await getFormatter();

  const submitted = new Date(item.submittedAt);
  const hoursLeft = Math.ceil((submitted.getTime() + REVIEW_WINDOW_HOURS * HOUR - now) / HOUR);
  const overdue = hoursLeft <= 0;
  const host = item.liveUrl.replace(/^https:\/\//, "").replace(/\/$/, "");

  return (
    <article
      aria-labelledby={`queue-${item.id}`}
      className="flex flex-col gap-5 rounded-[22px] border border-border bg-surface p-4 sm:p-5 md:flex-row md:items-start"
    >
      <div className="relative aspect-[16/11] w-full shrink-0 overflow-hidden rounded-xl bg-placeholder md:h-[110px] md:w-[160px]">
        {item.coverKey ? (
          <MediaImage
            mediaKey={item.coverKey}
            alt=""
            fill
            sizes="(min-width: 768px) 160px, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-muted uppercase">
            {t("noImage")}
          </span>
        )}
      </div>

      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <Avatar name={item.maker.displayName} src={item.maker.avatarUrl} size="xs" />
          {item.maker.username ? (
            <Link
              href={`/u/${item.maker.username}`}
              className="font-semibold text-ink hover:underline"
            >
              {item.maker.displayName}
            </Link>
          ) : (
            <span className="font-semibold text-ink">{item.maker.displayName}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{item.resubmitted ? t("resubmitted") : t("newMaker")}</span>
          <span aria-hidden="true">·</span>
          <time
            dateTime={item.submittedAt}
            title={format.dateTime(submitted, { dateStyle: "medium", timeStyle: "short" })}
          >
            {t("submitted", { when: format.relativeTime(submitted, now) })}
          </time>
          <span
            className={cn(
              "font-mono text-[11px] uppercase sm:ml-auto",
              overdue ? "rounded-full bg-ink px-2 py-0.5 text-bg" : "text-muted",
            )}
          >
            {overdue
              ? t("overdue", { hours: Math.max(1, -hoursLeft) })
              : t("hoursLeft", { hours: hoursLeft })}
          </span>
        </div>

        <h2 id={`queue-${item.id}`} className="text-[17px] leading-snug font-semibold">
          <Link href={`/p/${item.slug}`} className="hover:underline">
            {item.title}
          </Link>
        </h2>
        <p className="text-sm text-ink-2">{item.tagline}</p>
        <p className="max-w-full self-start rounded-[14px] rounded-br-[4px] bg-bubble px-3.5 py-2.5 text-sm leading-[1.45] break-words">
          {item.keyPrompt}
        </p>
        <p className="text-xs leading-relaxed text-muted">
          {[
            item.tools.join(", "),
            tCategory(item.category),
            t("buildTime", { effort: item.buildEffort }),
          ]
            .filter(Boolean)
            .join(" · ")}{" "}
          ·{" "}
          <ExternalLink href={item.liveUrl} className="break-all text-accent-text hover:underline">
            {host}
          </ExternalLink>
        </p>
      </div>

      <ReviewActions projectId={item.id} title={item.title} />
    </article>
  );
}
