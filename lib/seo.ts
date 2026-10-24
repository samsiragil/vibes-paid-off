import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "./site";

/**
 * Canonical URL and hreflang links for a page that exists in every language (§2.5). `path` is
 * the route without the locale prefix ("" for home, "/explore"); query strings are never part of
 * the canonical, so filtered /explore URLs point at the plain page. Relative URLs resolve against
 * metadataBase (siteUrl).
 */
export function localeAlternates(locale: string, path = ""): Metadata["alternates"] {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((item) => [item, `/${item}${path}`])),
      "x-default": `/${routing.defaultLocale}${path}`,
    },
  };
}

/** Absolute URL of a localized page, for JSON-LD and the sitemap. */
export function localeUrl(locale: string, path = "") {
  return `${siteUrl}/${locale}${path}`;
}

/** Open Graph locale tag for a site language. */
export function ogLocale(locale: string) {
  return locale === "en" ? "en_US" : "id_ID";
}
