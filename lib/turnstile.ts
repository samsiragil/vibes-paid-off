import "server-only";
import { headers } from "next/headers";

const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Widget actions, so a token solved for one form cannot be replayed on another. */
export type TurnstileAction = "reply" | "submit_project";

// Cloudflare's always-pass/always-fail test secrets answer with placeholder hostname and action.
const testSecret = /^[0-9]x0+AA$/;

/**
 * Checks a Cloudflare Turnstile token on the server (§2.6). Without TURNSTILE_SECRET_KEY the check
 * is skipped outside Vercel production, so local development works without keys; in production a
 * missing secret fails closed.
 */
export async function verifyTurnstile(token: string | undefined, action: TurnstileAction) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("TURNSTILE_SECRET_KEY is missing; rejecting the request.");
      return false;
    }
    return true;
  }
  if (!token) return false;

  const headerList = await headers();
  // Vercel sets x-real-ip / x-forwarded-for itself; cf-connecting-ip is not trusted because any
  // client can send it when the request does not pass through Cloudflare.
  const remoteIp =
    headerList.get("x-real-ip") ?? headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host"))?.split(":")[0];

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(verifyUrl, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    if (result.success !== true) return false;
    if (testSecret.test(secret)) return true;
    // The token must have been solved on this site and for this form.
    return result.hostname === host && result.action === action;
  } catch (cause) {
    console.error("Turnstile verification failed", cause);
    return false;
  }
}
