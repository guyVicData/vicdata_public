"use client";

// VicData 0.8 sets round 1 (D19, G29): a set, read-only (docs/v0.8/sets_design/set_view.dc.html) -- its
// header, the numbered list of its schools, how close it is (compared-against sets), and where it is
// used. Edit (to the editor; a copy where it isn't yours to change), Use on [dashboard], Duplicate and
// Share. On a phone: stacked, Edit first with the rest under ···, "How close" and "Where used" folded.
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { EditorData, EditorRow } from "@/lib/sets/editor-data";
import { closeness, closenessWords } from "@/lib/sets/closeness";
import { tierOf, type CreatorKind, type SetKind, type Tier } from "@/lib/sets/model";
import { CreatorPill } from "./SetSelector";
import { SetArtwork } from "./SetEditor";

export type ViewedSet = {
  id: string | null;
  key: string; // "set:<id>" or "default:<recipe>"
  name: string;
  description: string | null;
  kind: SetKind;
  entry: string;
  phase: "ks4" | "ks5" | null;
  creator: CreatorKind;
  scope: "school" | "personal" | "default";
  pinned: boolean;
  members: { urn: string; tier: Tier | null }[];
  lastChanged: string | null;
  canChange: boolean;
};

/** Where "Use on …" goes: the dashboard the set is for, with the set in use. */
export function useOn(urn: string, s: ViewedSet): { label: string; href: string } {
  const q = new URLSearchParams();
  if (s.phase) {
    if (s.id) q.set("useSet", s.id);
    return { label: s.phase === "ks5" ? "Use on Post-16" : "Use on GCSE", href: `/teacher/${s.phase}?${q.toString()}` };
  }
  q.set("view", s.kind === "feeders" ? "pipelines" : "market-share");
  q.set("entry", s.entry);
  if (s.id) q.set("useSet", s.id);
  else q.set(s.kind === "feeders" ? "fset" : "rset", s.key);
  void urn;
  return { label: s.kind === "feeders" ? "Use on Pipelines" : "Use on Market share", href: `/teacher/admissions?${q.toString()}` };
}

