// Same rule as the profiles_username_format check in the database.
export const usernamePattern = /^[a-z0-9_]{3,20}$/;

/** Turns a provider handle ("Ragil-Samsi", "ragil.samsi@…") into a valid username suggestion. */
export function suggestUsername(handle: string | null) {
  if (!handle) return "";
  const cleaned = handle
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return usernamePattern.test(cleaned) ? cleaned : "";
}
