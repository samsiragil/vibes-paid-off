/**
 * Absolute origin of the site, for metadata (Open Graph, canonical) and shareable links.
 * NEXT_PUBLIC_SITE_URL wins; on Vercel the production domain is the fallback.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/+$/, "");

/** "jadinya.dev/u/ragil": an absolute URL without the scheme, for display. */
export function displayUrl(path: string) {
  return `${siteUrl.replace(/^https?:\/\//, "")}${path}`;
}

/** Anchor of "Cara kami memilih" (§2.7) on /support, linked from the footer and /rules. */
export const PICKING_ANCHOR = "cara-kami-memilih";
