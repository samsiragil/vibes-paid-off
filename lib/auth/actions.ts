"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./next-path";

const providerSchema = z.enum(["github", "google"]);

// Root params (and so next-intl's getLocale) are not available in Server Actions; forms send the locale.
function formLocale(formData: FormData) {
  const value = formData.get("locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

export async function signInWithProvider(formData: FormData) {
  const locale = formLocale(formData);
  const provider = providerSchema.safeParse(formData.get("provider"));
  const next = safeNextPath(formData.get("next"), `/${locale}`);
  if (!provider.success) redirect(`/${locale}/login?error=provider`);

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) redirect(`/${locale}/login?error=oauth&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signOut(formData: FormData) {
  const locale = formLocale(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
