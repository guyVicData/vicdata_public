"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

// 0.8 front door part 3 (E24): "Where you're signed in", on the account page. Each device signed in now -- what it
// is, roughly where (city at most), when it was last active -- with "Sign out" on each and "Sign out of all
// devices". One column at phone width, 44 px controls (G). Reads and writes only the person's own devices
// (/api/auth/devices checks the owner).
type Device = { id: string; label: string; form: "desktop" | "phone" | "tablet" | null; place: string | null; lastActive: string; current: boolean };

const BUTTON = "inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

function Glyph({ form }: { form: Device["form"] }) {
  // A phone or a screen, drawn plainly.
  return form === "phone" || form === "tablet" ? (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>
  ) : (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
  );
}

async function leave() {
  await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load: the session is gone
  window.location.assign("/login?signedOut=all");
}

export function WhereSignedIn() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/auth/devices");
    if (!r.ok) return setError("Couldn't load where you're signed in.");
    setDevices(((await r.json()) as { devices: Device[] }).devices);
  }, []);
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function act(body: { action: "sign_out"; id: string } | { action: "sign_out_all" }) {
    setBusy(body.action === "sign_out" ? body.id : "all");
    setError(null);
    const r = await fetch("/api/auth/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; signedOutHere?: boolean; error?: string };
    setBusy(null);
    if (!j.ok) return setError(j.error ?? "That didn't work. Try again.");
    if (j.signedOutHere) return leave();
    await load();
  }

  return (
    <section data-where-signed-in className="mb-8 rounded-md border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
      <h2 className="font-medium">Where you&rsquo;re signed in</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Places are rough, from your internet connection.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {devices === null && !error && <p className="mt-3 text-sm text-neutral-500">Loading…</p>}
      {devices && (
        <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 text-neutral-500 dark:text-neutral-400"><Glyph form={d.form} /></span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {d.label}
                    {d.current && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">This device</span>}
                  </div>
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">{[d.place ?? "Place unknown", d.current ? "Active now" : d.lastActive].join(" · ")}</div>
                </div>
              </div>
              <button type="button" className={`${BUTTON} w-full sm:w-auto`} disabled={busy !== null} onClick={() => act({ action: "sign_out", id: d.id })}>
                {busy === d.id ? "Signing out…" : "Sign out"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {devices && devices.length > 0 && (
        <button type="button" className={`${BUTTON} mt-3 w-full sm:w-auto`} disabled={busy !== null} onClick={() => act({ action: "sign_out_all" })}>
          {busy === "all" ? "Signing out…" : "Sign out of all devices"}
        </button>
      )}
    </section>
  );
}
