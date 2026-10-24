// Probing live_url for the link checker (scripts/link-checker.mjs). live_url is maker input, so
// redirects are followed by hand and every hop must stay on the public internet: the runner never
// requests loopback, private, link-local or metadata addresses on a maker's behalf.
import { lookup } from "node:dns/promises";
import { isIP, isIPv4 } from "node:net";

export const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; JadinyaLinkChecker/1.0)";

/** Whether an IP address is publicly routable. */
export function isPublicIp(ip) {
  if (isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  // IPv4-mapped: check the embedded address; the hex form is refused outright.
  if (v6.startsWith("::ffff:")) return v6.includes(".") && isPublicIp(v6.slice(7));
  return !(
    v6 === "::" ||
    v6 === "::1" ||
    /^f[cd]/.test(v6) ||
    /^fe[89ab]/.test(v6) ||
    v6.startsWith("ff")
  );
}

/** Why the runner must not request this URL, or null when it may. */
export async function blockedReason(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return "invalid url";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "unsupported scheme";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses;
  try {
    addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch (error) {
    // Unresolvable: report the DNS code (ENOTFOUND, ...) like fetch would.
    return String(error?.code ?? "dns error");
  }
  return addresses.some(({ address }) => !isPublicIp(address)) ? "private address" : null;
}

/** { ok, detail } for one URL; never throws. */
export async function probe(target) {
  const head = await request(target, "HEAD");
  if (head.ok) return head;
  const get = await request(target, "GET");
  return get.ok ? get : { ok: false, detail: `HEAD ${head.detail}, GET ${get.detail}` };
}

async function request(target, method) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    let current = target;
    for (let hop = 0; ; hop++) {
      const blocked = await blockedReason(current);
      if (blocked) return { ok: false, detail: blocked };

      const response = await fetch(current, {
        method,
        redirect: "manual",
        signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
      });
      // Only the status matters; do not download pages.
      await response.body?.cancel().catch(() => {});

      const status = response.status;
      const location = response.headers.get("location");
      if (status >= 300 && status < 400 && location) {
        if (hop >= MAX_REDIRECTS) return { ok: false, detail: "too many redirects" };
        current = new URL(location, current).href;
        continue;
      }

      const challenged =
        response.headers.has("cf-mitigated") || response.headers.has("x-vercel-mitigated");
      if (status < 400) return { ok: true, detail: String(status) };
      if (status === 429 || (status === 403 && challenged)) {
        return { ok: true, detail: `${status} bot wall` };
      }
      return { ok: false, detail: String(status) };
    }
  } catch (error) {
    if (error?.name === "TimeoutError") return { ok: false, detail: "timeout" };
    const cause = error?.cause?.code ?? error?.cause?.message ?? error?.message ?? "error";
    return { ok: false, detail: String(cause) };
  }
}

/** A URL safe to use as a Markdown link target: anything that could end the link or cell is encoded. */
export function markdownUrl(value) {
  let href;
  try {
    href = new URL(value).href;
  } catch {
    return "#invalid-url";
  }
  return href.replace(
    /[\s|()<>\\`[\]]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
}

/** Plain text safe inside a Markdown table cell. */
export function markdownCell(value) {
  return String(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\|`*_[\]<>]/g, (char) => `\\${char}`);
}
