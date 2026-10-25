import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { FormSkeleton } from "@/components/project/form-skeleton";
import { ProjectForm } from "@/components/project/project-form";
import { SystemMessage } from "@/components/ui/bubble";
import { PageTransition, Reveal } from "@/components/ui/transitions";
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
    <PageTransition>
      {/* group/page: the form marks itself data-compact past step 1, and the title shrinks. */}
      <main className="group/page mx-auto w-full max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-12">
        <h1 className="text-[30px] leading-9 font-bold break-words transition-[font-size,line-height] group-has-[[data-compact]]/page:text-xl group-has-[[data-compact]]/page:leading-7 motion-reduce:transition-none sm:text-[40px] sm:leading-11">
          {t("editTitleLead")} {t("editTitleTail")}
        </h1>
        <Reveal fallback={<FormSkeleton />}>
          <EditContent params={params} />
        </Reveal>
      </main>
      <SiteFooter />
    </PageTransition>
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
      <p className="mt-3 max-w-[68ch] text-[17px] leading-7 text-ink-2 group-has-[[data-compact]]/page:hidden">
        {t("editLede")}
      </p>
      {statusNotice ? (
        <SystemMessage tone="soft" className="mt-6 max-w-[760px]">
          {statusNotice}
        </SystemMessage>
      ) : null}
      <ProjectForm
        mode={{
          kind: "edit",
          projectId: project.id,
          slug: project.slug,
          legacySessionCount: project.legacySessionCount,
        }}
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
