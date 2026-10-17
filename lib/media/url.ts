// Public URL of a stored image. Safe for the browser: only the public media domain is involved.
const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.replace(/\/+$/, "");

/** `p/{projectId}/{uuid}.webp` → `https://img.vibespaidoff.dev/p/{projectId}/{uuid}.webp`. */
export function mediaUrl(key: string) {
  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_MEDIA_BASE_URL. Copy .env.example to .env.local and fill it in.",
    );
  }
  return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
