import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Anonymous Supabase client without cookies, for public data inside `use cache` scopes
 * (request APIs like cookies() are not allowed there). RLS applies as the anon role.
 */
export function createPublicClient() {
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
