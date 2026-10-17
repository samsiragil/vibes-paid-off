import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectDetailView } from "@/components/project/project-detail";
import { SystemMessage } from "@/components/ui/bubble";
import { buttonStyles } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOwnProject, getPublishedProject, type ProjectDetail } from "@/lib/projects/detail";

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
  return {
    title: project.title,
    description: project.tagline,
    openGraph: { type: "article", title, description: project.tagline },
    twitter: { card: "summary_large_image", title, description: project.tagline },
  };
}

export default function ProjectPage({ params }: PageProps<"/[locale]/p/[slug]">) {
  return (
    <>
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectContent params={params} />
      </Suspense>
      <SiteFooter />
    </>
  );
}

async function ProjectContent({ params }: { params: PageProps<"/[locale]/p/[slug]">["params"] }) {
  const { slug } = await params;

  const project = await getPublishedProject(slug);
  if (project) {
    return (
      <ProjectDetailView
        project={project}
        ownerActions={
          <Suspense fallback={null}>
            <OwnerEditLink project={project} />
          </Suspense>
        }
      />
    );
  }

  // Not public: only its owner may see it (pending review, rejected, hidden after reports).
  const user = await getCurrentUser();
  const own = user ? await getOwnProject(slug, user.id) : null;
  if (!own) notFound();

  return (
    <ProjectDetailView
      project={own}
      ownerNotice={<OwnerNotice project={own} />}
      ownerActions={<EditLink slug={own.slug} />}
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
    <Link
      href={`/p/${slug}/edit`}
      className={buttonStyles({ variant: "outline", className: "h-[50px] px-[22px] text-[15px]" })}
    >
      {t("edit")}
    </Link>
  );
}

async function OwnerNotice({ project }: { project: ProjectDetail }) {
  const t = await getTranslations("project.ownerStatus");
  const message =
    project.status === "pending"
      ? t("pending")
      : project.status === "rejected"
        ? project.rejectReason
          ? t("rejected", { reason: project.rejectReason })
          : t("rejectedNoReason")
        : t("hidden");

  return (
    <SystemMessage tone="soft">
      <span className="font-medium">{t("onlyYou")}</span> {message}
    </SystemMessage>
  );
}

function ProjectSkeleton() {
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-[1200px] px-4 pt-7 sm:px-6">
      <div className="h-4 w-48 rounded bg-bubble" />
      <div className="mt-10 h-14 w-3/4 max-w-xl rounded-2xl bg-bubble" />
      <div className="mt-4 h-5 w-1/2 max-w-md rounded bg-bubble" />
      <div className="mt-12 flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="flex grow flex-col gap-5">
          <div className="h-32 w-4/5 self-end rounded-[26px] bg-bubble" />
          <div className="aspect-[16/10] rounded-[26px] bg-bubble" />
        </div>
        <div className="h-72 rounded-[22px] bg-bubble lg:w-[340px]" />
      </div>
    </main>
  );
}
