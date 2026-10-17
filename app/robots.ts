import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

// Account and private pages also send `noindex`; disallowing them here saves crawl budget.
// Prefixes are spelled per locale, since "/*/me" would also match profiles like /id/u/meli.
const privatePaths = ["/admin", "/me", "/submit", "/onboarding", "/login", "/dev"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/*/p/*/edit$",
        ...routing.locales.flatMap((locale) => privatePaths.map((path) => `/${locale}${path}`)),
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
