// No imports, so the unit test can load this file with plain Node (see safe-next-path.test.mjs).
const base = "http://n";

/**
 * Where to send the user after login/onboarding. Only same-site absolute paths are allowed,
 * so `?next=` cannot be abused as an open redirect.
 */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // URL parsers drop tabs/newlines and read "\" as "/", so "/\t/evil.example" would become the
  // protocol-relative "//evil.example". Reject those characters, then require our own origin.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return url.pathname + url.search + url.hash;
}
