// Public URL of a stored image. Safe for the browser: only the public media domain is involved.
const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.replace(/\/+$/, "");

/** `p/{projectId}/{uuid}.webp` → `https://img.jadinya.dev/p/{projectId}/{uuid}.webp`. */
export function mediaUrl(key: string) {
  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_MEDIA_BASE_URL. Copy .env.example to .env.local and fill it in.",
    );
  }
  return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** The key of an image on our media domain (an uploaded profile photo), or null for other URLs. */
export function mediaKeyOf(url: string) {
  if (!baseUrl || !url.startsWith(`${baseUrl}/`)) return null;
  return url
    .slice(baseUrl.length + 1)
    .split("/")
    .map(decodeURIComponent)
    .join("/");
}
