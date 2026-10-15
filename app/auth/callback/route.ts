import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { localeOfPath, safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

// OAuth (PKCE) callback: trade the code for a session, then send new users to onboarding.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), `/${routing.defaultLocale}`);
  const locale = localeOfPath(next) ?? routing.defaultLocale;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.user.id)
        .maybeSingle();

      const destination = profile?.username
        ? next
        : `/${locale}/onboarding?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  const login = new URL(`/${locale}/login`, origin);
  login.searchParams.set("error", "callback");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
