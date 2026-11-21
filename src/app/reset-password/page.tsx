"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import ForgotPasswordForm, { BUTTON, FIELD, TEXT_LINK } from "@/components/auth/ForgotPasswordForm";
import {
  EXPIRED_LINK_MESSAGE,
  MIN_PASSWORD_LENGTH,
  NO_LINK_MESSAGE,
  newPasswordProblem,
  parseRecoveryArrival,
  updateOutcome,
  type RecoveryArrival,
} from "@/lib/password-reset";

// R-PASSWORD-RESET: where the recovery email's link lands. This project's browser client is supabase-js's
// default implicit flow, so the session arrives in the URL fragment and the client (first made by NavBar)
// saves it and clears the fragment only after checking the token over the network. The arrival is read
// here, when the page's module first runs in the browser (while the first render is still going), so it
// is always read before the client clears it. Used once: a later visit in the same tab (client
// navigation keeps the module) reads as "none". It is spent only once a run of the effect has its
// answer, so React's dev double effect sees it too.
let arrival: RecoveryArrival = typeof window === "undefined" ? { kind: "none" } : parseRecoveryArrival(window.location.hash, window.location.search);

// A reload after the fragment has gone still finds the form: the recovered user's id, for this tab only.
const PENDING_KEY = "vicdata_recovery_pending";

type State = "checking" | "ready" | "expired" | "no_link" | "saving" | "done";

function readPending(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}
function writePending(v: string | null) {
  try {
    if (v) window.sessionStorage.setItem(PENDING_KEY, v);
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked: a reload then asks for a new link.
  }
}

export default function ResetPasswordPage() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const ARRIVAL = arrival;
    (async () => {
      // The client's own check of the link (it reads the fragment in its constructor).
      const { error: initError } = await supabase.auth.initialize();
      if (cancelled) return;
      arrival = { kind: "none" };
      if (ARRIVAL.kind === "link_error" || (ARRIVAL.kind === "recovery" && initError)) {
        if (initError) console.error("[ResetPassword] recovery link:", initError.message);
        // Leave no error fragment behind for a reload or a shared URL.
        window.history.replaceState(window.history.state, "", window.location.pathname);
        setState("expired");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const user = data.session?.user ?? null;
      if (user && (ARRIVAL.kind === "recovery" || readPending() === user.id)) {
        writePending(user.id);
        setEmail(user.email ?? "");
        setState("ready");
        return;
      }
      setState("no_link");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const why = newPasswordProblem(password, confirm);
    setProblem(why);
    if (why) return;
    setState("saving");
    const { error } = await supabase.auth.updateUser({ password });
    const out = updateOutcome(error);
    if (out.kind === "ok") {
      writePending(null);
      setState("done");
      router.replace("/member");
      return;
    }
    if (error) console.error("[ResetPassword] updateUser:", error.status, error.code ?? error.name);
    if (out.kind === "expired") {
      writePending(null);
      setState("expired");
      return;
    }
    setProblem(out.message);
    setState("ready");
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 sm:px-6 sm:py-24">
      {state === "checking" && <p className="text-sm text-neutral-500">Checking your link…</p>}

      {(state === "ready" || state === "saving") && (
        <>
          <h1 className="text-xl font-semibold">Choose a new password</h1>
          {email && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">For {email}.</p>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            {/* For password managers: the account this password belongs to. */}
            <input type="email" autoComplete="username" value={email} readOnly hidden />
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600 dark:text-neutral-400">New password</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600 dark:text-neutral-400">The same again</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={FIELD}
              />
            </label>
            <p className="text-sm text-neutral-500">At least {MIN_PASSWORD_LENGTH} characters.</p>
            {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
            <button type="submit" disabled={state === "saving"} className={BUTTON}>
              {state === "saving" ? "Saving…" : "Save and log in"}
            </button>
          </form>
        </>
      )}

      {state === "done" && (
        <>
          <h1 className="text-xl font-semibold">Password changed</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">You&rsquo;re logged in. Taking you to VicData…</p>
        </>
      )}

      {(state === "expired" || state === "no_link") && (
        <>
          <h1 className="text-xl font-semibold">{state === "expired" ? "That link doesn't work any more" : "Reset your password"}</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{state === "expired" ? EXPIRED_LINK_MESSAGE : NO_LINK_MESSAGE}</p>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
          <Link href="/login" className={`mt-2 ${TEXT_LINK}`}>
            Back to log in
          </Link>
        </>
      )}
    </main>
  );
}
