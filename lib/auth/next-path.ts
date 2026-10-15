import { routing, type Locale } from "@/i18n/routing";

/**
 * Where to send the user after login/onboarding. Only same-site absolute paths are allowed,
 * so `?next=` cannot be abused as an open redirect.
 */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/** The locale a path like `/en/p/foo` belongs to, if any. */
export function localeOfPath(path: string): Locale | undefined {
  const segment = path.split("/")[1];
  return routing.locales.find((locale) => locale === segment);
}
