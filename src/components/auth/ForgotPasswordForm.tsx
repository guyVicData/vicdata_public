"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { requestOutcome, resetRedirectUrl, tooSoonMessage, waitRemaining, RESEND_WAIT_SECONDS } from "@/lib/password-reset";

// R-PASSWORD-RESET: the "Forgot password?" form, on /login and on /reset-password when a link has expired.
// The answer never says whether an account exists (requestOutcome); a second press inside the wait says so
// from this browser's own clock, for any address.

const LAST_SENT_KEY = "vicdata_reset_last_sent";

export const FIELD =
  "block min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-base sm:text-sm dark:border-neutral-700 dark:bg-neutral-900";
export const BUTTON =
  "min-h-11 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900";
export const TEXT_LINK =
  "inline-flex min-h-11 items-center text-sm text-neutral-600 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100";

function readLastSent(): number | null {
  try {
    const v = Number(window.sessionStorage.getItem(LAST_SENT_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
function writeLastSent(at: number) {
  try {
    window.sessionStorage.setItem(LAST_SENT_KEY, String(at));
  } catch {
    // Storage blocked: the wait then lasts only as long as this page.
  }
}

export default function ForgotPasswordForm({ initialEmail = "", onBack }: { initialEmail?: string; onBack?: () => void }) {
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const left = waitRemaining(lastSentAt ?? readLastSent(), Date.now());
    if (left > 0) {
      setNotice({ tone: "warn", text: tooSoonMessage(left) });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirectUrl(window.location.origin) });
    setSubmitting(false);
    const out = requestOutcome(error);
    if (out.kind === "sent") {
      const now = Date.now();
      setLastSentAt(now);
      writeLastSent(now);
      setNotice({ tone: "ok", text: out.message });
      return;
    }
    if (out.kind === "too_soon") {
      // Supabase's own wait for this address: start ours to match, so the next press counts down.
      const at = Date.now() - (RESEND_WAIT_SECONDS - out.seconds) * 1000;
      setLastSentAt(at);
      writeLastSent(at);
    }
    if (error) console.error("[ForgotPasswordForm] resetPasswordForEmail:", error.status, error.code ?? error.name);
    setNotice({ tone: "warn", text: out.message });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-400">Your email address</span>
        <input
          required
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={FIELD}
        />
      </label>
      {notice && (
        <p role="status" className={notice.tone === "ok" ? "text-sm text-neutral-700 dark:text-neutral-300" : "text-sm text-amber-700 dark:text-amber-400"}>
          {notice.text}
        </p>
      )}
      <button type="submit" disabled={submitting} className={BUTTON}>
        {submitting ? "Sending…" : lastSentAt ? "Send another link" : "Send me a link"}
      </button>
      {onBack && (
        <button type="button" onClick={onBack} className={TEXT_LINK}>
          Back to log in
        </button>
      )}
    </form>
  );
}
