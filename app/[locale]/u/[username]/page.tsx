import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectGridCard } from "@/components/project/project-grid-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Label } from "@/components/ui/badge";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { CopyLinkField } from "@/components/ui/copy-link";
import { ExternalLink } from "@/components/ui/external-link";
import { getPublicProfile, PROFILE_LINK_KEYS, type PublicProfile } from "@/lib/profiles/public";
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
    <>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent params={params} />
      </Suspense>
      <SiteFooter />
    </>
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
  const [firstName, ...restNames] = profile.displayName.split(" ");
  const meta = [
    `@${profile.username}`,
    profile.location,
    t("makerSince", {
      date: format.dateTime(new Date(profile.createdAt), { month: "long", year: "numeric" }),
    }),
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6 sm:pt-16">
      <ProfileJsonLd profile={profile} />
      <section className="flex flex-col gap-10 border-b border-border pb-11 lg:flex-row lg:items-start lg:gap-14">
        <div className="flex min-w-0 grow flex-col gap-[22px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-[18px]">
            <Avatar name={profile.displayName} src={profile.avatarUrl} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-[44px] leading-[0.98] font-normal tracking-[-1px] break-words sm:text-[64px] sm:tracking-[-1.8px]">
                {firstName}
                {restNames.length > 0 ? (
                  <span className="italic"> {restNames.join(" ")}</span>
                ) : null}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[13px] text-muted">
                <span>{meta.join(" · ")}</span>
                {profile.isTrusted ? <Badge>{t("trusted")}</Badge> : null}
              </div>
            </div>
          </div>

          {profile.bio ? (
            <div className="flex max-w-[720px] items-end gap-3">
              <Avatar
                name={profile.displayName}
                src={profile.avatarUrl}
                className="size-9 text-xs"
              />
              <p className="min-w-0 rounded-[22px] rounded-bl-md border border-border bg-surface px-[22px] py-[18px] text-lg leading-[1.55] break-words whitespace-pre-line">
                {profile.bio}
              </p>
            </div>
          ) : null}

          <SocialLinks profile={profile} />
        </div>

        <div className="flex flex-col gap-3 lg:w-[340px] lg:shrink-0 lg:pt-2">
          <Label>{t("shareLabel")}</Label>
          <CopyLinkField
            url={`${siteUrl}${path}`}
            display={displayUrl(path)}
            label={t("shareLabel")}
          />
          {profile.tipUrl ? (
            <ExternalLink
              href={profile.tipUrl}
              className={buttonStyles({ variant: "outline-accent", size: "lg", className: "h-12" })}
            >
              {t("tip", { name: firstName })}
            </ExternalLink>
          ) : null}
        </div>
      </section>

      <dl className="grid grid-cols-2 border-b border-border md:grid-cols-4">
        <Stat label={t("stats.projects")}>{format.number(profile.stats.projectCount)}</Stat>
        <Stat label={t("stats.stories")}>{format.number(profile.stats.storyCount)}</Stat>
        <Stat label={t("stats.upvotes")}>{format.number(profile.stats.upvoteCount)}</Stat>
        <Stat label={t("stats.topTool")} small>
          {profile.stats.topTool ?? "—"}
        </Stat>
      </dl>

      <section className="flex flex-col gap-6 pt-14">
        <h2 className="font-display text-[30px] leading-tight font-normal tracking-[-0.6px] sm:text-[38px]">
          {t("projectsLead", { name: firstName })}{" "}
          <span className="italic">{t("projectsTail")}</span>
        </h2>
        {profile.projects.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profile.projects.map((project) => (
              <ProjectGridCard key={project.id} project={project} showMaker={false} />
            ))}
          </div>
        ) : (
          <SystemMessage className="max-w-xl">{t("empty", { name: firstName })}</SystemMessage>
        )}
      </section>
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
    <ul className="flex flex-wrap gap-2 sm:pl-12">
      {links.map((link) => (
        <li key={link.key}>
          <ExternalLink
            href={link.url}
            rel="me"
            className="inline-flex h-11 items-center rounded-full border border-border-strong bg-surface px-4 text-sm transition-colors hover:border-ink"
          >
            {t(link.key)}
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  small = false,
  children,
}: {
  label: string;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col-reverse justify-end py-6 pr-4">
      <dt className="font-mono text-xs text-muted uppercase">{label}</dt>
      <dd
        className={
          small
            ? "font-display text-[22px] leading-[1.45] break-words sm:text-[28px]"
            : "font-display text-[34px] leading-tight sm:text-[40px]"
        }
      >
        {children}
      </dd>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-[1200px] px-4 pt-12 sm:px-6 sm:pt-16">
      <div className="flex items-center gap-[18px]">
        <div className="size-[84px] rounded-full bg-bubble" />
        <div className="h-14 w-72 max-w-[60%] rounded-2xl bg-bubble" />
      </div>
      <div className="mt-6 h-24 max-w-[720px] rounded-[22px] bg-bubble" />
      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-80 rounded-[22px] bg-bubble" />
        ))}
      </div>
    </main>
  );
}
