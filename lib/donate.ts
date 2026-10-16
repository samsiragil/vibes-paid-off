/**
 * External donation link for the active language: local platform for /id, global for /en
 * (Q16). Null until configured; callers then link to /support instead.
 */
export function donateUrl(locale: string) {
  const url =
    locale === "id" ? process.env.NEXT_PUBLIC_DONATE_URL_ID : process.env.NEXT_PUBLIC_DONATE_URL_EN;
  return url || null;
}
