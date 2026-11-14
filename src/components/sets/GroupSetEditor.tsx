"use client";

// VicData 0.8 group sets, M4 and M5 (brief v2 §5.4, §6; Guy's D2, D6, D8): the set editor in group mode,
// opened as /sets/edit?account=<group account>&kind=group_peers|group_schools&returnTo=<page>
//   &set=<id>                   edit a stored set (a copy if you can't change it)
//   &groups=a,b | &urns=1,2     a copy of a set of groups (nearest in size, an unsaved set, Duplicate) or
//                               a new set with these in it (the library's Add to set…)
//   &name=…&from=<key>          its starting name, and where it came from
// Laid out like the school editor (a playlist): the header (artwork, name, description, creator, count),
// then the list -- a tick means "in the set", unticking greys a row until Save. Rows are GROUPS (type,
// size, regions, headline) for a comparison set, or the group's own SCHOOLS for a subset (current members
// only; likely members offered and labelled; a school that has left is shown greyed, dropping out).
// "Add groups" opens the groups library as a sheet, filtered to groups like us; at 8 a further tick is
// refused ("8 is the most a set holds", GROUP_SET_CAP). Back, Cancel and Save leave the same way
// (R-SETS-WAY-BACK: leaveEditor). Everything is saved under the member's own session; View as and a peek
// open it read-only. School sets keep their own editor (SetEditor.tsx), unchanged. R-GROUP-SET-PICKER,
// R-GROUP-SUBSET-FILTER, R-SETS-WAY-BACK.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { useWidth } from "@/components/admissions/views/charts";
import { groupDashVars } from "@/components/groups/dash/GroupDashboard";
import { RegionArtwork } from "@/components/groups/library/GroupLibrary";
import { useSmt } from "@/components/smt/api";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { leaveEditor } from "@/lib/sets/editor-return";
import { returnLabel, safeReturnTo } from "@/lib/sets/return-to";
import { archiveGroupSet, deleteGroupSet, makeGroupDefault, ownerOf, saveGroupSet, shareGroupSet } from "@/lib/sets/group-store";
import { CAP_WORDS, GROUP_SET_CAP, groupSaveMode, groupsWord, isUuid, namedList, type GroupSaveMode, type GroupSetKind, type GroupSetRow } from "@/lib/groups/group-sets";
import { DEFAULT_FILTER, headlineWords, libraryCards, phaseWords, regionWords, typeAndSize, type IndexCard } from "@/lib/groups/library";
import { cardFsmWords, familyOf, sameFamily, schoolsByKindWords, setRefusal } from "@/lib/groups/non-mainstream";
import { displayName } from "@/lib/groups/dash";
import { BackButton } from "./SetEditor";
import { CreatorPill } from "./SetSelector";

const PHONE = 600;

export type GroupSetsResponse = {
  viewer: { as: "head_office" | "view_as"; accountId: string; groupId: string; name: string; userId: string };
  source: "production" | "fixtures";
  can: { keep: boolean; admin: boolean };
  sets: GroupSetRow[];
  notSetUp: boolean;
  personalActive: number;
  cap: number;
  defaults: { group_peers: string | null; group_schools: string | null };
  us: IndexCard | null;
  cards?: IndexCard[];
  schools?: { urn: string; name: string; la: string | null; phases: string[]; roll: number | null; likely: boolean; current: boolean; counted: boolean }[];
};

type Item = { id: string; ticked: boolean };
type Mode = GroupSaveMode;

