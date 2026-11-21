"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { AuthShell, AUTH_BUTTON, AUTH_INPUT } from "@/components/auth/AuthShell";

// 0.8 front door part 3: sign-in, in the signed-out frame (one column, 44 px controls, G). Email and
// password, no public sign-up (A4): testers arrive by invitation (/join/<urn>). The session it makes is the
// cookie session (milestone 1).
export default function LoginPage() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <AuthShell wordmarkHref="/">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Email</span>
          <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={AUTH_INPUT} />
        </label>
        <label className="block">
          <span className="sr-only">Password</span>
          <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={AUTH_INPUT} />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={submitting} className={AUTH_BUTTON}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
