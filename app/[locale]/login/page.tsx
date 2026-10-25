import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Label } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { SiteFooter } from "@/components/layout/site-footer";
import { signInWithProvider } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/next-path";
import { ProviderButton } from "./provider-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaTitle"), robots: { index: false } };
}

const errorKeys = ["oauth", "callback", "provider"] as const;

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("auth");

  return (
    <>
      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pt-12 pb-20 sm:px-6 sm:pt-20">
        <Label>{t("eyebrow")}</Label>
        <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
          {t("titleLead")} {t("titleTail")}
        </h1>
        <SystemMessage>{t("intro")}</SystemMessage>
        {/* The fallback is the same form without ?next, so the buttons are usable before the request resolves. */}
        <Suspense fallback={<LoginOptions />}>
          <LoginOptionsForRequest searchParams={searchParams} />
        </Suspense>
        <p className="text-sm leading-5 text-muted">{t("note")}</p>
      </main>
      <SiteFooter />
    </>
  );
}

async function LoginOptionsForRequest({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/login">["searchParams"];
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const next = safeNextPath(params.next, `/${locale}`);

  // Already signed in: nothing to do here.
  if (await getCurrentUser()) redirect(next);

  const error = errorKeys.find((key) => key === params.error);
  return <LoginOptions next={next} error={error} />;
}

async function LoginOptions({
  next,
  error,
}: {
  next?: string;
  error?: (typeof errorKeys)[number];
}) {
  const t = await getTranslations("auth");
  const locale = await getLocale();

  return (
    <form action={signInWithProvider} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? `/${locale}`} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}
        </p>
      ) : null}
      <ProviderButton provider="github" label={t("github")} />
      <ProviderButton provider="google" label={t("google")} />
    </form>
  );
}