export function SetView({ urn, schoolName, set, editHref, duplicateHref, phone }: { urn: string; schoolName: string; set: ViewedSet; editHref: string; duplicateHref: string; phone?: boolean }) {
  const [data, setData] = useState<EditorData | null>(null);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const feeders = set.kind === "feeders";
  useEffect(() => {
    (async () => {
      const { data: s } = await createBrowserSupabaseClient().auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const qs = new URLSearchParams({ urn, kind: set.kind, entry: set.entry, urns: set.members.map((m) => m.urn).join(","), n: "1" });
      const r = await fetch(`/api/sets/editor?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setData((await r.json()) as EditorData);
    })();
  }, [urn, set.kind, set.entry, set.members]);
  const byUrn = new Map((data?.rows ?? []).map((r) => [r.urn, r]));
  const rows = set.members.map((m) => ({ m, r: byUrn.get(m.urn) as EditorRow | undefined }));
  const pupils = rows.reduce((a, x) => a + (x.r?.pupils ?? 0), 0);
  const main = set.members.filter((m) => m.tier === "main").length;
  const close = !feeders && data ? closeness(data.focus, data.rows, Number(set.entry.replace(/\D/g, "")) || data.age) : null;
  const words = close ? closenessWords(close, schoolName) : null;
  const use = useOn(urn, set);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote("Link copied.");
    } catch {
      setNote("Couldn't copy the link.");
    }
  };
  const hit = phone ? "min-h-[44px]" : "min-h-[32px]";
  const primary = <a href={editHref} data-view-edit="" className={`inline-flex items-center rounded-[10px] bg-[var(--accent,var(--fg))] px-4 text-[13px] font-bold text-[var(--bg)] ${hit}`}>{set.canChange ? "Edit" : "Edit a copy"}</a>;
  const secondary = [
    <a key="use" href={use.href} className={`inline-flex items-center rounded-[10px] border border-[var(--panel-border2)] px-3 text-[13px] ${hit}`}>{use.label}</a>,
    <a key="dup" href={duplicateHref} className={`inline-flex items-center rounded-[10px] border border-[var(--panel-border2)] px-3 text-[13px] ${hit}`}>Duplicate</a>,
    <button key="share" type="button" onClick={() => void share()} className={`inline-flex items-center rounded-[10px] border border-[var(--panel-border2)] px-3 text-[13px] ${hit}`}>Share</button>,
  ];
  const header = (
    <div className={`flex gap-4 ${phone ? "items-start" : "items-end"}`}>
      <SetArtwork rows={data?.rows ?? []} focus={data?.focus ?? null} kind={set.kind} creator={set.creator} size={phone ? 72 : 132} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--muted2)]">
          <CreatorPill creator={set.creator} />
          <span>
            {feeders ? "Feeder schools" : "Compared against"} · {set.phase ? (set.phase === "ks5" ? "Post-16" : "GCSE") : set.entry} · {set.scope === "school" ? "school set" : set.scope === "personal" ? "my set" : "default set"}
            {set.pinned ? " · pinned" : ""}
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold leading-tight">{set.name}</h1>
        {set.description && <p className="text-[12.5px] text-[var(--chip-fg)]">{set.description}</p>}
        <div className="text-[12px] text-[var(--muted2)]">
          {set.members.length} schools{feeders && main ? ` · ${main} main` : ""} · {pupils.toLocaleString("en-GB")} pupils aged {data?.age ?? "…"}
          {set.lastChanged ? ` · last changed by ${set.lastChanged}` : ""}
        </div>
      </div>
    </div>
  );
  const list = (
    <section data-view-list="" className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">
            <th className="w-[28px] py-1">#</th>
            <th>School</th>
            <th className="text-right">km</th>
            {!phone && <th className="pl-3">Sector</th>}
            {!phone && <th className="pl-3">{feeders ? "Tier" : "Boards"}</th>}
            <th className="text-right">{feeders ? "Aged" : "Pupils at"} {data?.age ?? ""}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, r }, i) => (
            <tr key={m.urn} className="border-t border-[var(--panel-border)]">
              <td className="py-[6px] tabular-nums text-[var(--muted2)]">{i + 1}</td>
              <td className="max-w-[260px] truncate font-semibold">{r?.name ?? m.urn}</td>
              <td className="text-right tabular-nums">{r?.km != null ? r.km.toFixed(1) : "—"}</td>
              {!phone && <td className="pl-3">{r ? (r.sector === "independent" ? "Independent" : "State") : ""}</td>}
              {!phone && <td className="pl-3">{feeders ? (m.tier ? tierOf(m.tier)[0].toUpperCase() + tierOf(m.tier).slice(1) : "Untiered") : r ? (r.boarding ? "Yes" : "No") : ""}</td>}
              <td className="text-right tabular-nums">{r?.pupils ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pt-2 text-[11px] text-[var(--muted2)]">Read-only here. Edit opens the editor; on a set you can&rsquo;t change, it opens a copy to save as your own.</p>
    </section>
  );
  const closeBody = words ? (
    <div className="flex flex-col gap-2 text-[12.5px]">
      <div><div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Distance</div>{words.distance}</div>
      <div><div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Results · {close!.results.startsOn === "post16" ? "Post-16" : "GCSE"}</div>{words.results}</div>
      <div><div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Pupil population</div>{words.population}</div>
    </div>
  ) : null;
  const whereBody = (
    <div className="text-[12.5px]">
      <p>{feeders ? `Pipelines at ${set.entry} for Admissions. Not shown in Teacher.` : set.phase ? `Teacher's ${set.phase === "ks5" ? "Post-16" : "GCSE"} pages${set.scope === "school" ? " for everyone at the school" : ""}.` : `Market share at ${set.entry}${set.scope === "school" ? ` for everyone at ${schoolName}` : ""}.${set.entry === "11+" || set.entry === "16+" ? ` Teachers see it on ${set.entry === "11+" ? "GCSE" : "Post-16"} pages under School sets.` : ""}`}</p>
      <p className="text-[var(--muted2)]">Editable by {set.scope === "personal" ? "you" : set.scope === "default" ? "no one: save a copy as your own" : feeders ? "Admissions" : "SMT, Admissions and the School-Admin"}.</p>
    </div>
  );
  if (phone)
    return (
      <div data-set-view="phone" className="flex flex-col gap-4 px-4 py-4">
        {header}
        <div className="flex items-center gap-2">
          {primary}
          <span className="relative">
            <button type="button" aria-label="More actions" aria-expanded={more} onClick={() => setMore((m) => !m)} className="min-h-[44px] min-w-[44px] rounded-[10px] border border-[var(--panel-border2)] px-3 text-[13px]">···</button>
            {more && <span className="absolute left-0 top-[calc(100%+4px)] z-40 flex w-[220px] flex-col gap-1 rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-2 shadow-xl">{secondary}</span>}
          </span>
        </div>
        {note && <p role="status" className="text-[12px]">{note}</p>}
        {list}
        {closeBody && (
          <details data-view-close="" className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
            <summary className="min-h-[44px] cursor-pointer text-[14px] font-bold leading-[44px]">How close is this set to {schoolName}?</summary>
            {closeBody}
          </details>
        )}
        <details data-view-where="" className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
          <summary className="min-h-[44px] cursor-pointer text-[14px] font-bold leading-[44px]">Where this set is used</summary>
          {whereBody}
        </details>
      </div>
    );
  return (
    <div data-set-view="desktop" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {header}
        <div className="flex flex-wrap items-center gap-2">{primary}{secondary}</div>
      </div>
      {note && <p role="status" className="text-[12px]">{note}</p>}
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">{list}</div>
        <div className="flex w-[340px] shrink-0 flex-col gap-4">
          {closeBody && (
            <section data-view-close="" className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
              <h2 className="mb-2 text-[14px] font-bold">How close is this set to {schoolName}?</h2>
              {closeBody}
            </section>
          )}
          <section data-view-where="" className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
            <h2 className="mb-2 text-[14px] font-bold">Where this set is used</h2>
            {whereBody}
          </section>
        </div>
      </div>
    </div>
  );
}
