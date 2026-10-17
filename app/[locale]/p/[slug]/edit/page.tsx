import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { FormSkeleton } from "@/components/project/form-skeleton";
import { ProjectForm } from "@/components/project/project-form";
import { SystemMessage } from "@/components/ui/bubble";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCategories, getToolCatalog, quickPickIds } from "@/lib/projects/catalog";
import { getEditableProject } from "@/lib/projects/editable";
import { rejectReasonText } from "@/lib/projects/reject-reason";

// Owner-only and per request: there is no static shell worth prerendering for unknown slugs
// (the header's usePathname() would block it), so navigations here may block.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projectForm");
  return { title: t("metaEdit"), robots: { index: false } };
}

export default async function EditProjectPage({ params }: PageProps<"/[locale]/p/[slug]/edit">) {
  const t = await getTranslations("projectForm");

  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-14 sm:px-6">
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-1px] sm:text-[60px] sm:tracking-[-1.4px]">
          {t("editTitleLead")} <span className="italic">{t("editTitleTail")}</span>
        </h1>
        <Suspense fallback={<FormSkeleton />}>
          <EditContent params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function EditContent({ params }: { params: PageProps<"/[locale]/p/[slug]/edit">["params"] }) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("projectForm");
  const user = await getCurrentUser();
  const here = `/${locale}/p/${slug}/edit`;

  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(here)}`);
  if (!user.username) redirect(`/${locale}/onboarding?next=${encodeURIComponent(here)}`);

  // Only the owner gets the form; anyone else sees the same 404 as for a missing project.
  const project = await getEditableProject(slug, user.id);
  if (!project) notFound();

  const [tools, categories] = await Promise.all([getToolCatalog(), getCategories()]);

  const rejectReason =
    project.status === "rejected"
      ? await rejectReasonText(project.rejectCode, project.rejectReason)
      : null;
  const statusNotice =
    project.status === "pending"
      ? t("status.pending")
      : project.status === "rejected"
        ? rejectReason
          ? t("status.rejected", { reason: rejectReason })
          : t("status.rejectedNoReason")
        : project.status === "hidden"
          ? t("status.hidden")
          : null;

  return (
    <>
      <p className="mt-3 max-w-[760px] text-[17px] leading-relaxed text-ink-2">{t("editLede")}</p>
      {statusNotice ? (
        <SystemMessage tone="soft" className="mt-6 max-w-[760px]">
          {statusNotice}
        </SystemMessage>
      ) : null}
      <ProjectForm
        mode={{ kind: "edit", projectId: project.id, slug: project.slug }}
        maker={{ name: user.displayName || user.username, avatarUrl: user.avatarUrl }}
        tools={tools}
        quickPickIds={quickPickIds(tools)}
        categories={categories}
        initialProject={project.project}
        initialMedia={project.media}
      />
    </>
  );
}
