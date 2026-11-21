"use client";

// VicData 0.8 front door, part 3 (F27, E24): the School-Admin's Sign-ins and devices page, in the account pages' frame
// (AdminShell: Dark and Light, one column of cards on a phone, 44 px controls). Each of the school's staff: the
// devices they're signed in on now (what, roughly where, last active) and "Sign out", which signs them out of every
// device. Accounts used from more than 4 places in 24 hours are flagged and come first. View as and a peek see it
// read-only.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ADMIN_TEXT, AdminShell, schoolUrn } from "./SchoolAccount";
import { PLACES_ALERT } from "@/lib/devices/config";

type Person = { profileId: string; name: string; email: string | null; devices: { label: string; form: string | null; place: string | null; lastActiveAt: string }[]; lastActiveAt: string | null; flaggedPlaces: string[] | null };
type Answer = { readOnly: boolean; notSetUp: boolean; people: Person[]; devices: number; flags: number };
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; urn: string; data: Answer };

function ago(iso: string | null, now: number): string {
  if (!iso) return "—";
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 5) return "Active now";
  if (mins < 60) return `${mins} minutes ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} day${d === 1 ? "" : "s"} ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

async function token(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export function SigninsPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const t = await token();
    if (!t) return setState({ status: "error", message: "Sign in to see your school's sign-ins." });
    const urn = await schoolUrn();
    if (!urn) return setState({ status: "error", message: "Sign-ins and devices is for your School-Admin." });
    const r = await fetch(`/api/school-admin/sign-ins?urn=${urn}`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
    if (!r || !r.ok) return setState({ status: "error", message: r?.status === 403 ? "Sign-ins and devices is for your School-Admin." : "Could not read your school's sign-ins. Try again." });
    setNow(Date.now());
    setState({ status: "ready", urn, data: (await r.json()) as Answer });
  }, []);
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function signOut(p: Person) {
    if (state.status !== "ready" || state.data.readOnly) return;
    if (!window.confirm(`Sign ${p.name} out of every device? They'll need their password to sign in again.`)) return;
    setBusy(p.profileId);
    setNote(null);
    const t = await token();
    const r = await fetch("/api/school-admin/sign-ins", { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ urn: state.urn, profileId: p.profileId }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { ok?: boolean; signedOut?: number; error?: string };
    setBusy(null);
    setNote(j?.ok ? `${p.name} is signed out of ${j.signedOut} ${j.signedOut === 1 ? "device" : "devices"}.` : (j?.error ?? "That didn't work. Try again."));
    await load();
  }

  const search = typeof window !== "undefined" ? window.location.search : "";
  return (
    <AdminShell school={null}>
      {(phone) => (
        <div data-admin-signins={phone ? "phone" : "desktop"} className={`mx-auto flex max-w-[880px] flex-col gap-2 ${phone ? "px-4 py-4" : "px-6 py-10"}`}>
          <Link href={`/teacher/school-account${search}`} className="inline-flex min-h-[44px] items-center self-start text-[13.5px] text-[var(--muted2)] hover:text-[var(--fg)]">
            ‹ Your school&rsquo;s account
          </Link>
          <div className="text-[13px] font-semibold" style={{ color: ADMIN_TEXT }}>School admin</div>
          <h1 className={`font-bold tracking-[-0.01em] ${phone ? "text-[24px]" : "text-[32px]"}`}>Sign-ins and devices</h1>
          <p className={`pb-3 text-[var(--muted2)] ${phone ? "text-[14px]" : "text-[15px]"}`}>
            Where your staff are signed in now. An account used from more than {PLACES_ALERT.places} places in {PLACES_ALERT.hours} hours is flagged and comes first. Places are rough, from the internet connection.
          </p>
          {state.status !== "ready" ? (
            <p className="py-8 text-[13.5px] text-[var(--muted2)]">{state.status === "loading" ? "Loading…" : state.message}</p>
          ) : state.data.notSetUp ? (
            <p className="py-8 text-[13.5px] text-[var(--muted2)]">Sign-ins aren&rsquo;t recorded yet.</p>
          ) : (
            <>
              <div className="pb-1 text-[13px] text-[var(--muted2)]">
                {state.data.devices} {state.data.devices === 1 ? "device" : "devices"} signed in
                {state.data.flags ? ` · ${state.data.flags} ${state.data.flags === 1 ? "flag" : "flags"}` : ""}
                {state.data.readOnly ? " · View as: read-only" : ""}
              </div>
              {note && <p role="status" className="text-[13px]" style={{ color: ADMIN_TEXT }}>{note}</p>}
              <ul className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)]">
                {state.data.people.map((p) => (
                  <li key={p.profileId} data-signins-person={p.flaggedPlaces ? "flagged" : "ok"} className={`flex border-b border-[var(--panel-border)] last:border-b-0 ${phone ? "flex-col gap-3 px-4 py-3" : "items-start gap-4 px-5 py-4"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold">{p.name}</span>
                        {p.flaggedPlaces && (
                          <span data-admin-badge="flag" className="rounded-full bg-[var(--admin-badge-bg)] px-2.5 text-[12px] font-bold leading-[22px] text-[var(--admin-badge-fg)]">
                            Flag
                          </span>
                        )}
                      </div>
                      {p.email && p.email !== p.name && <div className="text-[13px] text-[var(--muted2)]">{p.email}</div>}
                      {p.flaggedPlaces && (
                        <div className="mt-1 text-[13px]" style={{ color: ADMIN_TEXT }}>
                          Used from {p.flaggedPlaces.length} places in {PLACES_ALERT.hours} hours: {p.flaggedPlaces.join(" · ")}
                        </div>
                      )}
                      {p.devices.length ? (
                        <ul className="mt-1.5 flex flex-col gap-0.5">
                          {p.devices.map((d, i) => (
                            <li key={i} className="text-[13px] text-[var(--muted2)]">
                              <span className="text-[var(--fg)]">{d.label}</span> · {d.place ?? "Place unknown"} · {ago(d.lastActiveAt, now)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1 text-[13px] text-[var(--muted2)]">Not signed in anywhere</div>
                      )}
                    </div>
                    {p.devices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => signOut(p)}
                        disabled={state.data.readOnly || busy !== null}
                        title={state.data.readOnly ? "View as is read-only" : undefined}
                        className={`min-h-[44px] shrink-0 rounded-[10px] border border-[var(--panel-border2)] px-4 text-[13.5px] font-semibold disabled:opacity-60 ${phone ? "w-full" : ""}`}
                      >
                        {busy === p.profileId ? "Signing out…" : "Sign out"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </AdminShell>
  );
}
