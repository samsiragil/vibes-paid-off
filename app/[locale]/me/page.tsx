import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button, buttonStyles } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/current-user";
import { getMyProfileForm, getMyProjects } from "@/lib/profiles/me";
import { displayUrl } from "@/lib/site";
import { MeTabs, type MeTab } from "./me-tabs";
import { MyProjects, OfflineNotice, ReviewNotice } from "./my-projects";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("me");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Per-user dashboard (VPO-Me): everything below the heading depends on the session.
export default function MePage({ searchParams }: PageProps<"/[locale]/me">) {
  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6">
        <Suspense fallback={<MeSkeleton />}>
          <MeContent searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function MeContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/me">["searchParams"];
}) {
  const locale = await getLocale();
  const t = await getTranslations("me");
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me`)}`);
  if (!user.username) redirect(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/me`)}`);

  const [projects, profileValues, { tab }, isAdmin] = await Promise.all([
    getMyProjects(user.id),
    getMyProfileForm(user.id),
    searchParams,
    isCurrentUserAdmin(),
  ]);
  const initialTab: MeTab = tab === "profile" ? "profile" : "projects";
  const name = user.displayName || user.username;
  const offline = projects.filter(
    (project) => project.status === "published" && project.linkStatus === "offline",
  );
  // Review outcomes (Q10: shown here until notification emails are set up): every rejected
  // project, and approvals from the last week.
  const reviewed = projects.filter(
    (project) => project.status === "rejected" || project.recentlyApproved,
  );
  const notices = [...reviewed, ...offline];

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">/me</p>
          <h1 className="mt-1.5 font-display text-[44px] leading-none font-normal tracking-[-1px] break-words sm:text-[56px] sm:tracking-[-1.2px]">
            {t("hello")} <span className="italic">{name}.</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <Link href="/admin" className={buttonStyles({ variant: "primary" })}>
              {t("adminLink")}
            </Link>
          ) : null}
          <Link href={`/u/${user.username}`} className={buttonStyles({ variant: "outline" })}>
            {t("viewProfile")} <span aria-hidden="true">↗</span>
          </Link>
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="ghost">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </div>

      {notices.length > 0 ? (
        <div className="mt-7 flex max-w-[760px] flex-col gap-3">
          {reviewed.map((project) => (
            <ReviewNotice key={project.id} project={project} />
          ))}
          {offline.map((project) => (
            <OfflineNotice key={project.id} project={project} />
          ))}
        </div>
      ) : null}

      <MeTabs
        initialTab={initialTab}
        label={t("tabs.label")}
        tabLabels={{
          projects: t("tabs.projects", { count: projects.length }),
          profile: t("tabs.profile"),
        }}
        panels={{
          projects: <MyProjects projects={projects} isTrusted={user.isTrusted} />,
          profile: profileValues ? (
            <ProfileForm initialValues={profileValues} profileHost={displayUrl("/u/")} />
          ) : null,
        }}
      />
    </>
  );
}

function MeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-3 w-10 rounded bg-bubble" />
      <div className="mt-3 h-14 w-80 max-w-full rounded-2xl bg-bubble" />
      <div className="mt-12 h-[46px] border-b border-border" />
      <div className="mt-6 flex flex-col gap-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-[84px] rounded-2xl bg-bubble" />
        ))}
      </div>
    </div>
  );
}
