"use client";

// VicData 0.8 front door, part 3 (E24): the Platform page's quiet alert -- accounts used from more than 4 places in
// 24 hours, each with their schools and the places, and "Sign out everywhere". Nothing shows when nobody is flagged
// beyond one quiet line; no email is sent.
import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type Flag = { profileId: string; name: string; email: string | null; schools: string[]; places: string[]; devices: number };
type Answer = { notSetUp: boolean; flags: Flag[]; rule?: { places: number; hours: number } };

async function token(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export function SignInFlagsSection() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(async () => {
    const t = await token();
    const r = await fetch("/api/platform/sign-in-flags", { headers: t ? { Authorization: `Bearer ${t}` } : {} }).catch(() => null);
    if (r?.ok) setAnswer((await r.json()) as Answer);
  }, []);
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);
  if (!answer || answer.notSetUp) return null;

  async function signOut(f: Flag) {
    if (!window.confirm(`Sign ${f.name} out of every device?`)) return;
    const t = await token();
    const r = await fetch("/api/platform/sign-in-flags", { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ profileId: f.profileId }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { ok?: boolean; signedOut?: number; error?: string };
    setNote(j?.ok ? `${f.name}: signed out of ${j.signedOut} ${j.signedOut === 1 ? "device" : "devices"}.` : (j?.error ?? "That didn't work."));
    await load();
  }

  const rule = answer.rule ?? { places: 4, hours: 24 };
  return (
    <section data-sign-in-flags="" className="mt-8">
      <h2 className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted3)]">Sign-in flags</h2>
      <p className="mt-1 text-[12.5px] text-[var(--muted)]">Accounts used from more than {rule.places} places in {rule.hours} hours.</p>
      {note && <p role="status" className="mt-1 text-[12.5px]">{note}</p>}
      {answer.flags.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--muted)]">None.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {answer.flags.map((f) => (
            <li key={f.profileId} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 text-[13px]">
              <div className="min-w-0">
                <div className="font-semibold">{f.name}{f.email && f.email !== f.name ? ` · ${f.email}` : ""}</div>
                <div className="text-[var(--muted)]">{f.schools.join(", ") || "No school"} · {f.devices} {f.devices === 1 ? "device" : "devices"} signed in</div>
                <div>{f.places.length} places: {f.places.join(" · ")}</div>
              </div>
              <button type="button" onClick={() => signOut(f)} className="min-h-[36px] rounded-lg border border-[var(--edge-strong)] px-3 text-[12px] font-semibold">
                Sign out everywhere
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
