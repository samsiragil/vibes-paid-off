import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { SystemMessage } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("me");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Placeholder until the full dashboard (VPO-Me) lands in Fase 5: shows who is signed in and a sign-out button.
export default function MePage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 pt-14 pb-20 sm:px-6 sm:pt-20">
        <Suspense fallback={<div className="h-40 rounded-[22px] bg-bubble" aria-hidden="true" />}>
          <MeContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function MeContent() {
  const locale = await getLocale();
  const t = await getTranslations("me");
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me`)}`);
  if (!user.username) redirect(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/me`)}`);

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={user.displayName || user.username} src={user.avatarUrl} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[36px] leading-tight font-normal tracking-[-0.5px]">
            {t("greeting", { name: user.displayName || user.username })}
          </h1>
          <p className="font-mono text-sm text-muted">@{user.username}</p>
        </div>
      </div>
      <SystemMessage>{t("soon")}</SystemMessage>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="outline">
          {t("signOut")}
        </Button>
      </form>
    </>
  );
}
