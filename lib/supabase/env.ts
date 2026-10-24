import { siteUrl } from "@/lib/site";

// Public Supabase settings, safe for the browser. The secret key is read only in server-only modules.
export const supabaseUrl = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
export const supabasePublishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * Auth cookie options shared by every Supabase client. `secure` is set explicitly so the session
 * cookies are never sent over plain HTTP; only local development on http://localhost turns it off.
 */
export const authCookieOptions = {
  secure: process.env.NODE_ENV === "production" && !siteUrl.startsWith("http://"),
};

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}
