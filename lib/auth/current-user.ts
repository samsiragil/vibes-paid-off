import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  /** Null until onboarding is finished. */
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Approved before: new projects publish without review. */
  isTrusted: boolean;
  /** From the OAuth provider; used to suggest a username during onboarding. */
  providerHandle: string | null;
};

/**
 * The signed-in user with their profile, or null. Reads the session cookie, so call it
 * behind a <Suspense> boundary. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Session checks compare the JWT expiry with the current time, which must never be prerendered
  // (runtime prefetches can read cookies too).
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, is_trusted")
    .eq("id", claims.sub)
    .maybeSingle();

  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const providerHandle =
    typeof metadata.user_name === "string"
      ? metadata.user_name
      : typeof metadata.email === "string"
        ? metadata.email.split("@")[0]
        : null;

  return {
    id: claims.sub,
    username: profile?.username ?? null,
    displayName: profile?.display_name || providerHandle || "",
    avatarUrl: profile?.avatar_url ?? null,
    isTrusted: profile?.is_trusted ?? false,
    providerHandle,
  };
});
