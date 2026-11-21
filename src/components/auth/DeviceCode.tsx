"use client";

import { useEffect, useRef, useState } from "react";
import { AuthShell, AUTH_BUTTON, AUTH_INPUT, AUTH_LINK } from "./AuthShell";

/** A full load home: the proxy must see the new session (and device) on the very next request. */
export function goHome() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose (above)
  window.location.assign("/member");
}

// R-DEVICE-CODES: the new-device code screen. One field (numeric keypad on a phone, the OS's one-time-code fill),
// Continue, "Send a new code", "Use another account".
export function DeviceCode({ sentTo, initialMessage, onOther }: { sentTo: string; initialMessage: string | null; onOther: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(initialMessage);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const r = await fetch("/api/auth/device/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (j.ok) return goHome();
    setError(j.error ?? "That didn't work. Try again.");
    setCode("");
  }

  async function resend() {
    setError(null);
    setInfo(null);
    const r = await fetch("/api/auth/device/resend", { method: "POST" });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (j.ok) setInfo(j.message ?? "We've sent a new code.");
    else setError(j.message ?? "We couldn't send a code just now.");
  }

  return (
    <AuthShell wordmarkHref="/">
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        This is a device VicData hasn&rsquo;t seen before. We&rsquo;ve sent a 6-digit code to <span className="font-medium text-neutral-900 dark:text-neutral-100">{sentTo}</span>. It lasts 10 minutes.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Code</span>
          <input
            ref={input}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={`${AUTH_INPUT} tracking-[0.3em]`}
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {info && <p className="text-sm text-neutral-600 dark:text-neutral-400">{info}</p>}
        <button type="submit" disabled={busy || code.replace(/\D/g, "").length !== 6} className={AUTH_BUTTON}>
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">We&rsquo;ll remember this device for 60 days.</p>
      <div className="mt-4 flex flex-col items-start">
        <button type="button" onClick={resend} className={AUTH_LINK}>
          Send a new code
        </button>
        <button type="button" onClick={onOther} className={AUTH_LINK}>
          Use another account
        </button>
      </div>
    </AuthShell>
  );
}
