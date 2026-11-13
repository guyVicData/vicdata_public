"use client";

// VicData 0.8 sets round 1 (D18, D21, G28): the library at /sets (docs/v0.8/sets_design/library.dc.html).
//   Sidebar   All sets, Default, School sets, My sets ("n of 8"), Archived; then folders, + New folder
//   Top row   search (a set, or a school in it), All · Compared against · Feeder schools, the entry
//             points, sort (recently used, A-Z, size)
//   Pinned    the school's pinned sets as tiles: map artwork, the kind's icon in the creator's colour,
//             a creator stripe
//   All sets  a table: the kind's icon in the creator's colour, the name, a creator pill, schools, last
//             used, Open, and ··· (Edit, Duplicate, Pin to menu, Move to folder, Share, Propose as school
//             set, Archive)
// On a phone: the sidebar becomes tabs (All, Default, School, Mine, Archived) with folders in a sheet;
// the filters wrap under the search; pinned sets scroll sideways; every set is a card with a ··· sheet.
import { useEffect, useMemo, useState } from "react";
import { returnToHere, savedSetFromEditor, useEditorReturnReload } from "@/lib/sets/editor-return";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { saveSet } from "@/lib/sets/store";
import type { LibraryData } from "@/lib/sets/library";
import { filterLibrary, foldersOf, makerOf, MAKER_WORD, MAKERS, sectionCounts, sortLibrary, usedWords, type LibraryFilter, type LibraryItem, type LibrarySection, type LibrarySort, type Maker } from "@/lib/sets/library-view";
import type { SetKind } from "@/lib/sets/model";
import { KindIcon } from "./SetSelector";
import { SetsWayBack } from "./SetsShell";

const KIND_WORD: Record<SetKind, string> = { compared_against: "Compared against", feeders: "Feeder schools" };
// D23: the sidebar's coloured markers (the sections a maker owns).
const SECTION_MARKER: Partial<Record<LibrarySection, Maker>> = { default: "default", school: "school", mine: "mine" };

export function libraryItems(d: LibraryData): LibraryItem[] {
  const stored: LibraryItem[] = d.stored.map((s) => ({
    key: `set:${s.id}`,
    id: s.id,
    name: s.name,
    description: s.description,
    kind: s.kind,
    entry: s.entryPoint,
    phase: s.phase,
    block: s.ownerScope === "personal" ? "mine" : "school",
    creator: s.creatorKind,
    count: s.members.length,
    urns: s.members.map((m) => m.urn),
    pinned: s.pinned,
    archived: s.archived,
    lastUsedAt: d.lastUsed[s.id] ?? null,
    folder: d.folders[s.id] ?? s.folder ?? null,
    schoolNames: s.members.map((m) => d.names[m.urn] ?? m.urn),
    canChange: s.ownerScope === "personal" ? s.ownerProfileId === d.profileId : d.curates[s.kind],
  }));
  const defaults: LibraryItem[] = d.defaults.map((r) => ({
    key: `default:${r.key}@${r.entryPoint}`,
    id: null,
    name: r.name,
    description: r.how,
    kind: r.kind,
    entry: r.entryPoint,
    phase: null,
    block: "default",
    creator: "default",
    count: r.count,
    urns: r.urns,
    pinned: false,
    archived: false,
    lastUsedAt: d.lastUsed[`default:${r.key}`] ?? d.lastUsed[r.key] ?? null,
    folder: d.folders[`default:${r.key}`] ?? null,
    schoolNames: [],
    canChange: false,
  }));
  return [...defaults, ...stored];
}

/** Where a set opens: a stored set's read-only view; a default set's view from its schools. `returnTo`
 * (the dashboard the library was opened from) goes with it, so the set view offers the same way back;
 * a shared link leaves it out. */
export function viewHref(urn: string, x: LibraryItem, returnTo?: string | null): string {
  const back = returnTo ? `&${new URLSearchParams({ returnTo })}` : "";
  if (x.id) return `/sets/${x.id}?urn=${urn}${back}`;
  const q = new URLSearchParams({ urn, kind: x.kind, entry: x.entry ?? "11+", from: x.key.replace(/^default:/, "default:").split("@")[0], name: x.name, urns: x.urns.join(",") });
  return `/sets/default?${q.toString()}${back}`;
}

/** The editor for a set (itself, or a copy of a default) or a duplicate of any. Its way back is this
 * page as it stands, filters and all (returnToHere). */
