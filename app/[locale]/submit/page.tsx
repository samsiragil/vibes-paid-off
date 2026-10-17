import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { FormSkeleton } from "@/components/project/form-skeleton";
import { ProjectForm } from "@/components/project/project-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCategories, getToolCatalog, quickPickIds } from "@/lib/projects/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projectForm");
  return { title: t("metaSubmit"), robots: { index: false } };
}

export default async function SubmitPage() {
  const t = await getTranslations("projectForm");

  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-14 sm:px-6">
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-1px] sm:text-[60px] sm:tracking-[-1.4px]">
          {t("submitTitleLead")} <span className="italic">{t("submitTitleTail")}</span>
        </h1>
        <Suspense fallback={<FormSkeleton />}>
          <SubmitContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function SubmitContent() {
  const locale = await getLocale();
  const t = await getTranslations("projectForm");
  const user = await getCurrentUser();
  const here = `/${locale}/submit`;

  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(here)}`);
  if (!user.username) redirect(`/${locale}/onboarding?next=${encodeURIComponent(here)}`);

  const [tools, categories] = await Promise.all([getToolCatalog(), getCategories()]);

  return (
    <>
      <p className="mt-3 max-w-[760px] text-[17px] leading-relaxed text-ink-2">
        {user.isTrusted ? t("submitLedeTrusted") : t("submitLede")}
      </p>
      <ProjectForm
        mode={{ kind: "create", isTrusted: user.isTrusted }}
        maker={{ name: user.displayName || user.username, avatarUrl: user.avatarUrl }}
        tools={tools}
        quickPickIds={quickPickIds(tools)}
        categories={categories}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
      />
    </>
  );
}
