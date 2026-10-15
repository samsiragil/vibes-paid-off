"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/current-user";
import { localeOfPath, safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";
import { usernamePattern } from "./username";

export type OnboardingState = {
  error?: "invalid" | "taken" | "unknown";
  username?: string;
  displayName?: string;
};

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(usernamePattern),
  displayName: z.string().trim().max(60),
});

export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const next = safeNextPath(formData.get("next"), `/${routing.defaultLocale}`);
  const locale = localeOfPath(next) ?? routing.defaultLocale;
  const raw = {
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: "invalid", ...raw };
  const { username, displayName } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username, display_name: displayName || username })
    .eq("id", user.id)
    .select("id")
    .single();

  if (error) {
    // 23505: unique username; 23514: check constraint (format or reserved name).
    if (error.code === "23505") return { error: "taken", ...raw };
    if (error.code === "23514") return { error: "invalid", ...raw };
    return { error: "unknown", ...raw };
  }

  redirect(next);
}
