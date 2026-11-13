"use client";

// VicData 0.8 group sets, M4 and M5 (brief v2 §5.4, §6; Guy's D6, D8): Manage sets in group mode,
// /sets?account=<group account>&returnTo=<Group page>. The group's sets and My sets, of both kinds --
// sets of groups (Compared against) and subsets of our own schools (Showing) -- each with what this
// person may do: Edit (or open a copy), Duplicate to My sets (every head-office member, on a group
// set), Make default and Share with the group (admins), Archive, Delete. View as and a peek read it,
// read-only. The school library (SetsLibrary.tsx) is unchanged.
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSmt } from "@/components/smt/api";
import { groupDashVars } from "@/components/groups/dash/GroupDashboard";
import { groupEditorHref } from "@/components/groups/dash/GroupSetPicker";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { useWidth } from "@/components/admissions/views/charts";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { archiveGroupSet, clearGroupDefault, deleteGroupSet, makeGroupDefault, shareGroupSet } from "@/lib/sets/group-store";
import { groupsWord, type GroupSetKind, type GroupSetRow } from "@/lib/groups/group-sets";
import { SetsWayBack, wayBack } from "./SetsShell";
import { CreatorPill } from "./SetSelector";
import type { GroupSetsResponse } from "./GroupSetEditor";

const PHONE = 600;
const KIND_WORD: Record<GroupSetKind, { title: string; sub: string; page: string }> = {
  group_peers: { title: "Sets of groups", sub: "Compared against, on Overview, Academic and Pupils", page: "overview" },
  group_schools: { title: "Subsets of our schools", sub: "Showing, on every Group page: filters the schools, never the group's figures", page: "schools" },
};

