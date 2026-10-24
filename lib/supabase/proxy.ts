import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";
import { authCookieOptions, supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Refreshes an expiring session and writes the new auth cookies onto `response`
 * (the response already produced by the i18n middleware).
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        // Keeps CDNs from caching a response that carries auth cookies.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Validates the JWT and triggers a refresh when needed. Nothing may run between client creation and this call.
  await supabase.auth.getClaims();
  return response;
}
