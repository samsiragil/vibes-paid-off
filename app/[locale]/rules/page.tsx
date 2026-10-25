import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SystemMessage } from "@/components/ui/bubble";
import { PageTransition } from "@/components/ui/transitions";
import { cn } from "@/lib/cn";
import { localeAlternates } from "@/lib/seo";
import { PICKING_ANCHOR } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("communityRules");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(await getLocale(), "/rules"),
  };
}

/** Bump when the rules change; shown as "Terakhir diperbarui". */
const UPDATED_AT = new Date("2026-10-17T00:00:00+07:00");

const sections = [
  { key: "share", items: ["own", "ai", "honest", "live"] },
  { key: "forbidden", items: ["illegal", "spam", "privacy", "harassment", "impersonation"] },
  { key: "replies", items: ["respect", "useful", "promo"] },
  { key: "moderation", items: ["review", "rejected", "reports", "actions", "ranking"] },
] as const;

// Aturan komunitas (no design; G6): the same voice as the rest of the site. The short version
// shown on /submit (projectForm.rules) links here.
export default async function RulesPage() {
  const [t, format] = await Promise.all([getTranslations("communityRules"), getFormatter()]);

  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-12">
        <div className="flex max-w-[820px] flex-col gap-5">
          <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
            {t("titleLead")} {t("titleTail")}
          </h1>
          <SystemMessage>{t("intro")}</SystemMessage>
          <p className="text-sm text-muted">
            {t("updated", {
              date: format.dateTime(UPDATED_AT, { day: "numeric", month: "long", year: "numeric" }),
            })}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.key}
              aria-labelledby={`rules-${section.key}`}
              className={cn(
                "flex flex-col gap-3 rounded border bg-surface p-5 sm:p-6",
                section.key === "forbidden" ? "border-border-strong" : "border-border",
              )}
            >
              <h2 id={`rules-${section.key}`} className="text-lg leading-6 font-semibold">
                {t(`${section.key}.title`)}
              </h2>
              <ol className="flex flex-col">
                {section.items.map((item, index) => (
                  <li
                    key={item}
                    className="flex gap-3 border-t border-border py-3 text-base leading-6 first:border-t-0 first:pt-0"
                  >
                    <span aria-hidden="true" className="text-sm leading-6 text-muted tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      {t.rich(`${section.key}.${item}`, {
                        link: (chunks) => (
                          <Link
                            href={`/support#${PICKING_ANCHOR}`}
                            className="font-semibold text-accent-text underline underline-offset-3"
                          >
                            {chunks}
                          </Link>
                        ),
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <p className="mt-8 max-w-[68ch] text-base leading-6 text-ink-2">{t("closing")}</p>
      </main>
      <SiteFooter />
    </PageTransition>
  );
}
