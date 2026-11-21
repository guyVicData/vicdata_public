// R-PASSWORD-RESET (0.8 front door part 3, Q3): "Forgot password?" and /reset-password, the pure half.
// Run: npx -y tsx --test src/lib/password-reset.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NEUTRAL_SENT_MESSAGE,
  RATE_LIMITED_MESSAGE,
  RESEND_WAIT_SECONDS,
  SEND_FAILED_MESSAGE,
  newPasswordProblem,
  parseRecoveryArrival,
  confirmDestination,
  afterResetDestination,
  requestOutcome,
  resetRedirectUrl,
  updateOutcome,
  waitRemaining,
} from "./password-reset";
import { NOINDEX_SOURCES } from "../../next.config";

test("R-PASSWORD-RESET: the confirmation never says whether an account exists", () => {
  assert.match(NEUTRAL_SENT_MESSAGE, /^If that address has a VicData account, we've sent a link/);
  // Supabase answers an unknown address with success; a 4xx about the address must read the same.
  assert.deepEqual(requestOutcome(null), { kind: "sent", message: NEUTRAL_SENT_MESSAGE });
  assert.deepEqual(requestOutcome({ status: 400, code: "user_not_found", message: "User not found" }), { kind: "sent", message: NEUTRAL_SENT_MESSAGE });
  assert.deepEqual(requestOutcome({ status: 422, code: "email_address_invalid", message: "Email address is invalid" }), { kind: "sent", message: NEUTRAL_SENT_MESSAGE });
  for (const m of [NEUTRAL_SENT_MESSAGE, RATE_LIMITED_MESSAGE, SEND_FAILED_MESSAGE]) assert.doesNotMatch(m, /no account|not found|doesn't exist|isn't registered/i);
});

test("R-PASSWORD-RESET: the link comes back to this site's /reset-password", () => {
  assert.equal(resetRedirectUrl("https://vicdata.co.uk"), "https://vicdata.co.uk/reset-password");
  assert.equal(resetRedirectUrl("https://vicdata.co.uk/"), "https://vicdata.co.uk/reset-password");
  assert.equal(resetRedirectUrl("http://localhost:3000"), "http://localhost:3000/reset-password");
  assert.equal(resetRedirectUrl("https://vicdata-public.onrender.com/login?x=1#y"), "https://vicdata-public.onrender.com/reset-password");
  assert.throws(() => resetRedirectUrl("not a url"));
});

test("R-PASSWORD-RESET: pressing again too soon says how long to wait", () => {
  const t0 = 1_700_000_000_000;
  assert.equal(waitRemaining(null, t0), 0);
  assert.equal(waitRemaining(t0, t0), RESEND_WAIT_SECONDS);
  assert.equal(waitRemaining(t0, t0 + 1_500), RESEND_WAIT_SECONDS - 1);
  assert.equal(waitRemaining(t0, t0 + RESEND_WAIT_SECONDS * 1000), 0);
  assert.equal(waitRemaining(t0, t0 - 3_600_000), RESEND_WAIT_SECONDS, "a clock set back never waits longer than the wait");
  const soon = requestOutcome({ status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 42 seconds." });
  assert.equal(soon.kind, "too_soon");
  assert.equal(soon.message, "You've just asked for a link. You can ask for another in 42 seconds.");
});

test("R-PASSWORD-RESET: the hourly email limit and a failed send each say so, plainly", () => {
  assert.deepEqual(requestOutcome({ status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" }), { kind: "rate_limited", message: RATE_LIMITED_MESSAGE });
  assert.equal(requestOutcome({ status: 429, message: "Too many requests" }).kind, "rate_limited");
  assert.equal(requestOutcome({ status: 0, name: "AuthRetryableFetchError", message: "Failed to fetch" }).kind, "failed");
  assert.equal(requestOutcome({ status: 500, message: "Error sending recovery email" }).kind, "failed");
});

test("R-PASSWORD-RESET: the recovery link's fragment, a used or expired link, and no link", () => {
  assert.deepEqual(parseRecoveryArrival("#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery"), { kind: "recovery" });
  assert.deepEqual(parseRecoveryArrival("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"), {
    kind: "link_error",
    code: "otp_expired",
    description: "Email link is invalid or has expired",
  });
  assert.equal(parseRecoveryArrival("", "?error=access_denied&error_code=otp_expired").kind, "link_error");
  assert.deepEqual(parseRecoveryArrival("#access_token=abc&type=signup"), { kind: "none" }, "only a recovery session opens the form");
  assert.deepEqual(parseRecoveryArrival(""), { kind: "none" });
  // Cookie sessions (part 3): the PKCE link, and /auth/confirm's redeemed link.
  assert.deepEqual(parseRecoveryArrival("", "?code=pkce-code"), { kind: "recovery" }, "the PKCE link: the browser client exchanges it");
  assert.deepEqual(parseRecoveryArrival("", "?recovery=1"), { kind: "recovery" }, "redeemed on the server by /auth/confirm");
  assert.deepEqual(parseRecoveryArrival("", "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"), { kind: "link_error", code: "otp_expired", description: "Email link is invalid or has expired" });
});

test("R-PASSWORD-RESET: the new password follows sign-up's rules and is typed twice", () => {
  assert.equal(newPasswordProblem("short", "short"), "Use at least 8 characters.");
  assert.equal(newPasswordProblem("long enough", "long enougj"), "The two passwords don't match.");
  assert.equal(newPasswordProblem("long enough", "long enough"), null);
  // Sign-up's own rule, so the two never drift apart.
  const join = readFileSync(new URL("../app/join/[urn]/page.tsx", import.meta.url), "utf8");
  assert.match(join, /type="password"\s+minLength=\{8\}/);
});

test("R-PASSWORD-RESET: saving the new password -- same as before, too weak, link gone", () => {
  assert.deepEqual(updateOutcome(null), { kind: "ok" });
  assert.equal(updateOutcome({ status: 422, code: "same_password", message: "New password should be different from the old password." }).kind, "retry");
  assert.match((updateOutcome({ status: 422, code: "same_password" }) as { message: string }).message, /password you have now/);
  assert.equal(updateOutcome({ status: 422, code: "weak_password", message: "Password should be at least 8 characters." }).kind, "retry");
  assert.deepEqual(updateOutcome({ name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" }), { kind: "expired" });
  assert.deepEqual(updateOutcome({ status: 403, code: "session_not_found", message: "Session not found" }), { kind: "expired" });
});

test("R-PASSWORD-RESET: both pages are never indexed", () => {
  assert.ok(NOINDEX_SOURCES.includes("/login"));
  assert.ok(NOINDEX_SOURCES.includes("/reset-password"));
  for (const f of ["../app/login/layout.tsx", "../app/reset-password/layout.tsx"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /NOINDEX_METADATA/, f);
  }
});

test("R-PASSWORD-RESET: /auth/confirm sends a redeemed link to a path on this site only; a recovery to the reset page", () => {
  assert.equal(confirmDestination("recovery", "/reset-password"), "/reset-password?recovery=1");
  assert.equal(confirmDestination("recovery", null), "/reset-password?recovery=1");
  assert.equal(confirmDestination("recovery", "//evil.example"), "/reset-password?recovery=1");
  assert.equal(confirmDestination("recovery", "https://evil.example"), "/reset-password?recovery=1");
  assert.equal(confirmDestination("email", "/teacher"), "/teacher");
  assert.equal(confirmDestination("email", null), "/member");
});

test("R-PASSWORD-RESET: after the new password, the device step decides where to go (home, or the code screen)", () => {
  assert.equal(afterResetDestination("home"), "/member");
  assert.equal(afterResetDestination("code"), "/login?step=device");
  assert.equal(afterResetDestination(undefined), null);
  const page = readFileSync(new URL("../app/reset-password/page.tsx", import.meta.url), "utf8");
  assert.match(page, /fetch\("\/api\/auth\/device", \{ method: "POST" \}\)/);
  assert.match(page, /afterResetDestination\(/);
  const confirm = readFileSync(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8");
  assert.match(confirm, /verifyOtp\(\{ type, token_hash/);
});
