import "server-only";
import { getTranslations } from "next-intl/server";
import { joinRejectReason } from "@/lib/projects/reject-reason";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";
import type { RejectCode } from "@/lib/validation/admin";
import { sendEmail } from "./send";

/**
 * "Proyekmu disetujui / belum bisa tayang" to the maker after a review. The maker has no saved
 * language, so the email follows the project's content language. Runs after the response
 * (`after()`), so a slow or failing mail service never blocks the admin.
 */
export async function sendReviewEmail({
  ownerId,
  slug,
  title,
  locale,
  verdict,
}: {
  ownerId: string;
  slug: string;
  title: string;
  locale: "id" | "en";
  verdict: { approved: true } | { approved: false; code: RejectCode; note: string | null };
}) {
  // The address lives in auth.users, readable only with the secret key.
  const admin = createAdminClient();
  const [{ data: user, error }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(ownerId),
    admin.from("profiles").select("display_name, username").eq("id", ownerId).maybeSingle(),
  ]);
  const to = user?.user?.email;
  if (error || !to) {
    console.error("review email: no address for the maker", error);
    return;
  }

  const t = await getTranslations({ locale, namespace: "emails.review" });
  const tCodes = await getTranslations({ locale, namespace: "moderation.rejectCodes" });
  const name = profile?.display_name || profile?.username || "";
  const projectUrl = `${siteUrl}/${locale}/p/${slug}`;
  const meUrl = `${siteUrl}/${locale}/me`;

  const body = verdict.approved
    ? t("approved.body", { name, title, url: projectUrl })
    : t("rejected.body", {
        name,
        title,
        reason:
          joinRejectReason(
            verdict.code === "other" && verdict.note ? null : tCodes(verdict.code),
            verdict.note,
          ) ?? tCodes(verdict.code),
        url: `${siteUrl}/${locale}/p/${slug}/edit`,
      });

  await sendEmail({
    to,
    subject: t(verdict.approved ? "approved.subject" : "rejected.subject", { title }),
    text: `${body}\n\n${t("signature", { url: meUrl })}`,
  });
}
