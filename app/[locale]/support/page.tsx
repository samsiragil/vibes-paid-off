import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { Badge, Label } from "@/components/ui/badge";
import { PromptBubble, SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { PageTransition, Reveal } from "@/components/ui/transitions";
import { cn } from "@/lib/cn";
import { donateLink, type DonateChannel } from "@/lib/donate";
import { getLatestWeeklyPick } from "@/lib/projects/weekly-pick";
import { localeAlternates } from "@/lib/seo";
import { PICKING_ANCHOR } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("support");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(await getLocale(), "/support"),
  };
}

/** Minimum score for "Pilihan minggu ini" (compute_weekly_pick), unless a stored pick says otherwise. */
const DEFAULT_MIN_SCORE = 3;

const costRows = ["domain", "hosting", "database", "storage", "edge"] as const;

// Dukung kami (VPO-Support): why the site is free, the two donation channels (Q16), the open cost
// table and, below, how rankings are computed (§2.7) with the latest stored weekly pick.
export default async function SupportPage() {
  const t = await getTranslations("support");

  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-12">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-14">
          <section className="flex min-w-0 grow flex-col gap-4">
            <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
              {t("titleLead")} {t("titleTail")}
            </h1>

            <div className="flex flex-col gap-4 pt-2">
              <Question>{t("faq.freeQ")}</Question>
              <Answer>{t("faq.freeA")}</Answer>
              <Question>{t("faq.moneyQ")}</Question>
              <Answer>{t("faq.moneyA")}</Answer>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <DonateCard channel="local" />
              <DonateCard channel="global" />
            </div>

            <SystemMessage tone="soft" className="mt-4">
              {t.rich("makerTip", {
                link: (chunks) => (
                  <Link
                    href="/me?tab=profile"
                    className="font-semibold text-accent-text underline underline-offset-3"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </SystemMessage>
          </section>

          <aside className="flex flex-col gap-4 lg:w-[360px] lg:shrink-0 lg:pt-2">
            <CostTable />
            <div className="flex flex-col gap-2 rounded border border-dashed border-(--dashed) bg-surface p-5">
              <Label>{t("later.label")}</Label>
              <p className="text-base leading-6">{t("later.body")}</p>
            </div>
            <div className="flex flex-col gap-2 rounded border border-border bg-surface p-5">
              <Label>{t("target.label")}</Label>
              <p className="text-lg leading-7 font-semibold">
                {t("target.lead")} {t("target.tail")}
              </p>
            </div>
          </aside>
        </div>

        <HowWePick />
      </main>
      <SiteFooter />
    </PageTransition>
  );
}

/** A visitor's question, as a note with the margin line. */
function Question({ children }: { children: ReactNode }) {
  return <PromptBubble className="max-w-[68ch] font-semibold">{children}</PromptBubble>;
}

/** The site's answer: a note from the site itself. */
function Answer({ children }: { children: ReactNode }) {
  return <SystemMessage className="max-w-[720px]">{children}</SystemMessage>;
}

async function DonateCard({ channel }: { channel: DonateChannel }) {
  const t = await getTranslations(`support.${channel}`);
  const tSupport = await getTranslations("support");
  const link = donateLink(channel);
  const variant = channel === "local" ? "accent" : "outline-accent";

  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-surface p-5 sm:p-6">
      <Label>{t("eyebrow")}</Label>
      <h2 className="text-[22px] leading-7 font-semibold">
        {t("titleLead")} {t("titleTail")}
      </h2>
      <p className="text-base leading-6 text-ink-2">{t("body")}</p>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant, size: "lg", className: "mt-auto self-start" })}
        >
          {t("cta", { platform: link.platform })}
        </a>
      ) : (
        <p
          className={buttonStyles({
            variant: "outline",
            size: "lg",
            className: "mt-auto self-start border-dashed text-muted hover:border-border-strong",
          })}
        >
          {tSupport("soon")}
        </p>
      )}
    </div>
  );
}

