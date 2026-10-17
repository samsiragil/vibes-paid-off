/** Local platform (Saweria/Trakteer) for visitors in Indonesia, global one for the rest (Q16). */
export type DonateChannel = "local" | "global";

const platformNames: Record<string, string> = {
  "saweria.co": "Saweria",
  "trakteer.id": "Trakteer",
  "buymeacoffee.com": "Buy Me a Coffee",
  "ko-fi.com": "Ko-fi",
};

function channelUrl(channel: DonateChannel) {
  const url =
    channel === "local"
      ? process.env.NEXT_PUBLIC_DONATE_URL_ID
      : process.env.NEXT_PUBLIC_DONATE_URL_EN;
  return url?.startsWith("https://") ? url : null;
}

/**
 * A configured donation link with the platform's name for the button ("Lewat Saweria"), or null
 * until its env var is set. Unknown hosts show their domain.
 */
export function donateLink(channel: DonateChannel) {
  const url = channelUrl(channel);
  if (!url) return null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  return { url, platform: platformNames[host] ?? host };
}

/**
 * External donation link for the active language: local platform for /id, global for /en.
 * Null until configured; callers then link to /support instead.
 */
export function donateUrl(locale: string) {
  return donateLink(locale === "id" ? "local" : "global")?.url ?? null;
}
