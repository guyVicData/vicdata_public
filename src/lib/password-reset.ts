// R-PASSWORD-RESET (0.8 front door part 3, Q3): "Forgot password?". Since cookie sessions (milestone 1) the
// recovery link lands on /reset-password with `?code=` (PKCE, the same browser) or, through /auth/confirm, with
// the session already set (`?recovery=1`, any browser); a used or expired link with `?error=…` (see
// parseRecoveryArrival). After the new password the page finishes the device step (/api/auth/device).
//
// The pure half lives here so it is unit-tested (src/lib/password-reset.test.ts): the neutral message,
// the redirect URL, the resend wait, the error wording, the fragment, the new-password rules.
// No React, no Supabase client.

/** Shown after every request that wasn't refused for rate, whatever the address: it never says whether
 * an account exists. */
export const NEUTRAL_SENT_MESSAGE =
  "If that address has a VicData account, we've sent a link to it. Open the link to choose a new password. It can take a few minutes to arrive, so check your junk folder too.";

/** Our own wait between requests from this browser, for any address (so the wait itself never hints at an
 * account). Matches Supabase's own default per-address wait. */
export const RESEND_WAIT_SECONDS = 60;

/** The same rules sign-up uses (src/app/join/[urn]/page.tsx: minLength 8). */
export const MIN_PASSWORD_LENGTH = 8;

/** Where the email link sends the reader: this site's own /reset-password, from the page's origin. */
export function resetRedirectUrl(origin: string): string {
  const u = new URL(origin);
  return `${u.origin}/reset-password`;
}

/** Seconds left before another request may go, or 0. */
export function waitRemaining(lastSentAt: number | null, now: number, waitSeconds = RESEND_WAIT_SECONDS): number {
  if (lastSentAt === null || !Number.isFinite(lastSentAt)) return 0;
  const left = Math.ceil((lastSentAt + waitSeconds * 1000 - now) / 1000);
  return left > 0 ? Math.min(left, waitSeconds) : 0;
}

export function tooSoonMessage(seconds: number): string {
  return `You've just asked for a link. You can ask for another in ${seconds} second${seconds === 1 ? "" : "s"}.`;
}

export const RATE_LIMITED_MESSAGE =
  "We can't send another link just now: VicData can only send a few of these emails each hour. Please try again in an hour.";

export const SEND_FAILED_MESSAGE = "We couldn't send the link just now. Check your connection and try again in a minute.";

/** The shape of a Supabase auth error the page needs (AuthError's own fields). */
export type AuthErrorLike = { message?: string; status?: number; code?: string; name?: string } | null | undefined;

export type RequestOutcome =
  | { kind: "sent"; message: string }
  | { kind: "too_soon"; seconds: number; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "failed"; message: string };

/** What resetPasswordForEmail's answer means to the reader. Success and every account-shaped answer read the
 * same (NEUTRAL_SENT_MESSAGE); only "slow down" and "couldn't reach VicData" read differently. */
export function requestOutcome(error: AuthErrorLike): RequestOutcome {
  if (!error) return { kind: "sent", message: NEUTRAL_SENT_MESSAGE };
  const msg = error.message ?? "";
  // Supabase's per-address wait: "For security purposes, you can only request this after 42 seconds."
  const after = /after (\d+) seconds?/i.exec(msg);
  if (after) {
    const seconds = Math.max(1, Number(after[1]));
    return { kind: "too_soon", seconds, message: tooSoonMessage(seconds) };
  }
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || /rate limit/i.test(msg)) {
    return { kind: "rate_limited", message: RATE_LIMITED_MESSAGE };
  }
  // Network failure (status 0 / AuthRetryableFetchError) or the auth server failing: the reader should know
  // nothing went, so they don't wait for an email that isn't coming.
  if (!error.status || error.status >= 500 || error.name === "AuthRetryableFetchError") {
    return { kind: "failed", message: SEND_FAILED_MESSAGE };
  }
  // Anything else (a 4xx about the address) reads as sent: it must not tell an address with an account
  // from one without.
  return { kind: "sent", message: NEUTRAL_SENT_MESSAGE };
}

export type RecoveryArrival =
  | { kind: "recovery" }
  | { kind: "link_error"; code: string; description: string }
  | { kind: "none" };

/** What the URL the reader arrived on says, read before the Supabase client clears it. Since cookie sessions
 * (front door part 3, milestone 1) the browser client uses PKCE, so the link comes back one of two ways:
 *   - `?code=…` -- Supabase's own link (the email template's {{ .ConfirmationURL }}): the browser client exchanges
 *     the code itself, which works only in the browser that asked for the email (it holds the code verifier);
 *   - `?recovery=1` -- /auth/confirm already redeemed the email's token_hash on the server and set the session
 *     cookie (the template's {{ .TokenHash }} link): works in any browser, e.g. the phone's mail app.
 * A bad or used link comes back as `?error=…&error_code=…` (or, from an older link, in the fragment). The old
 * implicit fragment (`#access_token=…&type=recovery`) still reads as a recovery, though nothing sends it now. */
export function parseRecoveryArrival(hash: string, search = ""): RecoveryArrival {
  const frag = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const code = frag.get("error_code") ?? query.get("error_code");
  const err = frag.get("error") ?? query.get("error");
  if (code || err) {
    return { kind: "link_error", code: code ?? err ?? "unspecified", description: frag.get("error_description") ?? query.get("error_description") ?? "" };
  }
  if (query.get("code") || query.get("recovery") === "1") return { kind: "recovery" };
  if (frag.get("type") === "recovery" && frag.get("access_token")) return { kind: "recovery" };
  return { kind: "none" };
}

/** Where /auth/confirm sends a redeemed email link: a path on this site only, and for a recovery the reset page
 * told where it came from. */
export function confirmDestination(type: string | null, next: string | null): string {
  const path = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : type === "recovery" ? "/reset-password" : "/member";
  return type === "recovery" && path.split("?")[0] === "/reset-password" ? "/reset-password?recovery=1" : path;
}

/** The new device step after a reset: what /api/auth/device's answer means for where to go. */
export function afterResetDestination(next: string | undefined): string | null {
  return next === "home" ? "/member" : next === "code" ? "/login?step=device" : null;
}

export const EXPIRED_LINK_MESSAGE = "This link has expired or has already been used. Each link works once, for a limited time. Send yourself a new one below.";
export const NO_LINK_MESSAGE = "To choose a new password, open the link in the email we sent you. If you don't have one, or it's old, send yourself a new one below.";

/** Why the new password can't be used yet, or null. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

export type UpdateOutcome = { kind: "ok" } | { kind: "retry"; message: string } | { kind: "expired" };

/** What updateUser({ password })'s answer means to the reader. */
export function updateOutcome(error: AuthErrorLike): UpdateOutcome {
  if (!error) return { kind: "ok" };
  const msg = error.message ?? "";
  if (error.code === "same_password" || /different from the old password/i.test(msg)) {
    return { kind: "retry", message: "That's the password you have now. Choose a different one." };
  }
  if (error.code === "weak_password" || /password should/i.test(msg)) {
    return { kind: "retry", message: msg || "That password is too weak. Try a longer one." };
  }
  if (error.code === "session_not_found" || error.code === "session_expired" || error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403) {
    return { kind: "expired" };
  }
  if (!error.status || error.status >= 500 || error.name === "AuthRetryableFetchError") {
    return { kind: "retry", message: "We couldn't save your new password just now. Check your connection and try again." };
  }
  return { kind: "retry", message: msg || "We couldn't save that password. Try again." };
}
