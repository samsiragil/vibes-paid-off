/**
 * URL slug from a title: "Kasir Warung Bu Tini!" → "kasir-warung-bu-tini". Accents are folded
 * ("Café" → "cafe"); anything else that is not a-z or 0-9 becomes a hyphen. May return "" (for
 * titles without Latin letters or digits); the database then falls back to "proyek".
 */
export function slugify(text: string, maxLength = 70) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}
