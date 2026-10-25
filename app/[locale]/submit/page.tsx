import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { FormSkeleton } from "@/components/project/form-skeleton";
import { ProjectForm } from "@/components/project/project-form";
import { PageTransition, Reveal } from "@/components/ui/transitions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCategories, getToolCatalog, quickPickIds } from "@/lib/projects/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projectForm");
  return { title: t("metaSubmit"), robots: { index: false } };
}

export default async function SubmitPage() {
  const t = await getTranslations("projectForm");

  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-12">
        <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
          {t("submitTitleLead")} {t("submitTitleTail")}
        </h1>
        <Reveal fallback={<FormSkeleton />}>
          <SubmitContent />
        </Reveal>
      </main>
      <SiteFooter />
    </PageTransition>
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
      <p className="mt-3 max-w-[68ch] text-[17px] leading-7 text-ink-2">
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
