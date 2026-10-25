import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SystemMessage } from "@/components/ui/bubble";
import { getWeeklyPicks, type WeeklyPickView } from "@/lib/admin/data";
import { PanelHeading } from "./review-queue";

/**
 * "Pilihan minggu ini", read-only (§2.7): each frozen week with the breakdown it was chosen on.
 * There is deliberately no control here: admins cannot change a winner.
 */
export async function WeeklyPicksPanel() {
  const t = await getTranslations("admin.picks");
  const picks = await getWeeklyPicks();

  return (
    <>
      <PanelHeading title={t.rich("title", { em: (chunks) => chunks })} lede={t("lede")} />
      {picks.length === 0 ? (
        <SystemMessage className="max-w-xl">{t("empty")}</SystemMessage>
      ) : (
        <ul className="flex flex-col gap-[18px]">
          {picks.map((pick) => (
            <li key={pick.weekStart}>
              <PickCard pick={pick} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export async function PickCard({ pick }: { pick: WeeklyPickView }) {
  const t = await getTranslations("admin.picks");
  const format = await getFormatter();
  // week_start is a calendar date; noon UTC keeps it on the same day in Asia/Jakarta.
  const week = new Date(`${pick.weekStart}T12:00:00Z`);
  const titleId = `pick-${pick.weekStart}`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded border border-border bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-semibold text-muted">
          {t("week", { date: format.dateTime(week, { dateStyle: "medium" }) })}
        </p>
        <h2 id={titleId} className="text-[17px] font-semibold">
          {pick.winner ? (
            pick.winner.slug ? (
              <Link href={`/p/${pick.winner.slug}`} className="hover:underline">
                {pick.winner.title}
              </Link>
            ) : (
              t("deletedProject")
            )
          ) : (
            t("noWinner", { min: pick.minScore ?? 3 })
          )}
        </h2>
        {pick.winner ? (
          <p className="text-sm text-ink-2">
            {t("why", {
              score: format.number(pick.winner.score),
              votes: pick.winner.eligibleVotes,
              repliers: pick.winner.eligibleRepliers,
            })}
          </p>
        ) : null}
        {pick.windowFrom && pick.windowTo ? (
          <p className="text-[13px] text-muted">
            {t("window", {
              from: format.dateTime(new Date(pick.windowFrom), { dateStyle: "medium" }),
              // The window ends at Monday 00:00; show the Sunday it covers.
              to: format.dateTime(new Date(Date.parse(pick.windowTo) - 1), { dateStyle: "medium" }),
              computed: format.dateTime(new Date(pick.computedAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        ) : null}
      </div>

      {pick.candidates.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <caption className="sr-only">{t("candidatesCaption")}</caption>
            <thead className="text-[13px] font-semibold text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-normal">
                  #
                </th>
                <th scope="col" className="py-2 pr-3 font-normal">
                  {t("table.project")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  {t("table.votes")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  {t("table.repliers")}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t("table.score")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pick.candidates.map((candidate, index) => (
                <tr key={candidate.projectId} className="border-t border-border">
                  <td className="py-2.5 pr-3 text-muted tabular-nums">{index + 1}</td>
                  <td className="py-2.5 pr-3">
                    {candidate.slug ? (
                      <Link href={`/p/${candidate.slug}`} className="hover:underline">
                        {candidate.title}
                      </Link>
                    ) : (
                      t("deletedProject")
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{candidate.eligibleVotes}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {candidate.eligibleRepliers}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {format.number(candidate.score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
