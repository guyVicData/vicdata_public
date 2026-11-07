"use client";

// VicData 0.8 sets round 1 (C12-C17, G27): the set editor, laid out like a playlist
// (docs/v0.8/sets_design/rivals_editor.dc.html, feeders_editor.dc.html).
//   Header    a map thumbnail as artwork with the kind's icon in the creator's colour; the name and
//             description ("why these schools"); the creator pill, kind and entry point; the totals
//             (schools, and pupils at the age); who last changed it. Save, Save as…, Share, ···.
//   The list  a tick means "in the set", nothing else: unticking greys a school ("unticked, leaves on
//             save"), ticking again restores it. Feeder tiers are a per-row button; the list sorts by
//             tier. A big feeder set (25+, or 20+ at a London state school) is grouped (tier, borough
//             or sector), with Occasional and Untiered collapsed, "Find in this set", and a summary.
//   Adding    by name (any school), or the suggestions (the nearest teaching the age, not in the set;
//             Independent · State · Both, plus Boarding only for a boarding school's compared-against
//             sets; 10 shown, "+5 more", counted after the filter): at the foot of a compared-against
//             set's list, in an "Add schools" side panel for feeders.
//   How close (compared-against sets) distance, results and pupil population, live as schools change.
// A set you can't change (a default set, a school set you don't curate) opens as a copy that can only
// be saved as your own. Save returns to where you came from, with the set in use (useSet=<id>).
// On a phone: one column, the artwork at 72 px, Save and Save as in a sticky bar at the bottom, each
// row's tick on the left at 44 px with its other figures behind an expand chevron, Add schools as a
// bottom sheet.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import SchoolSearch from "@/components/SchoolSearch";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { deleteSet, saveSet } from "@/lib/sets/store";
import { PERSONAL_SET_CAP, type CreatorKind, type SetKind, type StoredSet, type Tier } from "@/lib/sets/model";
import type { EditorData, EditorRow } from "@/lib/sets/editor-data";
import { closeness, closenessWords } from "@/lib/sets/closeness";
import { add, changed, feederSummary, groupItems, initItems, isBigFeederSet, setTier, sortByTier, toSave, toggle, type EditorItem, type GroupBy, type SaveMode } from "@/lib/sets/editor-state";
import { CreatorPill, KindIcon, creatorColours } from "./SetSelector";

export type EditorStart = {
  set: StoredSet | null;
  /** A copy's or a new set's starting point. */
  name: string;
  description: string | null;
  members: { urn: string; tier?: Tier | null }[];
  creator: CreatorKind;
  sourceRecipe: string | null;
  mode: SaveMode;
  /** Who may change it, for "Editable by …". */
  editableBy: string;
  lastChanged: string | null;
};

export type EditorPage = {
  urn: string;
  schoolName: string;
  kind: SetKind;
  /** Admissions' entry point ("11+"), or Teacher's phase as its entry point. */
  entry: string;
  phase: "ks4" | "ks5" | null;
  /** Where Save goes back to. */
  back: string;
  /** Where the set is used, in a sentence. */
  usedOn: string;
  profileId: string | null;
  schoolAccountId: string | null;
  /** The creator a school set is saved under here, or null if this person can't curate this kind. */
  schoolCreator: Exclude<CreatorKind, "default" | "group" | "victoria_consultancy" | "me"> | null;
  personalActive: number;
  boardingSchool: boolean;
  readOnly: boolean;
};

const TIERS: (Tier | null)[] = ["main", "regular", "occasional", null];
const TIER_WORD = (t: Tier | null) => (t === null ? "Untiered" : t[0].toUpperCase() + t.slice(1));
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-GB"));

