import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import {
  ProjectReplies,
  ProjectReportLink,
  ProjectWorthIt,
} from "@/components/interactions/project-interactions";
import { ProjectDetailView } from "@/components/project/project-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { PageTransition, Reveal } from "@/components/ui/transitions";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/current-user";
import {
  getOwnProject,
  getProjectForAdmin,
  getPublishedProject,
  type ProjectDetail,
} from "@/lib/projects/detail";
import { mediaUrl } from "@/lib/media/url";
import { rejectReasonText } from "@/lib/projects/reject-reason";
import { localeAlternates, localeUrl, ogLocale } from "@/lib/seo";

// Slugs are open-ended, so there is no static shell to validate; the public data itself is
// cached ("use cache" in getPublishedProject) and the owner-only parts stream in per request.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) {
    const t = await getTranslations("project");
    return { title: t("metaFallbackTitle"), robots: { index: false } };
  }

  const title = `${project.title} · ${project.maker.displayName}`;
  const [locale, tMeta] = await Promise.all([getLocale(), getTranslations("meta")]);
  return {
    title: project.title,
    description: project.tagline,
    alternates: localeAlternates(locale, `/p/${project.slug}`),
    openGraph: {
      type: "article",
      title,
      description: project.tagline,
      siteName: tMeta("title"),
      locale: ogLocale(locale),
      publishedTime: project.publishedAt ?? undefined,
    },
    twitter: { card: "summary_large_image", title, description: project.tagline },
  };
}

export default function ProjectPage({ params }: PageProps<"/[locale]/p/[slug]">) {
  return (
    <PageTransition>
      <Reveal fallback={<ProjectSkeleton />}>
        <ProjectContent params={params} />
      </Reveal>
      <SiteFooter />
    </PageTransition>
  );
}

async function ProjectContent({ params }: { params: PageProps<"/[locale]/p/[slug]">["params"] }) {
  const { slug } = await params;

  const project = await getPublishedProject(slug);
  if (project) {
    return (
      <>
        <ProjectJsonLd project={project} />
        <ProjectDetailView
          project={project}
          ownerActions={
            <Suspense fallback={null}>
              <OwnerEditLink project={project} />
            </Suspense>
          }
          worthIt={<ProjectWorthIt project={project} />}
          replies={<ProjectReplies project={project} />}
          reportLink={<ProjectReportLink project={project} />}
        />
      </>
    );
  }

  // Not public: only its owner may see it (pending review, rejected, hidden after reports),
  // and admins checking the review queue or a report.
  const user = await getCurrentUser();
  const own = user ? await getOwnProject(slug, user.id) : null;
  if (own) {
    return (
      <ProjectDetailView
        project={own}
        ownerNotice={<OwnerNotice project={own} />}
        ownerActions={<EditLink slug={own.slug} />}
      />
    );
  }

  const preview = user && (await isCurrentUserAdmin()) ? await getProjectForAdmin(slug) : null;
  if (!preview) notFound();
  return <ProjectDetailView project={preview} ownerNotice={<AdminNotice project={preview} />} />;
}

/** schema.org CreativeWork for a published project (§2.5 SEO). */
async function ProjectJsonLd({ project }: { project: ProjectDetail }) {
  const [locale, tCategories] = await Promise.all([getLocale(), getTranslations("categories")]);
  const url = localeUrl(locale, `/p/${project.slug}`);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": url,
        url,
        name: project.title,
        alternativeHeadline: project.tagline,
        description: project.description || project.tagline,
        abstract: project.keyPrompt,
        inLanguage: project.contentLang,
        genre: tCategories(project.category),
        keywords: project.tools.map((tool) => tool.name).join(", "),
        image: project.media.map((image) => mediaUrl(image.key)),
        datePublished: project.publishedAt ?? undefined,
        sameAs: project.liveUrl,
        author: {
          "@type": "Person",
          name: project.maker.displayName,
          alternateName: `@${project.maker.username}`,
          url: localeUrl(locale, `/u/${project.maker.username}`),
        },
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: project.upvoteCount,
        },
      }}
    />
  );
}

async function OwnerEditLink({ project }: { project: ProjectDetail }) {
  const user = await getCurrentUser();
  return user?.id === project.maker.id ? <EditLink slug={project.slug} /> : null;
}

async function EditLink({ slug }: { slug: string }) {
  const t = await getTranslations("project");
  return (
    <Link href={`/p/${slug}/edit`} className={buttonStyles({ variant: "outline", size: "lg" })}>
      {t("edit")}
    </Link>
  );
}

async function OwnerNotice({ project }: { project: ProjectDetail }) {
  const t = await getTranslations("project.ownerStatus");
  const rejectReason =
    project.status === "rejected"
      ? await rejectReasonText(project.rejectCode, project.rejectReason)
      : null;
  const message =
    project.status === "pending"
      ? t("pending")
      : project.status === "rejected"
        ? rejectReason
          ? t("rejected", { reason: rejectReason })
          : t("rejectedNoReason")
        : t("hidden");

  return (
    <SystemMessage tone="soft">
      <span className="font-semibold">{t("onlyYou")}</span> {message}
    </SystemMessage>
  );
}

async function AdminNotice({ project }: { project: ProjectDetail }) {
  const t = await getTranslations("project.adminPreview");
  const tStatus = await getTranslations("me.status");
  const reason =
    project.status === "rejected"
      ? await rejectReasonText(project.rejectCode, project.rejectReason)
      : null;
  const tab = project.status === "pending" ? "" : "?tab=reports";

  return (
    <SystemMessage tone="soft">
      <span className="font-semibold">{t("title")}</span>{" "}
      {t("status", { status: tStatus(project.status) })}
      {reason ? ` ${t("reason", { reason })}` : null}{" "}
      <Link href={`/admin${tab}`} className="text-accent-text underline underline-offset-3">
        {t("back")}
      </Link>
    </SystemMessage>
  );
}

function ProjectSkeleton() {
  // Empty ruled lines the size of the content (README §7).
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-[1120px] px-4 pt-6 sm:px-6">
      <div className="h-5 w-48 rounded-sm bg-placeholder" />
      <div className="mt-10 h-10 w-3/4 max-w-xl rounded-sm bg-placeholder" />
      <div className="mt-4 h-6 w-1/2 max-w-md rounded-sm bg-placeholder" />
      <div className="mt-12 flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="flex grow flex-col gap-6">
          <div className="relative h-32 ruled">
            <span className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-14" />
          </div>
          <div className="aspect-[16/10] rounded border border-border bg-surface sm:ml-[72px]" />
        </div>
        <div className="h-72 rounded border border-border bg-surface lg:w-[300px]" />
      </div>
    </main>
  );
}
