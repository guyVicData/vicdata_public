// 0.8 front door part 3 (E24, Q5): sending a new-device code. No email provider is chosen yet, so device codes are
// off (DEVICE_CODES=off, the default) and nothing is sent. When Guy picks one, this is the only file that knows it.
// Written for Resend's HTTP API (one POST, an API key, a verified sending domain); another provider is a second
// implementation of the same one-function interface. Never logs the code.
export type CodeMailer = { configured: boolean; send(to: string, code: string): Promise<boolean> };

export function codeEmail(code: string): { subject: string; text: string } {
  return {
    subject: `${code} is your VicData sign-in code`,
    text: `Someone -- we hope you -- is signing in to VicData on a browser we haven't seen before.\n\nYour code is ${code}. It lasts 10 minutes.\n\nIf this wasn't you, don't share the code, and change your password.`,
  };
}

/** The configured mailer: RESEND_API_KEY and DEVICE_CODE_FROM ("VicData <signin@vicdata.co.uk>"), or none.
 * RESEND_API_URL overrides the endpoint (unset: Resend's own). */
export function envMailer(): CodeMailer {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DEVICE_CODE_FROM;
  if (!key || !from) return { configured: false, send: async () => false };
  return {
    configured: true,
    async send(to, code) {
      const { subject, text } = codeEmail(code);
      try {
        const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to], subject, text }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) console.error("[devices] the code email was refused:", r.status);
        return r.ok;
      } catch (e) {
        console.error("[devices] the code email failed:", (e as Error).message);
        return false;
      }
    },
  };
}