export function editHref(urn: string, x: LibraryItem, duplicate = false): string {
  const q = new URLSearchParams({ urn, kind: x.kind, returnTo: returnToHere(urn, `/sets?urn=${urn}`) });
  if (x.phase) q.set("phase", x.phase);
  else q.set("entry", x.entry ?? "11+");
  if (x.id && !duplicate) q.set("set", x.id);
  else {
    q.set("from", x.id ? `set:${x.id}` : x.key.split("@")[0]);
    q.set("name", duplicate ? `${x.name} (copy)` : x.name);
    q.set("urns", x.urns.join(","));
  }
  return `/sets/edit?${q.toString()}`;
}

// 0.8 front door part 2 (D23): the maker's colour, as a solid gradient (globals.css --maker-*). Mine is an
// outline in the person's phase colour.
export function makerFill(m: Maker, mine: string): { background: string; color: string; border?: string } {
  if (m === "mine") return { background: "transparent", color: mine, border: `1.5px solid ${mine}` };
  return { background: `linear-gradient(140deg, var(--maker-${m}-from), var(--maker-${m}-to))`, color: `var(--maker-${m}-ink)` };
}

/** The set's icon tile: the kind's icon (bars, streams) on its maker's gradient. */
export function MakerTile({ x, size, mine }: { x: Pick<LibraryItem, "creator" | "kind">; size: number; mine: string }) {
  const m = makerOf(x);
  return (
    <span data-maker-tile={m} aria-hidden="true" className="relative flex shrink-0 items-center justify-center rounded-[10px]" style={{ width: size, height: size, ...makerFill(m, mine) }}>
      <KindIcon kind={x.kind} size={Math.round(size * 0.46)} stroke={2} />
    </span>
  );
}

/** "Made by": a solid gradient pill in the maker's colour. */
export function MakerPill({ x, mine }: { x: Pick<LibraryItem, "creator" | "kind">; mine: string }) {
  const m = makerOf(x);
  return (
    <span data-set-creator={x.creator} data-maker={m} className="inline-flex shrink-0 items-center rounded-full px-[8px] text-[10.5px] font-bold leading-[18px]" style={makerFill(m, mine)}>
      {MAKER_WORD[m]}
    </span>
  );
}

export type LibraryBack = { returnTo: string; fallback: boolean; label: string };

