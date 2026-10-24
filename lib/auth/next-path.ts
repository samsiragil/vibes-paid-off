import { routing, type Locale } from "@/i18n/routing";

export { safeNextPath } from "./safe-next-path";

/** The locale a path like `/en/p/foo` belongs to, if any. */
export function localeOfPath(path: string): Locale | undefined {
  const segment = path.split("/")[1];
  return routing.locales.find((locale) => locale === segment);
}
