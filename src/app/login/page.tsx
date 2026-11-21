"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import ForgotPasswordForm, { TEXT_LINK } from "@/components/auth/ForgotPasswordForm";

export default function LoginPage() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // R-PASSWORD-RESET: "Forgot password?" swaps the sign-in form for the email-a-link form, in place.
  const [forgot, setForgot] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/member");
  }

  if (forgot) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-xl font-semibold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Enter the email address you log in with. We&rsquo;ll send you a link to choose a new password.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm initialEmail={email} onBack={() => setForgot(false)} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-xl font-semibold">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-base sm:text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-base sm:text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <button type="button" onClick={() => setForgot(true)} className={`mt-2 ${TEXT_LINK}`}>
        Forgot password?
      </button>
    </main>
  );
}