export function SetsLibrary({ data, phone, initial, back, phase }: { data: LibraryData; phone?: boolean; initial?: Partial<LibraryFilter>; back?: LibraryBack; phase?: "ks4" | "ks5" | null }) {
  // Mine's outline: the person's phase colour (Post-16 violet when the page that sent them was Post-16).
  const mine = phase === "ks5" ? "var(--maker-mine-post16)" : "var(--maker-mine)";
  const [filter, setFilter] = useState<LibraryFilter>({ section: "all", query: "", kind: "all", entry: null, ...initial });
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [items, setItems] = useState<LibraryItem[]>(() => libraryItems(data));
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [folderFor, setFolderFor] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [foldersSheet, setFoldersSheet] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  // Back from the editor's Save: the set it saved, highlighted and named.
  const [saved] = useState<string | null>(() => savedSetFromEditor());
  const [note, setNote] = useState<string | null>(() => {
    const x = saved ? items.find((i) => i.id === saved) : null;
    return x ? `Saved "${x.name}".` : null;
  });
  const shown = useMemo(() => sortLibrary(filterLibrary(items, filter), sort), [items, filter, sort]);
  const counts = sectionCounts(items);
  const folders = Array.from(new Set([...foldersOf(items), ...(newFolder ? [newFolder] : [])])).sort();
  const pinned = items.filter((x) => x.block === "school" && x.pinned && !x.archived && (filter.kind === "all" || x.kind === filter.kind) && (!filter.entry || x.entry === filter.entry));
  const urn = data.school.urn;
  const hit = phone ? "min-h-[44px]" : "min-h-[30px]";
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  // The filters live in the address too (replaced, never pushed), so the editor's way back returns to
  // the library as it was.
  useEffect(() => {
    const u = new URL(window.location.href);
    const put = (k: string, v: string | null) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    put("section", filter.section === "all" ? null : filter.section);
    put("kind", filter.kind === "all" ? null : filter.kind);
    put("entry", filter.entry);
    put("q", filter.query.trim() || null);
    u.searchParams.delete("phase");
    u.searchParams.delete("useSet");
    const next = `${u.pathname}${u.search}${u.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
  }, [filter]);
  useEditorReturnReload();
  useEffect(() => {
    if (saved) document.querySelector(`[data-library-saved]`)?.scrollIntoView({ block: "nearest" });
  }, [saved]);
  // The way back: the dashboard (returnTo) with the set saved here, when it's the kind that page uses.
  const savedItem = saved ? (items.find((i) => i.id === saved) ?? null) : null;
  const wayBack = back ? <SetsWayBack back={back} phone={phone} set={savedItem ? { id: savedItem.id, kind: savedItem.kind, entry: savedItem.entry, phase: savedItem.phase } : null} /> : null;
  const open = (x: LibraryItem) => viewHref(urn, x, back && !back.fallback ? back.returnTo : null);
  const savedRing = (x: LibraryItem) => (saved && x.id === saved ? { "data-library-saved": "", style: { boxShadow: "inset 0 0 0 2px var(--accent, var(--fg))" } } : {});

  const update = (key: string, patch: Partial<LibraryItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const act = async (x: LibraryItem, what: "pin" | "archive" | "unarchive" | "share" | "propose") => {
    setMenuFor(null);
    setNote(null);
    if (what === "share") {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${viewHref(urn, x)}`);
        setNote(`Link to "${x.name}" copied.`);
      } catch {
        setNote("Couldn't copy the link.");
      }
      return;
    }
    if (!x.id) return;
    if (what === "propose") {
      // A curator copies their own set into the school's sets; anyone else asks a curator.
      const r = await saveSet(supabase, null, { name: x.name, description: x.description, kind: x.kind, entry_point: x.entry, phase: x.phase, focus_urn: urn, owner_scope: "school", school_account_id: data.stored.find((s) => s.id === x.id)?.schoolAccountId ?? null, creator_kind: data.creators[x.kind] ?? "smt", source_recipe: `set:${x.id}`, audience: x.kind === "feeders" ? "day" : null }, x.urns.map((u) => ({ urn: u })));
      setNote("error" in r ? r.error : `"${x.name}" is now a school set.`);
      return;
    }
    const patch = what === "pin" ? { pinned: !x.pinned } : { archived: what === "archive" };
    const r = await saveSet(supabase, x.id, patch, null);
    if ("error" in r) setNote(r.error);
    else update(x.key, patch);
  };
  const moveTo = async (x: LibraryItem, folder: string | null) => {
    setFolderFor(null);
    setMenuFor(null);
    if (!data.profileId) return;
    const key = x.id ?? x.key.split("@")[0];
    const { error } = await supabase.from("set_user_state").upsert({ profile_id: data.profileId, set_key: key, folder: folder?.trim() || null }, { onConflict: "profile_id,set_key" });
    if (error) setNote(error.message);
    else update(x.key, { folder: folder?.trim() || null });
  };

  const menu = (x: LibraryItem) => {
    const btn = (label: string, onClick: () => void, o: { disabled?: boolean; title?: string } = {}) => (
      <button key={label} type="button" role="menuitem" disabled={o.disabled} title={o.title} onClick={onClick} className={`w-full px-3 text-left text-[13px] hover:bg-[var(--box-bg)] disabled:opacity-50 ${hit}`}>
        {label}
      </button>
    );
    return (
      <div role="menu" aria-label={`${x.name}: actions`} className="flex w-[220px] flex-col rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-1 shadow-xl">
        {btn(x.canChange ? "Edit" : "Edit (as a copy)", () => (window.location.href = editHref(urn, x)))}
        {btn("Duplicate", () => (window.location.href = editHref(urn, x, true)))}
        {x.block === "school" && btn(x.pinned ? "Unpin from the menu" : "Pin to menu", () => void act(x, "pin"), { disabled: !x.canChange, title: x.canChange ? undefined : "Curators pin the school's sets" })}
        {btn("Move to folder", () => setFolderFor(x.key), { disabled: !data.profileId })}
        {btn("Share", () => void act(x, "share"))}
        {x.block === "mine" && btn(data.curates[x.kind] ? "Propose as school set" : "Propose as school set · Ask your Admissions lead", () => void act(x, "propose"), { disabled: !data.curates[x.kind], title: data.curates[x.kind] ? "Copy it into the school's sets" : "Ask your Admissions lead" })}
        {x.id && btn(x.archived ? "Unarchive" : "Archive", () => void act(x, x.archived ? "unarchive" : "archive"), { disabled: !x.canChange })}
        {folderFor === x.key && (
          <form
            className="flex gap-1 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              void moveTo(x, folderName);
            }}
          >
            <input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Folder name" aria-label="Folder name" list="set-folders" className={`min-w-0 flex-1 rounded-[6px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 text-[12px] ${hit}`} />
            <button type="submit" className={`rounded-[6px] border border-[var(--panel-border2)] px-2 text-[12px] ${hit}`}>Move</button>
          </form>
        )}
      </div>
    );
  };
  const more = (x: LibraryItem) => (
    <span className="relative">
      <button type="button" aria-label={`More actions for ${x.name}`} aria-expanded={menuFor === x.key} onClick={() => setMenuFor((m) => (m === x.key ? null : x.key))} className={`rounded-[8px] border border-[var(--panel-border2)] px-3 text-[13px] ${phone ? "min-h-[44px] min-w-[44px]" : hit}`}>
        ···
      </button>
      {menuFor === x.key && !phone && <span className="absolute right-0 top-[calc(100%+4px)] z-40">{menu(x)}</span>}
    </span>
  );

  const sections: { id: LibrarySection; label: string; short: string; count: string }[] = [
    { id: "all", label: "All sets", short: "All", count: String(counts.all) },
    { id: "default", label: "Default", short: "Default", count: String(counts.default) },
    { id: "school", label: "School sets", short: "School", count: String(counts.school) },
    { id: "mine", label: "My sets", short: "Mine", count: `${data.personalActive} of ${data.cap}` },
    { id: "archived", label: "Archived", short: "Archived", count: String(counts.archived) },
  ];
  const entryButtons = (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Entry point">
      {data.entries.map((e) => (
        <button key={e} type="button" aria-pressed={filter.entry === e} onClick={() => setFilter((f) => ({ ...f, entry: f.entry === e ? null : e }))} className={`rounded-full border px-3 text-[12px] font-semibold ${hit} ${filter.entry === e ? "border-[var(--accent,var(--fg))]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]"}`}>
          {e}
        </button>
      ))}
    </div>
  );
  const kinds = (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Kind">
      {(["all", "compared_against", "feeders"] as const).map((k) => (
        <button key={k} type="button" aria-pressed={filter.kind === k} onClick={() => setFilter((f) => ({ ...f, kind: k }))} className={`min-w-[44px] rounded-full border px-3 text-[12px] font-semibold ${hit} ${filter.kind === k ? "border-[var(--accent,var(--fg))]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]"}`}>
          <span className="inline-flex items-center gap-1.5">
            {k !== "all" && <KindIcon kind={k} size={14} />}
            {k === "all" ? "All" : KIND_WORD[k]}
          </span>
        </button>
      ))}
    </div>
  );
  const top = (
    <div className={`flex flex-wrap items-center gap-2 ${phone ? "flex-col items-stretch" : ""}`}>
      <input value={filter.query} onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))} placeholder="Search sets, or a school in them" aria-label="Search sets" className={`min-w-[220px] flex-1 rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 text-[13px] ${phone ? "min-h-[44px]" : "min-h-[34px]"}`} />
      <div className="flex flex-wrap items-center gap-2">
        {kinds}
        {entryButtons}
        <label className="flex items-center gap-1 text-[12px] text-[var(--muted2)]">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as LibrarySort)} aria-label="Sort" className={`rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 text-[12px] ${hit}`}>
            <option value="recent">recently used</option>
            <option value="az">A–Z</option>
            <option value="size">size</option>
          </select>
        </label>
      </div>
    </div>
  );
  const tiles = pinned.length ? (
    <section data-library-pinned="" className="flex flex-col gap-2">
      <h2 className="text-[14px] font-bold">Pinned <span className="font-normal text-[var(--muted2)]">· first in everyone&rsquo;s menu</span></h2>
      <div className={phone ? "-mx-4 flex gap-3 overflow-x-auto px-4 pb-1" : "grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3"}>
        {pinned.map((x) => {
          const m = makerOf(x);
          return (
            <a key={x.key} href={open(x)} data-library-tile={x.key} data-maker={m} className={`flex min-h-[44px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] ${phone ? "w-[230px]" : ""}`}>
              <span aria-hidden="true" className="h-[4px] w-full" style={{ background: m === "mine" ? mine : `linear-gradient(90deg, var(--maker-${m}-from), var(--maker-${m}-to))` }} />
              <div className="flex items-center gap-3 px-4 py-4">
                <MakerTile x={x} size={60} mine={mine} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold">{x.name}</div>
                  <div className="text-[12px] text-[var(--muted2)]">{KIND_WORD[x.kind]} · {x.entry ?? (x.phase === "ks5" ? "Post-16" : x.phase === "ks4" ? "GCSE" : "")} · {x.count}</div>
                  <div className="pt-1"><MakerPill x={x} mine={mine} /></div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  ) : null;
  const table = (
    <section data-library-all="" className="min-w-0 overflow-x-auto rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
      <h2 className="mb-2 text-[13px] font-bold">{sections.find((s) => s.id === filter.section)?.label ?? filter.section.slice(7)} <span className="font-normal text-[var(--muted2)]">· {shown.length} shown</span></h2>
      {phone ? (
        <div className="flex flex-col gap-2">
          {shown.map((x) => {
            return (
              <div key={x.key} data-library-card={x.key} {...savedRing(x)} className="flex items-center gap-3 rounded-[10px] border border-[var(--panel-border)] p-2">
                <MakerTile x={x} size={36} mine={mine} />
                <a href={open(x)} className="min-h-[44px] min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{x.name}</div>
                  <div className="flex flex-wrap items-center gap-1 text-[11.5px] text-[var(--muted2)]">
                    <MakerPill x={x} mine={mine} /> {x.count} schools · used {usedWords(x.lastUsedAt)}
                  </div>
                </a>
                {more(x)}
              </div>
            );
          })}
        </div>
      ) : (
        <table className="w-full table-fixed text-[12.5px]">
          <colgroup>
            <col />
            <col style={{ width: 180 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 64 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr className="text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">
              <th className="py-1">Set</th>
              <th>Kind</th>
              <th>Made by</th>
              <th className="text-right">Schools</th>
              <th className="pl-3">Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => {
              return (
                <tr key={x.key} data-library-row={x.key} {...savedRing(x)} className="border-t border-[var(--panel-border)]">
                  <td className="py-[7px]">
                    <div className="flex items-center gap-3">
                      <MakerTile x={x} size={32} mine={mine} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{x.name}</div>
                        {x.description && <div className="truncate text-[11px] text-[var(--muted2)]">{x.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="truncate whitespace-nowrap">{KIND_WORD[x.kind]} · {x.entry ?? (x.phase === "ks5" ? "Post-16" : x.phase === "ks4" ? "GCSE" : "any")}</td>
                  <td><MakerPill x={x} mine={mine} /></td>
                  <td className="text-right tabular-nums">{x.count}</td>
                  <td className="pl-3 text-[var(--muted2)]">{usedWords(x.lastUsedAt)}</td>
                  <td className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <a href={open(x)} className={`inline-flex items-center rounded-[8px] border border-[var(--panel-border2)] px-3 ${hit}`}>Open</a>
                      {more(x)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!shown.length && <p className="py-3 text-[12.5px] text-[var(--muted2)]">No sets here.</p>}
      <datalist id="set-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
    </section>
  );

  const newSet = (
    <a href={`/sets/edit?${new URLSearchParams({ urn, kind: filter.kind === "feeders" ? "feeders" : "compared_against", entry: filter.entry ?? data.entries[0] ?? "11+", returnTo: returnToHere(urn, `/sets?urn=${urn}`) })}`} data-library-new="" style={makerFill("school", mine)} className={`inline-flex items-center rounded-[10px] px-4 text-[13.5px] font-bold ${phone ? "min-h-[44px]" : "min-h-[38px]"}`}>
      + New set
    </a>
  );
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-[12px] text-[var(--muted2)]">{data.school.name}</div>
        <h1 className="text-[20px] font-extrabold">Sets</h1>
      </div>
      {newSet}
    </div>
  );

  if (phone)
    return (
      <div data-sets-library="phone" className="flex flex-col gap-3 px-4 py-4">
        {wayBack && <div className="-mb-2 -mt-2">{wayBack}</div>}
        {head}
        <div role="tablist" aria-label="Library" className="-mx-4 flex gap-1 overflow-x-auto px-4">
          {sections.map((s) => (
            <button key={s.id} role="tab" aria-selected={filter.section === s.id} onClick={() => setFilter((f) => ({ ...f, section: s.id }))} className={`shrink-0 rounded-full border px-3 text-[12.5px] font-semibold min-h-[44px] ${filter.section === s.id ? "border-[var(--accent,var(--fg))]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]"}`}>
              {s.short} <span className="font-normal text-[var(--muted2)]">{s.count}</span>
            </button>
          ))}
          <button type="button" onClick={() => setFoldersSheet(true)} className="min-h-[44px] shrink-0 rounded-full border border-[var(--panel-border2)] px-3 text-[12.5px] text-[var(--chip-fg)]">Folders</button>
        </div>
        {top}
        {note && <p role="status" className="text-[12px]">{note}</p>}
        {tiles}
        {table}
        {(menuFor || foldersSheet) && (
          <div className="fixed inset-0 z-[60]" data-library-sheet="">
            <button type="button" aria-label="Close" className="absolute inset-0 h-full w-full bg-black/40" onClick={() => { setMenuFor(null); setFoldersSheet(false); }} />
            <div className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col items-stretch rounded-t-[16px] bg-[var(--panel-bg)] px-3 pb-4">
              <button type="button" aria-label="Close" onClick={() => { setMenuFor(null); setFoldersSheet(false); }} className="mx-auto flex h-[44px] w-[88px] items-center justify-center">
                <span className="block h-[5px] w-[44px] rounded-full bg-[var(--panel-border2)]" />
              </button>
              {menuFor ? (
                <div className="[&>div]:w-full">{menu(items.find((x) => x.key === menuFor)!)}</div>
              ) : (
                <div className="flex flex-col">
                  {folders.map((f) => (
                    <button key={f} type="button" onClick={() => { setFilter((x) => ({ ...x, section: `folder:${f}` })); setFoldersSheet(false); }} className="min-h-[44px] px-3 text-left text-[13px]">{f}</button>
                  ))}
                  {!folders.length && <p className="px-3 py-2 text-[12.5px] text-[var(--muted2)]">No folders yet: use a set&rsquo;s ··· → Move to folder.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  return (
    <div data-sets-library="desktop" className="flex flex-col gap-2">
      {wayBack}
    <div className="flex gap-5">
      <nav aria-label="Library" className="flex w-[200px] shrink-0 flex-col gap-1">
        <div className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Library</div>
        {sections.map((s) => (
          <button key={s.id} type="button" aria-current={filter.section === s.id} onClick={() => setFilter((f) => ({ ...f, section: s.id }))} className={`flex min-h-[32px] items-center justify-between rounded-[8px] px-2 text-left text-[13px] ${filter.section === s.id ? "bg-[var(--box-bg)] font-semibold" : ""}`}>
            <span className="inline-flex items-center gap-2">
              {SECTION_MARKER[s.id] && <span data-section-marker={SECTION_MARKER[s.id]} aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-[3px]" style={makerFill(SECTION_MARKER[s.id]!, mine)} />}
              {s.label}
            </span>
            <span className="text-[11.5px] text-[var(--muted2)]">{s.count}</span>
          </button>
        ))}
        <div data-library-key="" className="flex flex-col gap-1.5 px-2 pb-1 pt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Who made it</div>
          {MAKERS.map((m) => (
            <span key={m} className="inline-flex items-center gap-2 text-[12.5px]">
              <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px]" style={makerFill(m, mine)}>
                <KindIcon kind="compared_against" size={12} />
              </span>
              {MAKER_WORD[m]}
            </span>
          ))}
        </div>
        <div className="px-2 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Folders</div>
        {folders.map((f) => (
          <button key={f} type="button" aria-current={filter.section === `folder:${f}`} onClick={() => setFilter((x) => ({ ...x, section: `folder:${f}` }))} className={`min-h-[32px] rounded-[8px] px-2 text-left text-[13px] ${filter.section === `folder:${f}` ? "bg-[var(--box-bg)] font-semibold" : ""}`}>
            {f}
          </button>
        ))}
        {newFolder === null ? (
          <button type="button" onClick={() => setNewFolder("")} className="min-h-[32px] rounded-[8px] px-2 text-left text-[13px] text-[var(--muted2)]">+ New folder</button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (newFolder.trim()) setFilter((x) => ({ ...x, section: `folder:${newFolder.trim()}` })); }} className="px-1">
            <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" aria-label="New folder" className="min-h-[30px] w-full rounded-[6px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 text-[12px]" />
            <p className="pt-1 text-[11px] text-[var(--muted2)]">Then move sets into it with ··· → Move to folder.</p>
          </form>
        )}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {head}
        {top}
        {note && <p role="status" className="text-[12px]">{note}</p>}
        {tiles}
        {table}
        <p className="text-[11.5px] text-[var(--muted2)]">Click a set to see it; ··· holds Edit · Duplicate · Pin to menu · Move to folder · Share · Propose as school set · Archive.</p>
      </div>
    </div>
    </div>
  );
}
