import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Label } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/next-path";
import { OnboardingForm } from "./onboarding-form";
import { suggestUsername } from "./username";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OnboardingPage({ searchParams }: PageProps<"/[locale]/onboarding">) {
  const t = await getTranslations("onboarding");

  return (
    <>
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 pt-14 pb-20 sm:px-6 sm:pt-24">
        <Label className="text-xs text-accent-text">{t("eyebrow")}</Label>
        <h1 className="font-display text-[40px] leading-[1.05] font-normal tracking-[-1px] sm:text-[52px]">
          {t("titleLead")} <span className="italic">{t("titleTail")}</span>
        </h1>
        <SystemMessage>{t("intro")}</SystemMessage>
        <Suspense fallback={<div className="h-72 rounded-[22px] bg-bubble" aria-hidden="true" />}>
          <OnboardingContent searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function OnboardingContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/onboarding">["searchParams"];
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const next = safeNextPath(params.next, `/${locale}`);
  const user = await getCurrentUser();

  if (!user) {
    const here = `/${locale}/onboarding?next=${encodeURIComponent(next)}`;
    redirect(`/${locale}/login?next=${encodeURIComponent(here)}`);
  }
  if (user.username) redirect(next);

  return (
    <OnboardingForm
      next={next}
      initialUsername={suggestUsername(user.providerHandle)}
      initialDisplayName={user.displayName}
    />
  );
}