async function CostTable() {
  const t = await getTranslations("support.costs");

  return (
    <div className="flex flex-col rounded border border-border bg-surface p-5">
      <Label className="mb-2">{t("label")}</Label>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{t("label")}</caption>
        <tbody>
          {costRows.map((row) => (
            <tr key={row} className="border-t border-border">
              <th scope="row" className="py-3 pr-3 font-normal">
                <span className="block text-base leading-6 font-semibold">{t(row)}</span>
                <span className="block text-sm leading-5 text-muted">{t(`${row}Vendor`)}</span>
              </th>
              <td className="py-3 text-right align-top text-sm whitespace-nowrap tabular-nums">
                {row === "domain" ? t("domainCost") : t("free")}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink">
            <th scope="row" className="pt-3 text-base font-semibold">
              {t("total")}
            </th>
            <td className="pt-3 text-right text-xl font-bold whitespace-nowrap tabular-nums">
              {t("totalValue")}{" "}
              <span className="text-sm font-normal text-muted">{t("totalNote")}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

async function HowWePick() {
  const t = await getTranslations("support.picking");
  const rules = [
    ["votesTitle", "votesBody"],
    ["repliersTitle", "repliersBody"],
    ["popularTitle", "popularBody"],
    ["pickTitle", "pickBody"],
    ["worthItTitle", "worthItBody"],
  ] as const;

  return (
    <section
      id={PICKING_ANCHOR}
      aria-labelledby={`${PICKING_ANCHOR}-title`}
      className="mt-16 flex scroll-mt-6 flex-col gap-4 border-t border-border pt-12"
    >
      <h2
        id={`${PICKING_ANCHOR}-title`}
        className="text-[22px] leading-7 font-semibold sm:text-[26px] sm:leading-8"
      >
        {t("titleLead")} {t("titleTail")}
      </h2>

      <div className="flex max-w-[820px] flex-col gap-4 pt-2">
        <Question>{t("question")}</Question>
        <Answer>{t("answer")}</Answer>
      </div>

      <div className="mt-4 flex flex-col gap-2 self-start rounded border border-border-strong bg-surface px-5 py-4">
        <Label>{t("formulaLabel")}</Label>
        <p className="text-lg leading-7 font-semibold">{t("formula")}</p>
      </div>

      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {rules.map(([title, body]) => (
          <li
            key={title}
            className={cn(
              "flex flex-col gap-2 rounded border border-border bg-surface p-5",
              title === "pickTitle" && "md:row-span-2",
            )}
          >
            <h3 className="text-lg leading-6 font-semibold">{t(title)}</h3>
            <p className="text-base leading-6 text-ink-2">{t(body, { min: DEFAULT_MIN_SCORE })}</p>
          </li>
        ))}
      </ul>

      <Reveal
        fallback={
          <div aria-hidden="true" className="mt-4 h-40 rounded border border-border bg-surface" />
        }
      >
        <PickExample />
      </Reveal>
    </section>
  );
}

/** The latest stored weekly pick worked out with the formula, or a made-up example before one exists. */
async function PickExample() {
  const [t, format, pick] = await Promise.all([
    getTranslations("support.picking"),
    getFormatter(),
    getLatestWeeklyPick(),
  ]);
  const min = pick?.minScore ?? DEFAULT_MIN_SCORE;

  let body: ReactNode;
  if (!pick) {
    body = <p className="text-base leading-6">{t("exampleSample", { min })}</p>;
  } else {
    // Monday the pick was stored for; it scored the Monday–Sunday before it.
    const weekStart = new Date(`${pick.weekStart}T00:00:00+07:00`);
    const day = 24 * 60 * 60 * 1000;
    const week = format.dateTime(weekStart, { day: "numeric", month: "long", year: "numeric" });
    const range = format.dateTimeRange(
      new Date(weekStart.getTime() - 7 * day),
      new Date(weekStart.getTime() - day),
      { day: "numeric", month: "short" },
    );

    body =
      pick.candidates.length === 0 ? (
        <>
          <p className="text-base leading-6">{t("exampleNone", { week, range, min })}</p>
          <p className="text-base leading-6 text-ink-2">{t("exampleSample", { min })}</p>
        </>
      ) : (
        <>
          <p className="text-base leading-6">{t("exampleIntro", { week, range })}</p>
          <ol className="flex flex-col">
            {pick.candidates.map((candidate, index) => (
              <li
                key={index}
                className="flex flex-col gap-1 border-t border-border py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span className="text-sm text-muted tabular-nums">{index + 1}</span>
                  {candidate.slug && candidate.title ? (
                    <Link
                      href={`/p/${candidate.slug}`}
                      className="min-w-0 font-semibold break-words underline-offset-3 hover:underline"
                    >
                      {candidate.title}
                    </Link>
                  ) : (
                    <span className="text-muted">{t("exampleHidden")}</span>
                  )}
                  {candidate.winner ? (
                    <Badge variant="highlight">{t("exampleWinner")}</Badge>
                  ) : null}
                </span>
                <span className="text-sm whitespace-nowrap text-ink-2 tabular-nums max-sm:pl-5">
                  {t("exampleRow", {
                    votes: format.number(candidate.eligibleVotes),
                    repliers: format.number(candidate.eligibleRepliers),
                    score: format.number(candidate.score),
                  })}
                </span>
              </li>
            ))}
          </ol>
        </>
      );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded border border-dashed border-(--dashed) bg-surface p-5">
      <Label>{t(pick ? "exampleLabel" : "exampleSampleLabel")}</Label>
      {body}
    </div>
  );
}