async function token(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

function withUseSet(back: string, id: string): string {
  try {
    const u = new URL(back, window.location.origin);
    if (u.origin !== window.location.origin) return "/sets";
    u.searchParams.set("useSet", id);
    return `${u.pathname}?${u.searchParams.toString()}`;
  } catch {
    return "/sets";
  }
}

/** The artwork: the set's schools around the focus school (north up), the kind's icon in the creator's colour. */
export function SetArtwork({ rows, focus, kind, creator, size = 120 }: { rows: EditorRow[]; focus: { easting: number | null; northing: number | null } | null; kind: SetKind; creator: CreatorKind; size?: number }) {
  const c = creatorColours(creator);
  const pts = focus?.easting != null && focus.northing != null ? rows.filter((r) => r.easting != null && r.northing != null).map((r) => ({ dx: r.easting! - focus.easting!, dy: r.northing! - focus.northing! })) : [];
  const reach = Math.max(1, ...pts.map((p) => Math.max(Math.abs(p.dx), Math.abs(p.dy))));
  const half = size / 2;
  const at = (v: number) => half + (v / reach) * (half - 8);
  return (
    <div data-set-artwork="" className="relative shrink-0 overflow-hidden rounded-[12px] border border-[var(--panel-border)]" style={{ width: size, height: size, background: c.bg === "transparent" ? "var(--box-bg)" : c.bg }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {pts.map((p, i) => (
          <circle key={i} cx={at(p.dx)} cy={size - at(p.dy)} r={2.4} fill={c.fg} opacity={0.75} />
        ))}
        {focus?.easting != null && <circle cx={half} cy={half} r={4} fill="none" stroke={c.fg} strokeWidth={2} />}
      </svg>
      <span className="absolute bottom-1 right-1" style={{ color: c.fg }}>
        <KindIcon kind={kind} size={size >= 100 ? 22 : 16} />
      </span>
    </div>
  );
}

export function SetEditor({ page, start, phone }: { page: EditorPage; start: EditorStart; phone?: boolean }) {
  const [name, setName] = useState(start.name);
  const [description, setDescription] = useState(start.description ?? "");
  const [items, setItems] = useState<EditorItem[]>(() => initItems(start.members));
  const [cache, setCache] = useState<Map<string, EditorRow>>(new Map());
  const [focus, setFocus] = useState<EditorData["focus"]>(null);
  const [age, setAge] = useState<number | null>(null);
  const [filter, setFilter] = useState<{ sector: "all" | "state" | "independent"; boardingOnly: boolean; n: number }>({ sector: "all", boardingOnly: false, n: 10 });
  const [suggestions, setSuggestions] = useState<{ rows: EditorRow[]; total: number } | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("tier");
  const [find, setFind] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(!phone && page.kind === "feeders");
  const [saveAs, setSaveAs] = useState<null | { name: string; owner: "personal" | "school" }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [shared, setShared] = useState(false);
  const feeders = page.kind === "feeders";
  const mode = page.readOnly ? "copy" : start.mode;

  // The rows for every school listed, and the suggestions, from the editor route.
  const urnsKey = items.map((x) => x.urn).sort().join(",");
  useEffect(() => {
    let live = true;
    (async () => {
      const t = await token();
      if (!t) return;
      const qs = new URLSearchParams({ urn: page.urn, kind: page.kind, entry: page.entry, urns: urnsKey, n: String(filter.n) });
      if (filter.sector !== "all") qs.set("sector", filter.sector);
      if (filter.boardingOnly) qs.set("boarding", "1");
      const r = await fetch(`/api/sets/editor?${qs}`, { headers: { Authorization: `Bearer ${t}` } });
      if (!live || !r.ok) return;
      const d = (await r.json()) as EditorData;
      setCache((c) => {
        const n = new Map(c);
        for (const row of [...d.rows, ...d.suggestions]) n.set(row.urn, row);
        return n;
      });
      setFocus(d.focus);
      setAge(d.age);
      setSuggestions({ rows: d.suggestions, total: d.suggestionsTotal });
    })();
    return () => {
      live = false;
    };
  }, [page.urn, page.kind, page.entry, urnsKey, filter]);

  const row = (u: string) => cache.get(u);
  const ordered = useMemo(() => {
    const byKm = [...items].sort((a, b) => (row(a.urn)?.km ?? 1e9) - (row(b.urn)?.km ?? 1e9));
    return feeders ? sortByTier(byKm) : byKm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, cache, feeders]);
  const ticked = ordered.filter((x) => x.ticked);
  const tickedRows = ticked.map((x) => row(x.urn)).filter((r): r is EditorRow => !!r);
  const pupils = tickedRows.reduce((a, r) => a + (r.pupils ?? 0), 0);
  const big = feeders && isBigFeederSet(ticked.length, focus ? { sector: focus.sector, laCode: focus.laCode } : null);
  const shown = find ? ordered.filter((x) => (row(x.urn)?.name ?? x.urn).toLowerCase().includes(find.toLowerCase())) : ordered;
  const close = !feeders && age !== null ? closeness(focus, tickedRows, Number(page.entry.replace(/\D/g, "")) || age) : null;
  const words = close ? closenessWords(close, page.schoolName) : null;
  const dirty = changed(items, start.members) || name !== start.name || (description || null) !== (start.description || null);

  const done = (id: string) => {
    window.location.href = withUseSet(page.back, id);
  };
  const save = async () => {
    if (mode !== "save" || !start.set) return;
    setBusy(true);
    setError(null);
    const r = await saveSet(createBrowserSupabaseClient(), start.set.id, { name: name.trim() || start.name, description: description.trim() || null }, toSave(items));
    setBusy(false);
    if ("error" in r) return setError(r.error);
    done(r.id);
  };
  const saveCopy = async (owner: "personal" | "school", copyName: string) => {
    setBusy(true);
    setError(null);
    const where = page.phase ? { phase: page.phase, entry_point: null } : { entry_point: page.entry, phase: null };
    const r = await saveSet(
      createBrowserSupabaseClient(),
      null,
      {
        name: copyName.trim() || name.trim() || "My set",
        description: description.trim() || null,
        kind: page.kind,
        ...where,
        focus_urn: page.urn,
        owner_scope: owner,
        school_account_id: page.schoolAccountId,
        owner_profile_id: owner === "personal" ? page.profileId : null,
        creator_kind: owner === "personal" ? "me" : page.schoolCreator!,
        source_recipe: start.sourceRecipe ?? (start.set ? `set:${start.set.id}` : null),
        audience: feeders ? (start.set?.audience ?? "day") : null,
      },
      toSave(items),
    );
    setBusy(false);
    if ("error" in r) return setError(r.error);
    done(r.id);
  };
  const archive = async () => {
    if (!start.set) return;
    const r = await saveSet(createBrowserSupabaseClient(), start.set.id, { archived: true }, null);
    if ("error" in r) return setError(r.error);
    window.location.href = page.back;
  };
  const remove = async () => {
    if (!start.set) return;
    const e = await deleteSet(createBrowserSupabaseClient(), start.set.id);
    if (e) return setError(e);
    window.location.href = page.back;
  };
  const pin = async () => {
    if (!start.set) return;
    const r = await saveSet(createBrowserSupabaseClient(), start.set.id, { pinned: !start.set.pinned }, null);
    if ("error" in r) setError(r.error);
    else window.location.reload();
  };
  const share = async () => {
    if (!start.set) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sets/${start.set.id}`);
      setShared(true);
    } catch {
      setError("Couldn't copy the link.");
    }
  };

  const hit = phone ? "min-h-[44px] min-w-[44px]" : "min-h-[30px]";
  const tickBox = (x: EditorItem) => (
    <label className={`flex shrink-0 cursor-pointer items-center justify-center ${phone ? "h-[44px] w-[44px]" : "w-[28px]"}`}>
      <input type="checkbox" checked={x.ticked} disabled={page.readOnly} onChange={() => setItems((it) => toggle(it, x.urn))} aria-label={`${row(x.urn)?.name ?? x.urn} in the set`} className="h-[16px] w-[16px] accent-[var(--accent,#0b6574)]" />
    </label>
  );
  const tierButton = (x: EditorItem) => (
    <select
      data-tier-button={x.urn}
      value={x.tier ?? ""}
      disabled={page.readOnly}
      onChange={(e) => setItems((it) => setTier(it, x.urn, (e.target.value || null) as Tier | null))}
      aria-label={`Tier for ${row(x.urn)?.name ?? x.urn}`}
      className={`rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 text-[12px] font-semibold ${hit}`}
    >
      {TIERS.map((t) => (
        <option key={t ?? "none"} value={t ?? ""}>
          {TIER_WORD(t)}
        </option>
      ))}
    </select>
  );
  const listRow = (x: EditorItem) => {
    const r = row(x.urn);
    const second = feeders ? (r?.trend === "falling" ? "falling" : r?.trend === "rising" ? "rising" : fmt(r?.pupils)) : fmt(r?.pupils);
    return (
      <div key={x.urn} data-editor-row={x.urn} data-ticked={x.ticked ? "1" : "0"} className={`flex flex-col border-t border-[var(--panel-border)] ${x.ticked ? "" : "opacity-50"}`}>
        <div className="flex items-center gap-2 py-[3px]">
          {tickBox(x)}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold">{r?.name ?? x.urn}</div>
            {!x.ticked && <div className="text-[11px] text-[var(--muted2)]">unticked, leaves on save</div>}
          </div>
          <span className="w-[52px] shrink-0 text-right tabular-nums text-[12px]">{r?.km != null ? r.km.toFixed(1) : "—"}</span>
          {phone ? (
            <>
              <span className="w-[56px] shrink-0 text-right tabular-nums text-[12px] text-[var(--muted2)]">{second}</span>
              <button type="button" aria-label="More" aria-expanded={expanded === x.urn} onClick={() => setExpanded((e) => (e === x.urn ? null : x.urn))} className={`flex items-center justify-center ${hit}`}>
                {expanded === x.urn ? "▴" : "▾"}
              </button>
            </>
          ) : (
            <>
              <span className="w-[86px] shrink-0 text-[12px]">{r ? (r.sector === "independent" ? "Independent" : "State") : ""}</span>
              {feeders ? <span className="w-[110px] shrink-0">{tierButton(x)}</span> : <span className="w-[56px] shrink-0 text-[12px]">{r ? (r.boarding ? "Yes" : "No") : ""}</span>}
              <span className="w-[96px] shrink-0 text-right tabular-nums text-[12px]">
                {fmt(r?.pupils)}
                {feeders && r?.trend ? <span className={r.trend === "falling" ? "ml-1 text-[var(--fb-open,#b7860b)]" : "ml-1 text-[var(--muted2)]"}>{r.trend === "falling" ? "▼" : "▲"}</span> : null}
              </span>
            </>
          )}
        </div>
        {phone && expanded === x.urn && (
          <div className="flex flex-wrap items-center gap-3 pb-2 pl-[52px] text-[12px] text-[var(--muted2)]">
            <span>{r ? (r.sector === "independent" ? "Independent" : "State") : ""}</span>
            {!feeders && <span>{r?.boarding ? "Boards" : "Day"}</span>}
            <span>{fmt(r?.pupils)} pupils at {age ?? "the age"}</span>
            {r?.laName && <span>{r.laName}</span>}
          </div>
        )}
        {phone && feeders && <div className="pb-2 pl-[52px]">{tierButton(x)}</div>}
      </div>
    );
  };

  const filterButtons = (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Suggestions">
      {(["independent", "state", "all"] as const).map((s) => (
        <button key={s} type="button" aria-pressed={filter.sector === s} onClick={() => setFilter((f) => ({ ...f, sector: s, n: 10 }))} className={`rounded-full border px-3 text-[12px] font-semibold ${hit} ${filter.sector === s ? "border-[var(--accent,var(--fg))]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]"}`}>
          {s === "all" ? "Both" : s === "state" ? "State" : "Independent"}
        </button>
      ))}
      {!feeders && page.boardingSchool && (
        <button type="button" aria-pressed={filter.boardingOnly} onClick={() => setFilter((f) => ({ ...f, boardingOnly: !f.boardingOnly, n: 10 }))} className={`rounded-full border px-3 text-[12px] font-semibold ${hit} ${filter.boardingOnly ? "border-[var(--accent,var(--fg))]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]"}`}>
          Boarding only
        </button>
      )}
    </div>
  );
  const adding: ReactNode = page.readOnly ? null : (
    <div data-editor-add="" className="flex flex-col gap-2">
      <SchoolSearch allowRequest={false} placeholder="Add a school by name" onSelect={(sc) => setItems((it) => add(it, sc.urn))} />
      {filterButtons}
      <div className="text-[11.5px] text-[var(--muted2)]">Nearest teaching {age ?? "the age"}-year-olds, not in the set · tick to add</div>
      {(suggestions?.rows ?? []).filter((s) => !items.some((x) => x.urn === s.urn)).map((s) => (
        <div key={s.urn} data-suggestion={s.urn} className="flex items-center gap-2 border-t border-[var(--panel-border)] py-[3px]">
          <label className={`flex shrink-0 cursor-pointer items-center justify-center ${phone ? "h-[44px] w-[44px]" : "w-[28px]"}`}>
            <input type="checkbox" checked={false} onChange={() => setItems((it) => add(it, s.urn))} aria-label={`Add ${s.name}`} className="h-[16px] w-[16px]" />
          </label>
          <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.name}</span>
          <span className="w-[52px] shrink-0 text-right tabular-nums text-[12px]">{s.km != null ? s.km.toFixed(1) : "—"}</span>
          {!phone && <span className="w-[86px] shrink-0 text-[12px]">{s.sector === "independent" ? "Independent" : "State"}</span>}
          {!phone && !feeders && <span className="w-[56px] shrink-0 text-[12px]">{s.boarding ? "Yes" : "No"}</span>}
          <span className="w-[56px] shrink-0 text-right tabular-nums text-[12px] text-[var(--muted2)]">{fmt(s.pupils)}</span>
        </div>
      ))}
      {suggestions && suggestions.total > filter.n && (
        <button type="button" data-suggestions-more="" onClick={() => setFilter((f) => ({ ...f, n: f.n + 5 }))} className={`self-start rounded-[8px] border border-[var(--panel-border2)] px-3 text-[12px] font-semibold ${hit}`}>
          +5 more
        </button>
      )}
      <div className="text-[11px] text-[var(--muted2)]">{suggestions ? `${Math.min(filter.n, suggestions.total)} shown of ${suggestions.total}, nearest first, counted after the filter` : "Finding schools…"}</div>
    </div>
  );

  const header = (
    <div data-editor-header="" className={`flex gap-4 ${phone ? "items-start" : "items-end"}`}>
      <SetArtwork rows={tickedRows} focus={focus} kind={page.kind} creator={start.creator} size={phone ? 72 : 132} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--muted2)]">
          <CreatorPill creator={start.creator} />
          <span>
            {start.set?.ownerScope === "personal" || start.mode === "new" ? "My set" : start.set ? "School set" : "Default set"} · {feeders ? "Feeder schools" : "Compared against"} · {page.entry}
            {age !== null ? ` · pupils aged ${age}` : ""}
          </span>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={page.readOnly} aria-label="Name" className={`w-full bg-transparent text-[22px] font-extrabold leading-tight outline-none ${phone ? "min-h-[44px]" : ""}`} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={page.readOnly} rows={phone ? 2 : 2} aria-label="Why these schools" placeholder="Why these schools" className={`w-full resize-none bg-transparent text-[12.5px] text-[var(--chip-fg)] outline-none ${phone ? "min-h-[44px]" : ""}`} />
        <div data-editor-totals="" className="text-[12px] text-[var(--muted2)]">
          {feeders ? feederSummary(items, (u) => row(u)?.trend ?? null) : `${ticked.length} schools ticked`} · {fmt(pupils)} pupils aged {age ?? "…"}
          {start.lastChanged ? ` · last changed by ${start.lastChanged}` : ""}
        </div>
      </div>
    </div>
  );
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "save" && (
        <button type="button" data-editor-save="" disabled={busy || !dirty} onClick={() => void save()} className={`rounded-[10px] bg-[var(--accent,var(--fg))] px-4 text-[13px] font-bold text-[var(--bg)] disabled:opacity-50 ${hit}`}>
          Save
        </button>
      )}
      <button type="button" data-editor-save-as="" disabled={busy} onClick={() => setSaveAs({ name: mode === "save" ? `${name} (copy)` : name, owner: "personal" })} className={`rounded-[10px] border border-[var(--accent,var(--fg))] px-4 text-[13px] font-bold ${hit} ${mode !== "save" ? "bg-[var(--accent,var(--fg))] text-[var(--bg)]" : ""}`}>
        {mode === "save" ? "Save as…" : "Save as your own…"}
      </button>
      {!phone && start.set && (
        <button type="button" onClick={() => void share()} className={`rounded-[10px] border border-[var(--panel-border2)] px-3 text-[13px] ${hit}`}>
          {shared ? "Link copied" : "Share"}
        </button>
      )}
      {start.set && mode === "save" && (
        <span className="relative">
          <button type="button" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className={`rounded-[10px] border border-[var(--panel-border2)] px-3 text-[13px] ${hit}`}>
            ···
          </button>
          {menu && (
            <span role="menu" className="absolute right-0 top-[calc(100%+4px)] z-40 flex w-[200px] flex-col rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-1 shadow-xl">
              {phone && <button type="button" role="menuitem" onClick={() => void share()} className="min-h-[44px] px-3 text-left text-[13px]">{shared ? "Link copied" : "Share"}</button>}
              {start.set.ownerScope === "school" && <button type="button" role="menuitem" onClick={() => void pin()} className={`px-3 text-left text-[13px] ${hit}`}>{start.set.pinned ? "Unpin from the menu" : "Pin to menu"}</button>}
              <button type="button" role="menuitem" onClick={() => void archive()} className={`px-3 text-left text-[13px] ${hit}`}>Archive</button>
              <button type="button" role="menuitem" onClick={() => void remove()} className={`px-3 text-left text-[13px] text-[var(--fb-open,#b7860b)] ${hit}`}>Delete</button>
            </span>
          )}
        </span>
      )}
    </div>
  );

  const groups = big && !find ? groupItems(shown, groupBy, (u) => row(u)) : null;
  const list = (
    <div data-editor-list="" className="flex flex-col">
      {feeders && big && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a school in this set" aria-label="Find a school in this set" className={`min-w-[180px] flex-1 rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 text-[12.5px] ${hit}`} />
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Group by</span>
          {(["tier", "borough", "sector"] as GroupBy[]).map((g) => (
            <button key={g} type="button" aria-pressed={groupBy === g} onClick={() => setGroupBy(g)} className={`rounded-full border px-3 text-[12px] font-semibold ${hit} ${groupBy === g ? "border-[var(--accent,var(--fg))]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]"}`}>
              {g === "tier" ? "Tier" : g === "borough" ? "Borough" : "Sector"}
            </button>
          ))}
        </div>
      )}
      {!phone && (
        <div className="flex items-center gap-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">
          <span className="w-[28px]">In set</span>
          <span className="flex-1">School</span>
          <span className="w-[52px] text-right">km</span>
          <span className="w-[86px]">Sector</span>
          {feeders ? <span className="w-[110px]">Tier</span> : <span className="w-[56px]">Boards</span>}
          <span className="w-[96px] text-right">{feeders ? `Aged ${age ?? ""}, trend` : `Pupils at ${age ?? ""}`}</span>
        </div>
      )}
      {groups
        ? groups.map((g) => {
            const isOpen = open[g.key] ?? !g.collapsedAtStart;
            return (
              <div key={g.key} data-editor-group={g.key} className="flex flex-col">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [g.key]: !isOpen }))} className={`flex items-center gap-2 border-t border-[var(--panel-border2)] text-left text-[12px] font-bold ${hit}`}>
                  <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                  <span>{g.label}</span>
                  <span className="text-[var(--muted2)]">{g.items.length}</span>
                </button>
                {isOpen && g.items.map(listRow)}
              </div>
            );
          })
        : shown.map(listRow)}
      <p className="pt-2 text-[11px] text-[var(--muted2)]">{feeders ? "Choose a tier for a school with its button. " : ""}Unticked schools stay on the list until you save, so ticking again puts them back.</p>
    </div>
  );

  const howClose = words ? (
    <section data-editor-close="" className="flex flex-col gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <h2 className="text-[14px] font-bold">How close is this set to {page.schoolName}?</h2>
      <p className="text-[11.5px] text-[var(--muted2)]">Updates as you add or remove schools.</p>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Distance</div>
        <div data-close-distance="" className="text-[12.5px]">{words.distance}</div>
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Results · {close!.results.startsOn === "post16" ? "Post-16" : "GCSE"}</div>
        <div data-close-results="" className="text-[12.5px]">{words.results}</div>
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Pupil population</div>
        <div data-close-population="" className="text-[12.5px]">{words.population}</div>
      </div>
    </section>
  ) : null;
  const where = (
    <section className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-[12.5px]">
      <h2 className="mb-1 text-[14px] font-bold">Where this set is used</h2>
      <p>{page.usedOn}</p>
      <p className="text-[var(--muted2)]">Editable by {start.editableBy}.</p>
    </section>
  );

  const saveAsDialog = saveAs && (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-label="Save as">
      <div className="flex w-full max-w-[420px] flex-col gap-3 rounded-t-[16px] bg-[var(--panel-bg)] p-4 sm:rounded-[16px]">
        <h2 className="text-[15px] font-bold">Save as</h2>
        <input value={saveAs.name} onChange={(e) => setSaveAs({ ...saveAs, name: e.target.value })} aria-label="Name" className="min-h-[44px] rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 text-[13px]" />
        <div className="flex flex-col gap-1" role="radiogroup" aria-label="Where it goes">
          <label className="flex min-h-[44px] items-center gap-2 text-[13px]">
            <input type="radio" checked={saveAs.owner === "personal"} onChange={() => setSaveAs({ ...saveAs, owner: "personal" })} /> My sets ({page.personalActive} of {PERSONAL_SET_CAP})
          </label>
          {page.schoolCreator && (
            <label className="flex min-h-[44px] items-center gap-2 text-[13px]">
              <input type="radio" checked={saveAs.owner === "school"} onChange={() => setSaveAs({ ...saveAs, owner: "school" })} /> School sets, for everyone at {page.schoolName}
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setSaveAs(null)} className="min-h-[44px] rounded-[10px] border border-[var(--panel-border2)] px-4 text-[13px]">Cancel</button>
          <button type="button" disabled={busy} onClick={() => void saveCopy(saveAs.owner, saveAs.name)} className="min-h-[44px] rounded-[10px] bg-[var(--accent,var(--fg))] px-4 text-[13px] font-bold text-[var(--bg)] disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );

  const notice = mode === "copy" ? <p data-editor-copy="" className="rounded-[10px] border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-2 text-[12px]">{page.readOnly ? "Read-only here." : "You can't change this set, so this is a copy: save it as your own."}</p> : null;
  const err = error ? <p role="alert" className="text-[12px] text-[var(--fb-open,#b7860b)]">{error}</p> : null;

  if (phone)
    return (
      <div data-set-editor="phone" className="flex flex-col gap-4 px-4 pb-[96px] pt-4">
        {header}
        {notice}
        {err}
        {list}
        {!page.readOnly && (
          <button type="button" data-editor-add-open="" onClick={() => setAddOpen(true)} className="min-h-[44px] rounded-[10px] border border-[var(--panel-border2)] text-[13px] font-semibold">
            Add schools
          </button>
        )}
        {howClose}
        {where}
        <div data-editor-sticky="" className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[var(--panel-border2)] bg-[var(--panel-bg)] px-4 py-2">{actions}</div>
        {addOpen && (
          <div className="fixed inset-0 z-[60]" data-editor-sheet="">
            <button type="button" aria-label="Close" className="absolute inset-0 h-full w-full bg-black/40" onClick={() => setAddOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-[16px] bg-[var(--panel-bg)] px-3 pb-4">
              <button type="button" aria-label="Close" onClick={() => setAddOpen(false)} className="mx-auto flex h-[44px] w-[88px] items-center justify-center">
                <span className="block h-[5px] w-[44px] rounded-full bg-[var(--panel-border2)]" />
              </button>
              <div className="min-h-0 overflow-y-auto">{adding}</div>
            </div>
          </div>
        )}
        {saveAsDialog}
      </div>
    );
  return (
    <div data-set-editor="desktop" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {header}
        {actions}
      </div>
      {notice}
      {err}
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
            {list}
            {!feeders && adding && (
              <div className="mt-4 border-t border-[var(--panel-border2)] pt-3">
                <h3 className="mb-2 text-[12.5px] font-bold">Suggested</h3>
                {adding}
              </div>
            )}
          </section>
          {howClose}
          {where}
        </div>
        {feeders && adding && (
          <aside data-editor-side="" className="w-[340px] shrink-0 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-bold">Add schools</h3>
              <button type="button" onClick={() => setAddOpen((o) => !o)} className="text-[12px] text-[var(--muted2)]">{addOpen ? "Hide" : "Show"}</button>
            </div>
            {addOpen && adding}
            <div className="mt-4 border-t border-[var(--panel-border2)] pt-3 text-[12px]">
              <div className="font-bold">Tiers</div>
              <p><b>Main</b> · top of the feeder health table, larger on the map, and an alert if its roll falls.</p>
              <p><b>Regular</b> · sends pupils most years.</p>
              <p><b>Occasional</b> · now and then. Kept in view, never alerts.</p>
              <p className="text-[var(--muted2)]">Optional. Untiered schools count like Regular.</p>
            </div>
          </aside>
        )}
      </div>
      {saveAsDialog}
    </div>
  );
}
