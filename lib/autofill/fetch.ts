import "server-only";
import { blockedReason } from "@/scripts/lib/link-probe.mjs";

// Fetching maker-supplied URLs for autofill. Like the link checker, every redirect hop must stay
// on the public internet, so a live_url cannot make the server reach loopback, private or cloud
// metadata addresses. Bodies are capped and the whole request has a time limit.

const USER_AGENT = "Mozilla/5.0 (compatible; JadinyaAutofill/1.0)";
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 8_000;

export type FetchedBody = { url: string; contentType: string; bytes: Uint8Array<ArrayBuffer> };

/**
 * GET `target`. With `truncate`, a body over `maxBytes` is cut (enough for a page's <head>);
 * without it, an oversized body fails. Null on any failure.
 */
export async function fetchPublic(
  target: string,
  options: { accept: string; maxBytes: number; truncate?: boolean },
): Promise<FetchedBody | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    let current = target;
    for (let hop = 0; ; hop++) {
      if (await blockedReason(current)) return null;

      const response = await fetch(current, {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { "user-agent": USER_AGENT, accept: options.accept },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => {});
        if (hop >= MAX_REDIRECTS) return null;
        current = new URL(location, current).href;
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => {});
        return null;
      }

      const declared = Number(response.headers.get("content-length"));
      if (!options.truncate && declared > options.maxBytes) {
        await response.body.cancel().catch(() => {});
        return null;
      }
      const bytes = await readCapped(response.body, options.maxBytes, options.truncate ?? false);
      if (!bytes) return null;
      return {
        url: current,
        contentType: (response.headers.get("content-type") ?? "")
          .split(";")[0]
          .trim()
          .toLowerCase(),
        bytes,
      };
    }
  } catch {
    return null;
  }
}

async function readCapped(body: ReadableStream<Uint8Array>, maxBytes: number, truncate: boolean) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > maxBytes) {
      await reader.cancel().catch(() => {});
      if (!truncate) return null;
      chunks.push(value.subarray(0, maxBytes - size));
      size = maxBytes;
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