/** The page-level loader: reads the group's sets (and the rows it needs) and opens the editor. */
export function GroupSetEditorLoader() {
  const sp = useSearchParams();
  const [theme] = useTeacherTheme();
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < PHONE;
  const account = sp.get("account") ?? "";
  const kind: GroupSetKind = sp.get("kind") === "group_schools" ? "group_schools" : "group_peers";
  const q = new URLSearchParams({ account, with: kind === "group_peers" ? "cards" : "schools" });
  for (const k of ["lookAs", "as", "peek"]) if (sp.get(k)) q.set(k, sp.get(k)!);
  const load = useSmt<GroupSetsResponse>(`/api/group/sets?${q}`, null);
  const asked = safeReturnTo(sp.get("returnTo"));
  const returnFallback = !asked;
  const returnTo = asked ?? `/teacher/group/${kind === "group_schools" ? "schools" : "overview"}?account=${encodeURIComponent(account)}`;
  const groupName = load.status === "ready" ? load.data.viewer.name : "the group";
  const label = returnLabel(returnTo, { kind, entry: "", phase: null, product: "group", urn: "", schoolName: groupName });
  return (
    <main id="teacher-root" data-theme={theme} ref={rootRef} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={groupDashVars(theme)}>
      <div className={phone ? "" : "mx-auto max-w-[1180px] px-7 py-5"}>
        {load.status !== "ready" ? (
          <div className={phone ? "px-4 pt-3" : ""}>
            <BackButton label={label} onClick={() => leaveEditor(returnTo, returnFallback)} phone={phone} />
            <p className="p-6 text-[13px] text-[var(--muted2)]">{load.status === "loading" ? "Loading…" : load.code === 404 ? "Sets of groups are kept by the group's head office." : load.message}</p>
          </div>
        ) : (
          <GroupSetEditor d={load.data} kind={kind} setId={sp.get("set")} members={sp.get(kind === "group_peers" ? "groups" : "urns")} startName={sp.get("name")} from={sp.get("from")} returnTo={returnTo} returnFallback={returnFallback} returnLabel={label} phone={phone} />
        )}
      </div>
    </main>
  );
}