export function GroupSetsLibraryPage() {
  const sp = useSearchParams();
  const [theme] = useTeacherTheme();
  const [ref, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < PHONE;
  const account = sp.get("account") ?? "";
  const [v, setV] = useState(0);
  const q = new URLSearchParams({ account });
  for (const k of ["lookAs", "as", "peek"]) if (sp.get(k)) q.set(k, sp.get(k)!);
  if (v) q.set("v", String(v));
  const load = useSmt<GroupSetsResponse>(`/api/group/sets?${q}`, null);
  const asked = wayBack(sp.get("returnTo"), null);
  const back = asked.fallback ? { returnTo: `/teacher/group/overview?account=${encodeURIComponent(account)}`, fallback: true, label: "Back to Overview" } : asked;
  return (
    <main id="teacher-root" data-theme={theme} ref={ref} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={groupDashVars(theme)}>
      <div className={phone ? "px-4 py-3" : "mx-auto max-w-[1180px] px-7 py-5"}>
        <SetsWayBack back={back} phone={phone} />
        {load.status !== "ready" ? (
          <p className="py-6 text-[13px] text-[var(--muted2)]">{load.status === "loading" ? "Loading the group's sets…" : load.code === 404 ? "Sets of groups are kept by the group's head office." : load.message}</p>
        ) : (
          <Library d={load.data} back={back.returnTo} onChanged={() => setV((n) => n + 1)} phone={phone} />
        )}
      </div>
    </main>
  );
}

function Library({ d, back, onChanged, phone }: { d: GroupSetsResponse; back: string; onChanged: () => void; phone: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const acc = d.viewer.accountId;
  const client = () => createBrowserSupabaseClient();
  const run = (fn: () => Promise<string | null>) => async () => {
    setBusy(true);
    setError(null);
    const e = await fn();
    setBusy(false);
    if (e) setError(e);
    else onChanged();
  };
  const returnTo = typeof window === "undefined" ? "/sets" : `${window.location.pathname}${window.location.search}`;
  const pageFor = (s: GroupSetRow) => {
    const u = new URL(back, "https://x.invalid");
    const page = s.kind === "group_peers" ? (/(overview|academic|pupils)$/.test(u.pathname) ? u.pathname : "/teacher/group/overview") : u.pathname.startsWith("/teacher/group/") && !u.pathname.startsWith("/teacher/group/groups") ? u.pathname : "/teacher/group/schools";
    const q = new URLSearchParams(u.search);
    q.set("account", acc);
    q.set(s.kind === "group_peers" ? "compare" : "showing", `set:${s.id}`);
    return `${page}?${q}`;
  };
  const row = (s: GroupSetRow) => {
    const mine = s.scope === "personal";
    const canChange = d.can.keep && (mine || d.can.admin);
    const isDefault = d.defaults[s.kind] === s.id;
    const btn = `inline-flex items-center rounded-full border border-[var(--panel-border2)] px-3 text-[12px] font-bold disabled:opacity-50 ${phone ? "min-h-[40px]" : "min-h-[28px]"}`;
    return (
      <div key={s.id} data-group-set-row={s.id} className={`flex flex-wrap items-center gap-2 border-t border-[var(--panel-border)] py-2 ${s.archived ? "opacity-60" : ""}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13.5px] font-bold">{s.name}</span>
            <CreatorPill creator={mine ? "me" : "group"} label={mine ? undefined : "Head office"} />
            {isDefault && <span className="rounded-full bg-[var(--adm-tint)] px-2 text-[10.5px] font-bold text-[var(--adm-accent-text)]">Default</span>}
            {s.archived && <span className="text-[11px] text-[var(--muted2)]">archived</span>}
          </div>
          <div className="text-[11.5px] text-[var(--muted2)]">{s.kind === "group_peers" ? groupsWord(s.members.length) : `${s.members.length} school${s.members.length === 1 ? "" : "s"}`}{s.description ? ` · ${s.description}` : ""}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!s.archived && <a href={pageFor(s)} className={btn}>Use</a>}
          <a href={groupEditorHref({ account: acc, kind: s.kind, set: s.id, returnTo })} className={btn}>{canChange ? "Edit" : "Open"}</a>
          {d.can.keep && !mine && <a href={groupEditorHref({ account: acc, kind: s.kind, members: s.members, name: `${s.name} (copy)`, from: `set:${s.id}`, returnTo })} className={btn} title="A private copy in My sets">Duplicate</a>}
          {d.can.admin && !mine && !s.archived && (isDefault ? <button type="button" disabled={busy} className={btn} onClick={run(() => clearGroupDefault(client(), s.kind, s.id))}>Not the default</button> : <button type="button" disabled={busy} className={btn} onClick={run(() => makeGroupDefault(client(), s.kind, s.id, d.defaults[s.kind]))}>Make default</button>)}
          {d.can.admin && mine && !s.archived && <button type="button" disabled={busy} className={btn} title="Moves it to the group's sets, for everyone in the head office, and frees your slot" onClick={run(() => shareGroupSet(client(), s.id))}>Share with the group</button>}
          {canChange && <button type="button" disabled={busy} className={btn} onClick={run(() => archiveGroupSet(client(), s.kind, s.id, !s.archived))}>{s.archived ? "Restore" : "Archive"}</button>}
          {canChange && <button type="button" disabled={busy} className={btn} onClick={() => window.confirm(`Delete “${s.name}”? This can’t be undone.`) && run(() => deleteGroupSet(client(), s.id))()}>Delete</button>}
        </div>
      </div>
    );
  };
  const section = (kind: GroupSetKind) => {
    const all = d.sets.filter((s) => s.kind === kind && (showArchived || !s.archived));
    const groupSets = all.filter((s) => s.scope === "group");
    const mine = all.filter((s) => s.scope === "personal");
    return (
      <section key={kind} className="flex flex-col gap-1 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3" data-group-sets-section={kind}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-[15px] font-bold">{KIND_WORD[kind].title}</div>
            <div className="text-[12px] text-[var(--muted2)]">{KIND_WORD[kind].sub}</div>
          </div>
          {d.can.keep && !d.notSetUp && <a href={groupEditorHref({ account: acc, kind, returnTo })} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[12.5px] font-bold text-[#1f0f04]">New {kind === "group_peers" ? "set" : "subset"}…</a>}
        </div>
        <div className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Group sets</div>
        {groupSets.length ? groupSets.map(row) : <div className="py-1 text-[12px] text-[var(--muted2)]">None yet.</div>}
        {d.can.keep && (
          <>
            <div className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">My sets <span className="font-semibold normal-case tracking-normal">{d.personalActive} of {d.cap}</span></div>
            {mine.length ? mine.map(row) : <div className="py-1 text-[12px] text-[var(--muted2)]">None yet.</div>}
          </>
        )}
      </section>
    );
  };
  return (
    <div className="mt-2 flex flex-col gap-3" data-group-sets-library="">
      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight">{d.viewer.name}&rsquo;s sets</h1>
        <div className="text-[12.5px] text-[var(--muted2)]">{d.notSetUp ? "Sets of groups aren’t switched on yet: the pages offer the default comparisons." : d.can.keep ? (d.can.admin ? "You curate the group’s sets: Make default sets what the Group pages open on for everyone in the group." : "The group’s sets are curated by its head-office admins; Duplicate makes a copy of your own.") : "Read-only (View as)."}</div>
      </div>
      {error && <div className="rounded-[10px] border border-[var(--adm-down-fg)] px-3 py-2 text-[12.5px] text-[var(--adm-down-fg)]" role="alert">{error}</div>}
      {section("group_peers")}
      {section("group_schools")}
      <label className="flex items-center gap-2 text-[12.5px] text-[var(--muted2)]">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived sets
      </label>
    </div>
  );
}
