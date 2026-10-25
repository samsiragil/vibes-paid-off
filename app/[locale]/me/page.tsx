import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button, buttonStyles } from "@/components/ui/button";
import { PageTransition, Reveal } from "@/components/ui/transitions";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/current-user";
import { getMyProfileForm, getMyProjects } from "@/lib/profiles/me";
import { mediaKeyOf } from "@/lib/media/url";
import { isAvatarKeyOf } from "@/lib/r2/keys";
import { displayUrl } from "@/lib/site";
import { AvatarField } from "./avatar-field";
import { MeTabs, type MeTab } from "./me-tabs";
import { MyProjects, OfflineNotice, ReviewNotice, StoryNudge } from "./my-projects";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("me");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Per-user dashboard (VPO-Me): everything below the heading depends on the session.
export default function MePage({ searchParams }: PageProps<"/[locale]/me">) {
  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-12">
        <Reveal fallback={<MeSkeleton />}>
          <MeContent searchParams={searchParams} />
        </Reveal>
      </main>
      <SiteFooter />
    </PageTransition>
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
  // One "ceritain dong" nudge at a time: the story people are most curious about.
  const nudge = projects
    .filter((project) => project.storyNudge)
    .sort((a, b) => b.upvoteCount - a.upvoteCount)[0];
  const notices = [...reviewed, ...offline, ...(nudge ? [nudge] : [])];

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
            {t("hello")} {name}.
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
          {nudge ? <StoryNudge project={nudge} /> : null}
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
            <>
              <AvatarField
                name={name}
                initialUrl={user.avatarUrl}
                initialUploaded={isUploadedAvatar(user.id, user.avatarUrl)}
              />
              <ProfileForm initialValues={profileValues} profileHost={displayUrl("/u/")} />
            </>
          ) : null,
        }}
      />
    </>
  );
}

function MeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-10 w-80 max-w-full rounded-sm bg-placeholder" />
      <div className="mt-12 h-11 border-b border-border" />
      <div className="mt-6 flex flex-col gap-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-[84px] rounded border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}

/** Whether the photo was uploaded on /me (it can then be removed) rather than the account's. */
function isUploadedAvatar(userId: string, avatarUrl: string | null) {
  const key = avatarUrl ? mediaKeyOf(avatarUrl) : null;
  return key !== null && isAvatarKeyOf(userId, key);
}
