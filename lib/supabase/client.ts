import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { authCookieOptions, supabasePublishableKey, supabaseUrl } from "./env";

/** Supabase client for Client Components. Shares the session cookies set on the server. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookieOptions: authCookieOptions,
  });
}
