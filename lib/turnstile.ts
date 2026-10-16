import "server-only";

const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Checks a Cloudflare Turnstile token on the server (§2.6). Without TURNSTILE_SECRET_KEY the check
 * is skipped outside Vercel production, so local development works without keys; in production a
 * missing secret fails closed.
 */
export async function verifyTurnstile(token: string | undefined, remoteIp?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("TURNSTILE_SECRET_KEY is missing; rejecting the request.");
      return false;
    }
    return true;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(verifyUrl, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (cause) {
    console.error("Turnstile verification failed", cause);
    return false;
  }
}
