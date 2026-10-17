import "server-only";

// Transactional email through Resend's HTTP API (Q10: free tier, sender on vibespaidoff.dev).
// Optional: without RESEND_API_KEY and EMAIL_FROM nothing is sent and makers read the outcome
// on /me instead, which is the plan until the domain is set up.

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type Email = { to: string; subject: string; text: string };

/** Sends one plain-text email. Never throws; returns whether Resend accepted it. */
export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("email send failed", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("email send failed", error);
    return false;
  }
}
