"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { AuthShell, AUTH_BUTTON, AUTH_INPUT, AUTH_LINK } from "@/components/auth/AuthShell";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { DeviceCode, goHome } from "@/components/auth/DeviceCode";
import { SIGNED_OUT_WORDS } from "@/lib/devices/words";

// 0.8 front door part 3: sign-in, in the signed-out frame (one column, 44 px controls, G). Email and password, no
// public sign-up (A4): testers arrive by invitation (/join/<urn>). Then the device step (E24, /api/auth/device):
// a device VicData knows goes straight home; one it hasn't seen asks for the 6-digit code emailed to the account
// (DEVICE_CODES=on). /login?step=device is where the beta gate sends a session that hasn't finished this step;
// /login?signedOut=<why> says why this browser was signed out. R-PASSWORD-RESET: "Forgot password?" swaps the form
// for the email-a-link form in place (ForgotPasswordForm; the link lands on /reset-password).

type Step = { kind: "form" } | { kind: "forgot" } | { kind: "checking" } | { kind: "code"; sentTo: string; message: string | null };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell wordmarkHref="/"><p className="text-sm text-neutral-500">Loading…</p></AuthShell>}>
      <Login />
    </Suspense>
  );
}

async function finishDevice(): Promise<Step | "home" | { error: string }> {
  const r = await fetch("/api/auth/device", { method: "POST" });
  const j = (await r.json().catch(() => ({}))) as { next?: string; sentTo?: string; message?: string | null; error?: string };
  if (r.ok && j.next === "home") return "home";
  if (r.ok && j.next === "code") return { kind: "code", sentTo: j.sentTo ?? "your email", message: j.message ?? null };
  return { error: j.error ?? "VicData couldn't finish signing you in. Try again in a minute." };
}

function Login() {
  const supabase = createBrowserSupabaseClient();
  const params = useSearchParams();
  const signedOut = params.get("signedOut");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>(params.get("step") === "device" ? { kind: "checking" } : { kind: "form" });

  // Sent here to finish signing in: pick up where this session left off (no second email if a code is on its way).
  useEffect(() => {
    if (params.get("step") !== "device") return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setStep({ kind: "form" });
      const next = await finishDevice();
      if (next === "home") return goHome();
      if ("error" in next) {
        setError(next.error);
        return setStep({ kind: "form" });
      }
      setStep(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      setError(error.message);
      return;
    }
    const next = await finishDevice();
    setSubmitting(false);
    if (next === "home") return goHome();
    if ("error" in next) return setError(next.error);
    setStep(next);
  }

  async function useAnotherAccount() {
    await supabase.auth.signOut({ scope: "local" });
    setPassword("");
    setError(null);
    setStep({ kind: "form" });
  }

  if (step.kind === "checking")
    return (
      <AuthShell wordmarkHref="/">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Finishing signing in…</p>
      </AuthShell>
    );
  if (step.kind === "code") return <DeviceCode sentTo={step.sentTo} initialMessage={step.message} onOther={useAnotherAccount} />;
  if (step.kind === "forgot")
    return (
      <AuthShell wordmarkHref="/">
        <h1 className="text-xl font-semibold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Enter the email address you sign in with. We&rsquo;ll send you a link to choose a new password.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm initialEmail={email} onBack={() => setStep({ kind: "form" })} />
        </div>
      </AuthShell>
    );

  return (
    <AuthShell wordmarkHref="/">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {signedOut && SIGNED_OUT_WORDS[signedOut as keyof typeof SIGNED_OUT_WORDS] && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{SIGNED_OUT_WORDS[signedOut as keyof typeof SIGNED_OUT_WORDS]}</p>}
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Email</span>
          <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={AUTH_INPUT} />
        </label>
        <label className="block">
          <span className="sr-only">Password</span>
          <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={AUTH_INPUT} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={submitting} className={AUTH_BUTTON}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button type="button" onClick={() => setStep({ kind: "forgot" })} className={`mt-2 ${AUTH_LINK}`}>
        Forgot password?
      </button>
    </AuthShell>
  );
}
