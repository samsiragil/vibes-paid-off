import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SystemAvatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/badge";
import { PromptBubble } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
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
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-16">
          <section className="flex min-w-0 grow flex-col gap-[18px]">
            <h1 className="mb-3 font-display text-[44px] leading-none font-normal tracking-[-1px] sm:text-[64px] sm:tracking-[-1.6px]">
              {t("titleLead")} <span className="italic">{t("titleTail")}</span>
            </h1>

            <div className="flex flex-col gap-[18px]">
              <Question>{t("faq.freeQ")}</Question>
              <Answer>{t("faq.freeA")}</Answer>
              <Question>{t("faq.moneyQ")}</Question>
              <Answer>{t("faq.moneyA")}</Answer>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <DonateCard channel="local" />
              <DonateCard channel="global" />
            </div>

            <div className="mt-4 flex items-end gap-3">
              <SystemAvatar />
              <p className="max-w-[78%] rounded-[20px] rounded-bl-md bg-accent-soft px-[18px] py-3.5 text-[15px] leading-[1.55] text-accent-ink max-sm:max-w-none">
                {t.rich("makerTip", {
                  link: (chunks) => (
                    <Link
                      href="/me?tab=profile"
                      className="font-semibold underline underline-offset-2"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          </section>

          <aside className="flex flex-col gap-4 lg:w-[400px] lg:shrink-0 lg:pt-3">
            <CostTable />
            <div className="flex flex-col gap-2 rounded-[22px] border border-dashed border-(--dashed) bg-surface p-[22px]">
              <Label>{t("later.label")}</Label>
              <p className="text-[15px] leading-[1.55]">{t("later.body")}</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-[22px] bg-ink p-[22px] text-bg">
              <Label className="text-bg/70">{t("target.label")}</Label>
              <p className="font-display text-2xl leading-[1.25]">
                {t("target.lead")} <span className="italic">{t("target.tail")}</span>
              </p>
            </div>
          </aside>
        </div>

        <HowWePick />
      </main>
      <SiteFooter />
    </>
  );
}

function Question({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <PromptBubble
        tone="ink"
        className="max-w-[70%] rounded-[20px] rounded-br-md px-[18px] py-3.5 text-base leading-normal max-sm:max-w-[88%]"
      >
        {children}
      </PromptBubble>
    </div>
  );
}

function Answer({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-3">
      <SystemAvatar />
      <p className="max-w-[78%] rounded-[20px] rounded-bl-md border border-border bg-surface px-5 py-4 text-base leading-relaxed max-sm:max-w-none">
        {children}
      </p>
    </div>
  );
}

async function DonateCard({ channel }: { channel: DonateChannel }) {
  const t = await getTranslations(`support.${channel}`);
  const tSupport = await getTranslations("support");
  const link = donateLink(channel);
  const variant = channel === "local" ? "accent" : "outline-accent";

  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-6">
      <Label>{t("eyebrow")}</Label>
      <h2 className="font-display text-[28px] leading-[1.1] font-normal">
        {t("titleLead")} <span className="italic">{t("titleTail")}</span>
      </h2>
      <p className="text-sm leading-normal text-ink-2">{t("body")}</p>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant, className: "mt-auto h-12 self-start px-[22px]" })}
        >
          {t("cta", { platform: link.platform })}
        </a>
      ) : (
        <p
          className={buttonStyles({
            variant: "outline",
            className:
              "mt-auto h-12 self-start border-dashed px-[22px] text-muted hover:border-border-strong",
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
    <div className="flex flex-col rounded-[22px] border border-border bg-surface p-6">
      <Label className="mb-2.5">{t("label")}</Label>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{t("label")}</caption>
        <tbody>
          {costRows.map((row) => (
            <tr key={row} className="border-t border-border">
              <th scope="row" className="py-3 pr-3 font-normal">
                <span className="block text-[15px] font-medium">{t(row)}</span>
                <span className="block text-xs text-muted">{t(`${row}Vendor`)}</span>
              </th>
              <td className="py-3 text-right align-top font-mono text-sm whitespace-nowrap">
                {row === "domain" ? t("domainCost") : t("free")}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink">
            <th scope="row" className="pt-3.5 text-[15px] font-semibold">
              {t("total")}
            </th>
            <td className="pt-3.5 text-right font-display text-[26px] whitespace-nowrap">
              {t("totalValue")}{" "}
              <span className="font-sans text-xs text-muted">{t("totalNote")}</span>
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
      className="mt-20 flex scroll-mt-6 flex-col gap-[18px] border-t border-border pt-14"
    >
      <h2
        id={`${PICKING_ANCHOR}-title`}
        className="mb-3 font-display text-[38px] leading-none font-normal tracking-[-0.8px] sm:text-[52px] sm:tracking-[-1.2px]"
      >
        {t("titleLead")} <span className="italic">{t("titleTail")}</span>
      </h2>

      <div className="flex max-w-[820px] flex-col gap-[18px]">
        <Question>{t("question")}</Question>
        <Answer>{t("answer")}</Answer>
      </div>

      <div className="mt-4 flex flex-col gap-1.5 self-start rounded-[22px] bg-ink px-6 py-5 text-bg">
        <Label className="text-bg/70">{t("formulaLabel")}</Label>
        <p className="font-mono text-base sm:text-lg">{t("formula")}</p>
      </div>

      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {rules.map(([title, body]) => (
          <li
            key={title}
            className={cn(
              "flex flex-col gap-2 rounded-[22px] border border-border bg-surface p-6",
              title === "pickTitle" && "md:row-span-2",
            )}
          >
            <h3 className="font-display text-2xl leading-tight font-normal">{t(title)}</h3>
            <p className="text-[15px] leading-relaxed text-ink-2">
              {t(body, { min: DEFAULT_MIN_SCORE })}
            </p>
          </li>
        ))}
      </ul>

      <Suspense
        fallback={<div aria-hidden="true" className="mt-4 h-40 rounded-[22px] bg-bubble" />}
      >
        <PickExample />
      </Suspense>
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
    body = <p className="text-[15px] leading-relaxed">{t("exampleSample", { min })}</p>;
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
          <p className="text-[15px] leading-relaxed">{t("exampleNone", { week, range, min })}</p>
          <p className="text-[15px] leading-relaxed text-ink-2">{t("exampleSample", { min })}</p>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed">{t("exampleIntro", { week, range })}</p>
          <ol className="flex flex-col">
            {pick.candidates.map((candidate, index) => (
              <li
                key={index}
                className="flex flex-col gap-1 border-t border-border py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span className="font-mono text-xs text-muted">{index + 1}</span>
                  {candidate.slug && candidate.title ? (
                    <Link
                      href={`/p/${candidate.slug}`}
                      className="min-w-0 font-medium break-words hover:text-accent-text"
                    >
                      {candidate.title}
                    </Link>
                  ) : (
                    <span className="text-ink-2 italic">{t("exampleHidden")}</span>
                  )}
                  {candidate.winner ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-text">
                      {t("exampleWinner")}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-[13px] whitespace-nowrap text-ink-2 max-sm:pl-5">
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
    <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-dashed border-(--dashed) bg-surface p-6">
      <Label>{t(pick ? "exampleLabel" : "exampleSampleLabel")}</Label>
      {body}
    </div>
  );
}
