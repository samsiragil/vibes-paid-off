import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { cn } from "@/lib/cn";
import { getAdminCounts, type AdminCounts } from "@/lib/admin/data";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/current-user";
import { ReportsPanel } from "./reports";
import { ReviewQueuePanel } from "./review-queue";
import { ToolsPanel } from "./tools";
import { WeeklyPicksPanel } from "./weekly-picks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("metaTitle"), robots: { index: false } };
}

const tabs = ["queue", "reports", "tools", "picks"] as const;
type AdminTab = (typeof tabs)[number];

// /admin (VPO-Admin): review queue, reports, tools catalog and the read-only weekly pick history.
// Only admins (is_admin(), checked on the server); everyone else gets the same 404 as any
// unknown page. The tab lives in ?tab= so each one is a plain link and loads only its own data.
export default function AdminPage({ searchParams }: PageProps<"/[locale]/admin">) {
  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-24 sm:px-6 lg:pt-10">
        <Suspense fallback={<AdminSkeleton />}>
          <AdminContent searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function AdminContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/admin">["searchParams"];
}) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (!(await isCurrentUserAdmin())) notFound();

  const { tab: rawTab } = await searchParams;
  const tab: AdminTab = tabs.includes(rawTab as AdminTab) ? (rawTab as AdminTab) : "queue";
  const counts = await getAdminCounts();

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <AdminNav active={tab} counts={counts} />
      <section className="flex min-w-0 grow flex-col gap-[18px]">
        {tab === "queue" ? <ReviewQueuePanel /> : null}
        {tab === "reports" ? <ReportsPanel /> : null}
        {tab === "tools" ? <ToolsPanel /> : null}
        {tab === "picks" ? <WeeklyPicksPanel /> : null}
      </section>
    </div>
  );
}

async function AdminNav({ active, counts }: { active: AdminTab; counts: AdminCounts }) {
  const t = await getTranslations("admin.nav");
  const count: Partial<Record<AdminTab, number>> = {
    queue: counts.queue,
    reports: counts.reports,
    tools: counts.suggestions,
  };

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:w-[220px] lg:shrink-0">
      <span className="inline-flex h-[26px] items-center self-start rounded-full bg-ink px-2.5 font-mono text-[11px] text-bg">
        ADMIN
      </span>
      <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-1 lg:flex-col">
          {tabs.map((tab) => (
            <li key={tab} className="shrink-0">
              <Link
                href={tab === "queue" ? "/admin" : `/admin?tab=${tab}`}
                aria-current={active === tab ? "page" : undefined}
                className={cn(
                  "flex h-[46px] items-center justify-between gap-3 rounded-full px-3.5 text-sm whitespace-nowrap transition-colors",
                  active === tab ? "bg-ink text-bg" : "text-ink hover:bg-bubble",
                )}
              >
                <span>{t(tab)}</span>
                {count[tab] !== undefined ? (
                  <span className="font-mono text-xs">
                    {count[tab]}
                    <span className="sr-only"> {t(`countLabel.${tab}`)}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      <div className="flex gap-1 lg:w-[220px] lg:flex-col">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-[46px] w-32 rounded-full bg-bubble lg:w-full" />
        ))}
      </div>
      <div className="flex grow flex-col gap-[18px]">
        <div className="h-12 w-72 max-w-full rounded-2xl bg-bubble" />
        <div className="h-5 w-96 max-w-full rounded bg-bubble" />
        {[0, 1].map((index) => (
          <div key={index} className="h-40 rounded-[22px] bg-bubble" />
        ))}
      </div>
    </div>
  );
}