export function GroupSetEditor(p: { d: GroupSetsResponse; kind: GroupSetKind; setId: string | null; members: string | null; startName: string | null; from: string | null; returnTo: string; returnFallback: boolean; returnLabel: string; phone: boolean }) {
  const { d, kind, phone } = p;
  const peers = kind === "group_peers";
  const set = p.setId && isUuid(p.setId) ? (d.sets.find((s) => s.id === p.setId && s.kind === kind) ?? null) : null;
  const readOnly = !d.can.keep || d.notSetUp;
  const copy = !set && !!p.from;
  const mode: Mode = readOnly ? "copy" : groupSaveMode(set, { userId: d.viewer.userId, admin: d.can.admin, copy });
  const startMembers = useMemo(() => set?.members ?? (p.members ? (peers ? namedList(p.members) : p.members.split(",").filter((u) => /^\d{5,7}$/.test(u))) : []), [set, p.members, peers]);
  const startName = set?.name ?? p.startName ?? (peers ? "New set of groups" : "New subset");
  const [name, setName] = useState(startName);
  const [description, setDescription] = useState(set?.description ?? "");
  // R-NM-SETS: a group of another family than ours (mainstream, special and AP, nursery) never stays in
  // the set: it starts unticked, and the note says why.
  const otherFamily = (id: string) => peers && !!setRefusal(d.us?.kind, (d.cards ?? []).find((c) => c.group_id === id)?.kind);
  const [items, setItems] = useState<Item[]>(() => startMembers.filter((m) => m !== d.viewer.groupId).map((id) => ({ id, ticked: !otherFamily(id) })));
  const [sheet, setSheet] = useState(false);
  const [search, setSearch] = useState("");
  const [likeUs, setLikeUs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(() => {
    const id = startMembers.find((m) => m !== d.viewer.groupId && otherFamily(m));
    const c = id ? (d.cards ?? []).find((x) => x.group_id === id) : null;
    return c ? setRefusal(d.us?.kind, c.kind, displayName(c.name)) : null;
  });
  const [saveAs, setSaveAs] = useState<null | { name: string; owner: "personal" | "group" }>(null);
  const [menu, setMenu] = useState(false);
  const leaving = useRef(false);

  const cards = useMemo(() => new Map((d.cards ?? []).map((c) => [c.group_id, c])), [d.cards]);
  const schools = useMemo(() => new Map((d.schools ?? []).map((s) => [s.urn, s])), [d.schools]);
  const ticked = items.filter((x) => x.ticked);
  const dirty = JSON.stringify(ticked.map((x) => x.id)) !== JSON.stringify(startMembers) || name !== startName || (description || "") !== (set?.description ?? "");
  const creator = set ? (set.scope === "group" ? "group" : "me") : copy ? "default" : "me";

  const leave = (savedId?: string) => {
    leaving.current = true;
    leaveEditor(p.returnTo, p.returnFallback, savedId);
  };
  useEffect(() => {
    if (!dirty || readOnly) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty, readOnly]);
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [sheet]);

  // A tick means "in the set"; at the cap a further tick is refused (sets of groups).
  const toggle = (id: string) => {
    setNote(null);
    const refusedCard = peers ? (d.cards ?? []).find((c) => c.group_id === id) : null;
    const refused = refusedCard ? setRefusal(d.us?.kind, refusedCard.kind, displayName(refusedCard.name)) : null;
    if (refused && !items.find((y) => y.id === id)?.ticked) return setNote(refused);
    setItems((it) => {
      const x = it.find((y) => y.id === id);
      const on = it.filter((y) => y.ticked).length;
      if (x) {
        if (!x.ticked && peers && on >= GROUP_SET_CAP) {
          setNote(CAP_WORDS);
          return it;
        }
        return it.map((y) => (y.id === id ? { ...y, ticked: !y.ticked } : y));
      }
      if (peers && on >= GROUP_SET_CAP) {
        setNote(CAP_WORDS);
        return it;
      }
      return [...it, { id, ticked: true }];
    });
  };

  const client = () => createBrowserSupabaseClient();
  const members = () => ticked.map((x) => x.id);
  const save = async () => {
    if (mode !== "save" || !set) return;
    setBusy(true);
    setError(null);
    const r = await saveGroupSet(client(), set.id, kind, { name: name.trim() || startName, description: description.trim() || null }, members());
    setBusy(false);
    if ("error" in r) return setError(r.error);
    leave(r.id);
  };
  const saveNew = async (owner: "personal" | "group", asName: string) => {
    if (owner === "personal" && d.personalActive >= d.cap) return setError("You have 8 active sets of your own. Archive one to free a slot.");
    setBusy(true);
    setError(null);
    const r = await saveGroupSet(client(), null, kind, { name: asName.trim() || name.trim() || "My set", description: description.trim() || null, ...ownerOf(owner, d.viewer.accountId, d.viewer.userId) }, members());
    setBusy(false);
    if ("error" in r) return setError(r.error);
    leave(r.id);
  };
  const act = async (fn: () => Promise<string | null>, after: "leave" | "reload") => {
    setMenu(false);
    setBusy(true);
    const e = await fn();
    setBusy(false);
    if (e) return setError(e);
    if (after === "leave") leave();
    else window.location.reload();
  };

  // Rows.
  const groupRow = (id: string) => {
    const c = cards.get(id);
    if (!c) return { title: id, lines: ["Not a listed group now: it keeps its place, with no figures."] };
    const ts = typeAndSize(c);
    if (familyOf(c.kind) !== "mainstream") return { title: displayName(c.name), lines: [`${ts.line} · ${schoolsByKindWords(c.schools_by_kind)} · ${regionWords(c)}`, cardFsmWords(c)] };
    return { title: displayName(c.name), lines: [`${ts.line}${ts.likely ? ` · ${ts.likely}` : ""} · ${regionWords(c)}`, headlineWords(c, "all").text] };
  };
  const schoolRow = (urn: string) => {
    const s = schools.get(urn);
    if (!s) return { title: urn, lines: ["Not one of the group's schools."], left: true, likely: false, counted: true };
    return { title: s.name, lines: [[s.la, s.phases.join(", "), s.roll !== null ? `${s.roll.toLocaleString("en-GB")} pupils` : null].filter(Boolean).join(" · ")], left: !s.current, likely: s.likely, counted: s.counted };
  };
  const leftCount = peers ? 0 : ticked.filter((x) => !schools.get(x.id)?.current).length;
  const hit = phone ? "min-h-[44px]" : "min-h-[32px]";
  const btn = `rounded-full border border-[var(--panel-border2)] px-4 text-[13px] font-bold disabled:opacity-50 ${hit}`;
  const primary = `rounded-full bg-[var(--accent)] px-4 text-[13px] font-bold text-[#1f0f04] disabled:opacity-50 ${hit}`;

  // The library as a sheet (groups like us first), or the group's schools not yet in the subset.
  const inSet = new Set(ticked.map((x) => x.id));
  const offered = peers
    ? libraryCards(sameFamily(d.us?.kind, d.cards ?? []), d.us, { ...DEFAULT_FILTER, section: familyOf(d.us?.kind) === "mainstream" ? "mainstream" : "nm", likeUs: likeUs && !!d.us, search, sort: likeUs && d.us ? "like_us" : "size" }).slice(0, 60)
    : (d.schools ?? []).filter((s) => s.current && (!search || s.name.toLowerCase().includes(search.toLowerCase())));

  const regionsOfSet: Record<string, number> = {};
  if (peers) for (const x of ticked) for (const [r, n] of Object.entries(cards.get(x.id)?.regions ?? {})) regionsOfSet[r] = (regionsOfSet[r] ?? 0) + n;
  const countWord = peers ? groupsWord(ticked.length) : `${ticked.length} school${ticked.length === 1 ? "" : "s"}`;

  return (
    <div className={`flex flex-col gap-3 ${phone ? "px-4 pb-24 pt-3" : ""}`} data-group-set-editor={kind}>
      <BackButton label={p.returnLabel} onClick={() => (dirty && !readOnly && !window.confirm("Leave without saving? Your changes to this set will be lost.") ? undefined : leave())} phone={phone} />
      <header className="flex flex-wrap gap-4 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
        {peers ? <RegionArtwork regions={regionsOfSet} size={phone ? 72 : 112} label="Where the set's groups' schools are" /> : <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[12px] bg-[var(--box-bg)] text-[30px] font-extrabold text-[var(--accent)]">{ticked.length}</div>}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} aria-label="Set name" className="w-full rounded-[8px] border border-transparent bg-transparent text-[20px] font-extrabold tracking-tight hover:border-[var(--panel-border2)] focus:border-[var(--panel-border2)]" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} placeholder={peers ? "Why these groups" : "Why these schools"} aria-label="Description" className="w-full rounded-[8px] border border-transparent bg-transparent text-[13px] text-[var(--muted)] placeholder:text-[var(--muted2)] hover:border-[var(--panel-border2)] focus:border-[var(--panel-border2)]" />
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted2)]">
            <CreatorPill creator={creator} label={creator === "group" ? "Head office" : creator === "default" ? "Copy" : undefined} />
            <span>{peers ? "Compared against · a set of groups" : `Showing · a subset of ${d.viewer.name}’s schools`}</span>
            <span className="font-semibold text-[var(--fg)]">{countWord}{peers ? ` of ${GROUP_SET_CAP} at most` : ""}</span>
            {set && d.defaults[kind] === set.id && <span className="rounded-full bg-[var(--adm-tint)] px-2 font-bold text-[var(--adm-accent-text)]">The group&rsquo;s default</span>}
          </div>
          {readOnly && <div className="text-[12px] text-[var(--muted2)]">{d.notSetUp ? "Sets of groups aren’t switched on yet." : "In View as, sets are read-only."}</div>}
          {mode === "copy" && !readOnly && <div className="text-[12px] text-[var(--muted2)]">{set ? "A group set: only the head office’s admins change it. Save a copy as your own." : "A copy: save it as a set to keep it."}</div>}
        </div>
        {!readOnly && !phone && (
          <div className="flex flex-wrap items-start gap-2">
            {mode === "save" && <button type="button" onClick={save} disabled={busy} className={primary}>Save</button>}
            <button type="button" onClick={() => setSaveAs({ name: mode === "save" ? `${name} (copy)` : name, owner: d.can.admin && mode !== "save" ? "group" : "personal" })} disabled={busy} className={mode === "save" ? btn : primary}>{mode === "save" ? "Save as…" : "Save as a set…"}</button>
            <button type="button" onClick={() => leave()} className={btn}>Cancel</button>
            {set && <button type="button" aria-label="More" onClick={() => setMenu(!menu)} className={btn}>···</button>}
          </div>
        )}
      </header>

      {menu && set && (
        <div className="flex flex-wrap gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-2 text-[12.5px]" data-editor-menu="">
          {set.scope === "personal" && d.can.admin && <button type="button" className={btn} onClick={() => act(() => shareGroupSet(client(), set.id), "leave")} title="Moves it to the group's sets and frees your slot">Share with the group</button>}
          {set.scope === "group" && d.can.admin && d.defaults[kind] !== set.id && <button type="button" className={btn} onClick={() => act(() => makeGroupDefault(client(), kind, set.id, d.defaults[kind]), "reload")}>Make default</button>}
          {(mode === "save") && <button type="button" className={btn} onClick={() => act(() => archiveGroupSet(client(), kind, set.id, true), "leave")}>Archive</button>}
          {(mode === "save") && <button type="button" className={btn} onClick={() => window.confirm(`Delete “${set.name}”? This can’t be undone.`) && act(() => deleteGroupSet(client(), set.id), "leave")}>Delete</button>}
        </div>
      )}

      {error && <div className="rounded-[10px] border border-[var(--adm-down-fg)] px-3 py-2 text-[12.5px] text-[var(--adm-down-fg)]" role="alert">{error}</div>}
      {note && <div className="rounded-[10px] border border-[var(--panel-border2)] px-3 py-2 text-[12.5px] font-semibold" role="status" data-cap-note="">{note}</div>}
      {leftCount > 0 && <div className="text-[12.5px] text-[var(--muted)]" data-left-note="">{leftCount} school{leftCount === 1 ? " has" : "s have"} left the group since this set was made: {leftCount === 1 ? "it drops" : "they drop"} out of the filter.</div>}

      <section className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-[13px] font-bold">{peers ? "Groups in the set" : "Schools in the subset"}</div>
          {!readOnly && <button type="button" onClick={() => setSheet(true)} className={btn} data-add-groups="">{peers ? "Add groups" : "Add schools"}</button>}
        </div>
        {items.length === 0 && <div className="py-4 text-[12.5px] text-[var(--muted2)]">{peers ? "No groups yet. Add groups from the library." : "No schools yet. Add the group's schools."}</div>}
        {items.map((x) => {
          const r = peers ? groupRow(x.id) : schoolRow(x.id);
          const s = !peers ? (r as ReturnType<typeof schoolRow>) : null;
          return (
            <div key={x.id} data-editor-row={x.id} data-ticked={x.ticked ? "1" : "0"} className={`flex items-center gap-2 border-t border-[var(--panel-border)] py-1.5 ${x.ticked && !s?.left ? "" : "opacity-50"}`}>
              <label className={`flex shrink-0 cursor-pointer items-center justify-center ${phone ? "h-[44px] w-[44px]" : "w-[28px]"}`}>
                <input type="checkbox" checked={x.ticked} disabled={readOnly} onChange={() => toggle(x.id)} aria-label={`${r.title} in the set`} className="h-[16px] w-[16px] accent-[var(--accent)]" />
              </label>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">
                  {r.title}
                  {s?.likely && <span className="ml-1.5 rounded-[5px] bg-[var(--group-likely-bg)] px-[6px] text-[10px] font-bold text-[var(--group-likely-fg)]">likely</span>}
                  {s && !s.counted && <span className="ml-1.5 text-[10.5px] font-semibold text-[var(--muted2)]">not in group figures</span>}
                </div>
                {r.lines.map((l) => <div key={l} className="truncate text-[11.5px] text-[var(--muted2)]">{l}</div>)}
                {s?.left && <div className="text-[11px] text-[var(--muted2)]">left the group: drops out of the filter</div>}
                {!x.ticked && <div className="text-[11px] text-[var(--muted2)]">unticked, leaves on save</div>}
              </div>
            </div>
          );
        })}
      </section>

      {phone && !readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
          {mode === "save" && <button type="button" onClick={save} disabled={busy} className={`flex-1 ${primary}`}>Save</button>}
          <button type="button" onClick={() => setSaveAs({ name: mode === "save" ? `${name} (copy)` : name, owner: d.can.admin && mode !== "save" ? "group" : "personal" })} disabled={busy} className={`flex-1 ${mode === "save" ? btn : primary}`}>{mode === "save" ? "Save as…" : "Save as a set…"}</button>
          {set && <button type="button" aria-label="More" onClick={() => setMenu(!menu)} className={btn}>···</button>}
        </div>
      )}

      {saveAs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Save as a set">
          <div className="flex w-full max-w-[420px] flex-col gap-3 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
            <div className="text-[15px] font-bold">Save as a set</div>
            <input value={saveAs.name} onChange={(e) => setSaveAs({ ...saveAs, name: e.target.value })} aria-label="Name" className="h-[40px] rounded-[8px] border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 text-[13px]" />
            <div className="flex flex-col gap-1 text-[13px]">
              <label className="flex items-center gap-2"><input type="radio" checked={saveAs.owner === "personal"} onChange={() => setSaveAs({ ...saveAs, owner: "personal" })} /> My sets <span className="text-[var(--muted2)]">({d.personalActive} of {d.cap})</span></label>
              {d.can.admin && <label className="flex items-center gap-2"><input type="radio" checked={saveAs.owner === "group"} onChange={() => setSaveAs({ ...saveAs, owner: "group" })} /> Group sets <span className="text-[var(--muted2)]">(everyone in the head office sees it)</span></label>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setSaveAs(null)}>Cancel</button>
              <button type="button" className={primary} disabled={busy} onClick={() => saveNew(saveAs.owner, saveAs.name)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:items-center md:justify-center md:p-6" onClick={() => setSheet(false)} role="dialog" aria-modal="true" aria-label={peers ? "Add groups" : "Add schools"} data-add-sheet="">
          <div className="flex max-h-[85vh] w-full flex-col gap-2 rounded-t-[16px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 md:max-w-[880px] md:rounded-[16px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[15px] font-bold">{peers ? "Add groups from the library" : `Add ${d.viewer.name}’s schools`}</div>
              <button type="button" onClick={() => setSheet(false)} className={btn}>Done</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={peers ? "Search groups by name" : "Search schools"} aria-label="Search" className="h-[38px] min-w-0 flex-1 rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] px-4 text-[13px]" />
              {peers && d.us && <button type="button" aria-pressed={likeUs} onClick={() => setLikeUs(!likeUs)} className={`rounded-full border px-3 text-[12.5px] font-bold ${hit} ${likeUs ? "border-[var(--accent)]" : "border-[var(--panel-border2)] text-[var(--muted2)]"}`}>Groups like us</button>}
              {peers && <span className="text-[12px] text-[var(--muted2)]">{ticked.length} of {GROUP_SET_CAP}</span>}
            </div>
            {note && <div className="text-[12.5px] font-semibold" role="status">{note}</div>}
            {familyOf(d.us?.kind) !== "mainstream" && <div className="text-[12px] text-[var(--muted2)]" data-set-family="">Only {familyOf(d.us?.kind) === "nursery" ? "nursery federations" : "special and AP trusts"} can be in a set with {d.viewer.name}: they are compared only with each other.</div>}
            <div className="min-h-0 overflow-y-auto">
              {peers
                ? (offered as IndexCard[]).map((c) => (
                    <div key={c.group_id} className="flex items-center gap-3 border-t border-[var(--panel-border)] py-2" data-sheet-group={c.group_id}>
                      <RegionArtwork regions={c.regions} size={40} label={regionWords(c)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{displayName(c.name)}</div>
                        <div className="truncate text-[11.5px] text-[var(--muted2)]">{typeAndSize(c).line} · {regionWords(c)} · {familyOf(c.kind) === "mainstream" ? phaseWords(c) : schoolsByKindWords(c.schools_by_kind)}</div>
                        <div className="truncate text-[11.5px]">{familyOf(c.kind) === "mainstream" ? headlineWords(c, "all").text : cardFsmWords(c)}</div>
                      </div>
                      <button type="button" aria-pressed={inSet.has(c.group_id)} onClick={() => toggle(c.group_id)} className={`shrink-0 rounded-full border px-3 text-[12px] font-bold ${hit} ${inSet.has(c.group_id) ? "border-[var(--accent)]" : "border-[var(--panel-border2)]"}`}>{inSet.has(c.group_id) ? "✓ In the set" : "Add"}</button>
                    </div>
                  ))
                : (offered as NonNullable<GroupSetsResponse["schools"]>).map((s) => (
                    <div key={s.urn} className="flex items-center gap-3 border-t border-[var(--panel-border)] py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{s.name}{s.likely && <span className="ml-1.5 rounded-[5px] bg-[var(--group-likely-bg)] px-[6px] text-[10px] font-bold text-[var(--group-likely-fg)]">likely</span>}</div>
                        <div className="truncate text-[11.5px] text-[var(--muted2)]">{[s.la, s.phases.join(", "), s.roll !== null ? `${s.roll.toLocaleString("en-GB")} pupils` : null].filter(Boolean).join(" · ")}</div>
                      </div>
                      <button type="button" aria-pressed={inSet.has(s.urn)} onClick={() => toggle(s.urn)} className={`shrink-0 rounded-full border px-3 text-[12px] font-bold ${hit} ${inSet.has(s.urn) ? "border-[var(--accent)]" : "border-[var(--panel-border2)]"}`}>{inSet.has(s.urn) ? "✓ In the subset" : "Add"}</button>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
