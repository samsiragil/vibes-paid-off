import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { MonoLabel } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
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
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="flex max-w-[820px] flex-col gap-6">
          <h1 className="font-display text-[44px] leading-none font-normal tracking-[-1px] sm:text-[64px] sm:tracking-[-1.6px]">
            {t("titleLead")} <span className="italic">{t("titleTail")}</span>
          </h1>
          <SystemMessage>{t("intro")}</SystemMessage>
          <p className="font-mono text-xs text-muted">
            {t("updated", {
              date: format.dateTime(UPDATED_AT, { day: "numeric", month: "long", year: "numeric" }),
            })}
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.key}
              aria-labelledby={`rules-${section.key}`}
              className={cn(
                "flex flex-col gap-4 rounded-[22px] border p-6 sm:p-7",
                section.key === "forbidden" ? "border-ink bg-surface" : "border-border bg-surface",
              )}
            >
              <h2 id={`rules-${section.key}`}>
                <MonoLabel>{t(`${section.key}.title`)}</MonoLabel>
              </h2>
              <ol className="flex flex-col">
                {section.items.map((item, index) => (
                  <li
                    key={item}
                    className="flex gap-3 border-t border-border py-3 text-[15px] leading-relaxed first:border-t-0 first:pt-0"
                  >
                    <span aria-hidden="true" className="pt-0.5 font-mono text-xs text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      {t.rich(`${section.key}.${item}`, {
                        link: (chunks) => (
                          <Link
                            href={`/support#${PICKING_ANCHOR}`}
                            className="font-medium text-accent-text underline underline-offset-2"
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

        <p className="mt-8 text-[15px] text-ink-2">{t("closing")}</p>
      </main>
      <SiteFooter />
    </>
  );
}
