import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { Label } from "@/components/ui/badge";
import { pillStyles } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { getToolCatalog } from "@/lib/projects/catalog";
import { TOOL_KINDS } from "@/lib/projects/types";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(await getLocale(), "/tools"),
  };
}

// "Per tools": the whole catalog grouped by kind (§2.8). Every tool has a page, including the
// ones without projects yet (shown muted). Cached with the catalog (tag "tools").
export default async function ToolsIndexPage() {
  const [t, tKinds, catalog] = await Promise.all([
    getTranslations("tools"),
    getTranslations("toolKinds"),
    getToolCatalog(),
  ]);

  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6 sm:pt-14">
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-1px] sm:text-[56px] sm:tracking-[-1.2px]">
          {t("titleLead")} <span className="italic">{t("titleTail")}</span>
        </h1>
        <p className="mt-4 max-w-[620px] text-[17px] leading-relaxed text-ink-2">{t("lede")}</p>

        <div className="mt-10 flex flex-col border-t border-border">
          {TOOL_KINDS.map((kind) => {
            const tools = catalog
              .filter((tool) => tool.kind === kind)
              .sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name));
            if (tools.length === 0) return null;
            return (
              <section
                key={kind}
                aria-labelledby={`kind-${kind}`}
                className="flex flex-col gap-4 border-b border-border py-8 md:flex-row md:gap-10"
              >
                <h2 id={`kind-${kind}`} className="md:w-[220px] md:shrink-0 md:pt-3">
                  <Label className="text-xs">{tKinds(kind)}</Label>
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {tools.map((tool) => (
                    <li key={tool.id}>
                      <Link
                        href={`/tools/${tool.slug}`}
                        className={pillStyles({
                          className: cn(
                            "h-11 px-4 text-sm",
                            tool.projectCount === 0 && "text-ink-2",
                          ),
                        })}
                      >
                        {tool.name}
                        <span aria-hidden="true" className="font-mono text-xs text-muted">
                          {tool.projectCount}
                        </span>
                        <span className="sr-only">
                          , {t("projectCount", { count: tool.projectCount })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
