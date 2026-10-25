import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Label } from "@/components/ui/badge";
import { PromptBubble, SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { CopyLinkField } from "@/components/ui/copy-link";
import { ExternalLink } from "@/components/ui/external-link";
import { SocialIcon } from "@/components/ui/social-icon";
import { PageTransition, Reveal } from "@/components/ui/transitions";
import { getPublicProfile, type PublicProfile } from "@/lib/profiles/public";
import { PROFILE_LINK_KEYS } from "@/lib/profiles/social";
import { localeAlternates, localeUrl, ogLocale } from "@/lib/seo";
import { displayUrl, siteUrl } from "@/lib/site";

// Usernames are open-ended: no static shell; the profile data is cached (getPublicProfile).
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  const t = await getTranslations("profile");
  if (!profile) return { title: t("metaFallbackTitle"), robots: { index: false } };

  const title = `${profile.displayName} (@${profile.username})`;
  const description =
    profile.bio ||
    t("metaDescription", { name: profile.displayName, count: profile.stats.projectCount });
  const [locale, tMeta] = await Promise.all([getLocale(), getTranslations("meta")]);
  return {
    title,
    description,
    alternates: localeAlternates(locale, `/u/${profile.username}`),
    openGraph: {
      type: "profile",
      title,
      description,
      username: profile.username,
      siteName: tMeta("title"),
      locale: ogLocale(locale),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ProfilePage({ params }: PageProps<"/[locale]/u/[username]">) {
  return (
    <PageTransition>
      <Reveal fallback={<ProfileSkeleton />}>
        <ProfileContent params={params} />
      </Reveal>
      <SiteFooter />
    </PageTransition>
  );
}

async function ProfileContent({
  params,
}: {
  params: PageProps<"/[locale]/u/[username]">["params"];
}) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const t = await getTranslations("profile");
  const format = await getFormatter();
  const path = `/u/${profile.username}`;
  const [firstName] = profile.displayName.split(" ");
  const meta = [
    `@${profile.username}`,
    profile.location,
    t("makerSince", {
      date: format.dateTime(new Date(profile.createdAt), { month: "long", year: "numeric" }),
    }),
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-14">
      <ProfileJsonLd profile={profile} />
      <section className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
        <div className="flex min-w-0 grow flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <Avatar name={profile.displayName} src={profile.avatarUrl} size="lg" />
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-[30px] leading-9 font-bold break-words sm:text-[40px] sm:leading-11">
                {profile.displayName}
              </h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-5 text-muted">
                <span>{meta.join(" · ")}</span>
                {profile.isTrusted ? <Badge>{t("trusted")}</Badge> : null}
              </p>
            </div>
          </div>

          {profile.bio ? (
            <PromptBubble size="lg" className="max-w-[720px] break-words whitespace-pre-line">
              {profile.bio}
            </PromptBubble>
          ) : null}

          <SocialLinks profile={profile} />
        </div>

        <div className="flex flex-col gap-3 lg:w-[320px] lg:shrink-0 lg:pt-2">
          {profile.tipUrl ? (
            <ExternalLink
              href={profile.tipUrl}
              className={buttonStyles({ variant: "outline-accent", size: "lg" })}
            >
              {t("tip", { name: firstName })}
            </ExternalLink>
          ) : null}
          <Label className="pt-2">{t("shareLabel")}</Label>
          <CopyLinkField
            url={`${siteUrl}${path}`}
            display={displayUrl(path)}
            label={t("shareLabel")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-6 pt-14">
        <h2 className="text-[22px] leading-7 font-semibold sm:text-[26px] sm:leading-8">
          {t("projects", { name: firstName })}
        </h2>
        {profile.projects.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {profile.projects.map((project) => (
              <ProjectGridCard key={project.id} project={project} showMaker={false} />
            ))}
          </div>
        ) : (
          <SystemMessage className="max-w-xl">{t("empty", { name: firstName })}</SystemMessage>
        )}
      </section>

      <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
        <Stat label={t("stats.projects")}>{format.number(profile.stats.projectCount)}</Stat>
        <Stat label={t("stats.stories")}>{format.number(profile.stats.storyCount)}</Stat>
        <Stat label={t("stats.upvotes")}>{format.number(profile.stats.upvoteCount)}</Stat>
        <Stat label={t("stats.topTool")}>{profile.stats.topTool ?? "—"}</Stat>
      </dl>
    </main>
  );
}

/** schema.org ProfilePage about the maker as a Person (§2.5 SEO). */
async function ProfileJsonLd({ profile }: { profile: PublicProfile }) {
  const locale = await getLocale();
  const url = localeUrl(locale, `/u/${profile.username}`);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url,
        dateCreated: profile.createdAt,
        mainEntity: {
          "@type": "Person",
          "@id": url,
          name: profile.displayName,
          alternateName: `@${profile.username}`,
          description: profile.bio ?? undefined,
          image: profile.avatarUrl ?? undefined,
          homeLocation: profile.location ? { "@type": "Place", name: profile.location } : undefined,
          sameAs: PROFILE_LINK_KEYS.flatMap((key) => profile.links[key] ?? []),
          interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/WriteAction",
            userInteractionCount: profile.stats.projectCount,
          },
        },
      }}
    />
  );
}

async function SocialLinks({ profile }: { profile: PublicProfile }) {
  const t = await getTranslations("profile.links");
  const links = PROFILE_LINK_KEYS.flatMap((key) => {
    const url = profile.links[key];
    return url ? [{ key, url }] : [];
  });
  if (links.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {links.map((link) => (
        <li key={link.key}>
          <ExternalLink
            href={link.url}
            rel="me"
            className="group inline-flex min-h-11 items-center gap-2 text-base font-semibold text-accent-text"
          >
            <SocialIcon name={link.key} />
            <span className="underline underline-offset-3 group-hover:decoration-2">
              {t(link.key)}
            </span>
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}

/** One figure in the small stats row under the list (secondary to the projects themselves). */
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[13px] leading-4 font-semibold text-muted">{label}</dt>
      <dd className="text-lg leading-7 font-semibold break-words tabular-nums">{children}</dd>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="flex items-center gap-5">
        <div className="size-[84px] rounded-full bg-placeholder" />
        <div className="h-10 w-72 max-w-[60%] rounded-sm bg-placeholder" />
      </div>
      <div className="relative mt-6 h-24 max-w-[720px] ruled">
        <span className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-14" />
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-80 rounded border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
