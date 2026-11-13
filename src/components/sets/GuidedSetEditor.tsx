"use client";

// VicData 0.8 front door, part 2 (D21-D22, G; R-GUIDED-SETS): the guided sets editor, one screen
// (docs/v0.8/front_door_design/png/sets_editor_feeders.png, sets_editor_rivals.png).
//   Title     the question ("Who feeds us at 11+?", "Who do we compete with at 11+?", SMT's "Who do we
//             measure ourselves against?"), one line of explanation; the set's name and the entry point
//             (or phase) as chips, each a menu.
//   Map       centred on the school, 5/10/15 km rings (the shared map, GuidedMap.tsx): set members solid,
//             main feeders / close rivals larger and labelled, suggestions dashed ("+ name" on hover, a
//             click adds); "Suggest within N km".
//   Right     "In your set" (tick, Remove, the Main / Close tag, "Mark main feeders"), then "Add schools"
//             (search any school in England, filter chips with counts, suggestions nearest first with
//             "+ Add"). A new, empty set shows "Add schools" first.
//   Bottom    "This set now", live as you tick (schools; distance range and median; the sector or
//             day/boarding mix; main feeders, or the set's average results against yours with the IGCSE
//             count, on the shared IGCSE rule). Cancel / Save set.
// Same model and permissions as round 1: saved through store.ts saveSet (save_set; RLS and
// can_curate_sets decide), Main / Close the round-1 `main` tier. Someone who can't curate saves a copy as
// their own, as the round-1 editor does.
// On a phone (G): the map is a 220 px strip with "Expand map"; "In your set" and "Add schools" are two
// tabs; "This set now" and Save sit in a sticky bottom bar. Every control has a 44 px hit area.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SchoolSearch from "@/components/SchoolSearch";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { saveSet } from "@/lib/sets/store";
import type { EditorData, EditorRow } from "@/lib/sets/editor-data";
import { add, changed, initItems, toSave, toggle, type EditorItem, type SaveMode } from "@/lib/sets/editor-state";
import { leaveEditor } from "@/lib/sets/editor-return";
import type { CreatorKind, Phase, SetKind, StoredSet, Tier } from "@/lib/sets/model";
import {
  applyChips,
  chipCounts,
  chipsFor,
  defaultChips,
  describe,
  guidedWords,
  LIST_SHOWN,
  MAP_SUGGESTIONS,
  resultsWords,
  setNow,
  SUGGEST_KM,
  toggleChip,
  type ChipId,
  type GuidedFocus,
  type GuidedKind,
  type GuidedRow,
} from "@/lib/sets/guided";
import { KindIcon } from "./SetSelector";
import { GuidedMap, GuidedMapKey } from "./GuidedMap";

export type GuidedPage = {
  urn: string;
  schoolName: string;
  kind: SetKind;
  g: GuidedKind;
  /** The entry point ("11+"); SMT's phase as its entry point. */
  entry: string;
  entryAge: number;
  phase: Phase | null;
  /** The entry points (Admissions) or phases (SMT) the chip offers, with their addresses. */
  entryChoices: { label: string; href: string; on: boolean }[];
  /** The sets of this kind here, for the Set chip's menu, and "New set". */
  setChoices: { label: string; href: string; on: boolean }[];
  newSetHref: string;
  product: "admissions" | "smt";
  accentHex: string;
  returnTo: string;
  returnFallback: boolean;
  returnLabel: string;
  profileId: string | null;
  schoolAccountId: string | null;
  /** The creator a school set is saved under here, or null if this person can't curate this kind. */
  schoolCreator: Exclude<CreatorKind, "default" | "group" | "victoria_consultancy" | "me"> | null;
  readOnly: boolean;
};

export type GuidedStart = { set: StoredSet | null; name: string; members: { urn: string; tier?: Tier | null }[]; mode: SaveMode };

async function token(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

const asRow = (r: EditorRow): GuidedRow => r;

export function GuidedSetEditor({ page, start, phone, initialData }: { page: GuidedPage; start: GuidedStart; phone?: boolean; initialData?: EditorData }) {
  const words = guidedWords(page.g, page.entry, { phaseWord: page.phase === "ks5" ? "Post-16" : page.phase === "ks4" ? "GCSE" : undefined });
  const [items, setItems] = useState<EditorItem[]>(() => initItems(start.members));
  const [cache, setCache] = useState<Map<string, EditorRow>>(() => new Map((initialData ? [...initialData.rows, ...initialData.suggestions] : []).map((r) => [r.urn, r])));
  const [pool, setPool] = useState<EditorRow[]>(() => initialData?.suggestions ?? []);
  const [focus, setFocus] = useState<EditorData["focus"]>(initialData?.focus ?? null);
  const [chips, setChips] = useState<ChipId[] | null>(() => (initialData?.focus ? defaultChips(page.g, initialData.focus) : null));
  const [maxKm, setMaxKm] = useState<number>(SUGGEST_KM.start);
  const [marking, setMarking] = useState(false);
  const [moreSet, setMoreSet] = useState(false);
  const [moreSug, setMoreSug] = useState(false);
  const [tab, setTab] = useState<"set" | "add">(start.members.length ? "set" : "add");
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaving = useRef(false);
  const mode = page.readOnly ? "copy" : start.mode;

  // Every school listed and the suggestions (the wide pool, up to 120 nearest), from the round-1 editor route.
  const urnsKey = items.map((x) => x.urn).sort().join(",");
  const firstKey = useRef(initialData ? urnsKey : null);
  useEffect(() => {
    if (firstKey.current === urnsKey) return;
    firstKey.current = null;
    let live = true;
    (async () => {
      const t = await token();
      if (!t) return;
      const qs = new URLSearchParams({ urn: page.urn, kind: page.kind, entry: page.entry, urns: urnsKey, n: "120", wide: "1" });
      const r = await fetch(`/api/sets/editor?${qs}`, { headers: { Authorization: `Bearer ${t}` } });
      if (!live || !r.ok) return;
      const d = (await r.json()) as EditorData;
      setCache((c) => {
        const n = new Map(c);
        for (const row of [...d.rows, ...d.suggestions]) n.set(row.urn, row);
        return n;
      });
      setPool(d.suggestions);
      setFocus(d.focus);
      setChips((c) => c ?? defaultChips(page.g, d.focus));
    })();
    return () => {
      live = false;
    };
  }, [page.urn, page.kind, page.entry, page.g, urnsKey]);

  const row = (u: string) => cache.get(u);
  const tiers = useMemo(() => Object.fromEntries(items.map((x) => [x.urn, x.tier])), [items]);
  const listed = new Set(items.map((x) => x.urn));
  const ordered = useMemo(
    () => [...items].sort((a, b) => Number(b.tier === "main") - Number(a.tier === "main") || (row(a.urn)?.km ?? 1e9) - (row(b.urn)?.km ?? 1e9)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, cache],
  );
  const tickedRows = ordered.filter((x) => x.ticked).map((x) => row(x.urn)).filter((r): r is EditorRow => !!r).map(asRow);
  const guidedFocus: GuidedFocus | null = focus ? { sector: focus.sector, gender: focus.gender, boarding: focus.boarding, roll: focus.roll, gcse: focus.gcse, post16: focus.post16 } : null;
  const ctx = { focus: guidedFocus, entryAge: page.entryAge, maxKm };
  const candidates = pool.filter((r) => !listed.has(r.urn)).map(asRow);
  const chipList = chipsFor(page.g, page.entryAge);
  const selected = chips ?? [];
  const suggestions = applyChips(candidates, selected, ctx);
  const counts = chipCounts(candidates, selected, ctx, chipList.map((c) => c.id));
  const now = setNow(page.g, tickedRows, tiers, guidedFocus, page.entryAge);
  const main = new Set(ordered.filter((x) => x.ticked && x.tier === "main").map((x) => x.urn));
  const dirty = changed(items, start.members);

  const leave = (savedId?: string) => {
    leaving.current = true;
    leaveEditor(page.returnTo, page.returnFallback, savedId);
  };
  useEffect(() => {
    if (!dirty || page.readOnly) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty, page.readOnly]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const members = toSave(items);
    let r: { id: string } | { error: string };
    if (mode === "save" && start.set) r = await saveSet(supabase, start.set.id, { name: start.set.name }, members);
    else {
      // A new set, or a copy for someone who can't change this one: a school set when they curate this
      // kind (saved under their role), else their own -- exactly the round-1 editor's two paths.
      const owner = page.schoolCreator && mode !== "copy" ? "school" : "personal";
      const where = page.product === "smt" && page.phase ? { phase: page.phase, entry_point: null } : { entry_point: page.entry, phase: null };
      r = await saveSet(
        supabase,
        null,
        {
          name: start.name,
          kind: page.kind,
          ...where,
          focus_urn: page.urn,
          owner_scope: owner,
          school_account_id: page.schoolAccountId,
          owner_profile_id: owner === "personal" ? page.profileId : null,
          creator_kind: owner === "personal" ? "me" : page.schoolCreator!,
          source_recipe: start.set ? `set:${start.set.id}` : "guided",
          audience: page.kind === "feeders" ? (start.set?.audience ?? "day") : null,
        },
        members,
      );
    }
    setBusy(false);
    if ("error" in r) return setError(r.error);
    leave(r.id);
  };
  const toggleMain = (urn: string) => setItems((it) => it.map((x) => (x.urn === urn ? { ...x, tier: x.tier === "main" ? null : "main" } : x)));
  const remove = (urn: string) => setItems((it) => it.filter((x) => x.urn !== urn));
  const addUrn = (urn: string) => setItems((it) => add(it, urn));

  const hit = phone ? "min-h-[44px]" : "min-h-[30px]";
  const card = "rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel-bg)]";
  const solid = `inline-flex items-center justify-center rounded-[10px] bg-[var(--accent)] px-4 text-[13.5px] font-bold text-[#0b0b0d] disabled:opacity-60 ${phone ? "min-h-[44px]" : "min-h-[38px]"}`;
  const plain = `inline-flex items-center justify-center rounded-[10px] border border-[var(--panel-border2)] px-4 text-[13.5px] font-semibold ${phone ? "min-h-[44px]" : "min-h-[38px]"}`;

  const chipMenu = (label: string, value: string, choices: { label: string; href: string; on: boolean }[], extra?: { label: string; href: string }) => (
    <details data-guided-chip={label} className="relative">
      <summary className={`flex cursor-pointer list-none items-center gap-1 rounded-full border border-[var(--panel-border2)] px-3 text-[13px] ${phone ? "min-h-[44px]" : "min-h-[34px]"}`}>
        <span className="text-[var(--muted2)]">{label}:</span> <b className="truncate">{value}</b>
      </summary>
      <div role="menu" className="absolute right-0 z-40 mt-1 flex min-w-[200px] flex-col rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-1 shadow-xl">
        {choices.map((c) => (
          <a key={c.href} role="menuitem" href={c.href} aria-current={c.on || undefined} className={`flex items-center rounded-[6px] px-3 text-[13px] hover:bg-[var(--box-bg)] ${c.on ? "font-bold" : ""} ${phone ? "min-h-[44px]" : "min-h-[32px]"}`}>
            {c.label}
          </a>
        ))}
        {extra && (
          <a role="menuitem" href={extra.href} className={`flex items-center rounded-[6px] px-3 text-[13px] text-[var(--muted2)] hover:bg-[var(--box-bg)] ${phone ? "min-h-[44px]" : "min-h-[32px]"}`}>
            {extra.label}
          </a>
        )}
      </div>
    </details>
  );

  const head = (
    <header data-guided-head="" className={`flex flex-col gap-2 ${phone ? "px-4 pt-2" : ""}`}>
      <button type="button" data-editor-back="" onClick={() => leave()} className={`inline-flex items-center gap-1 self-start text-[13px] font-semibold text-[var(--muted2)] hover:text-[var(--fg)] ${phone ? "min-h-[44px]" : "min-h-[28px]"}`}>
        <span aria-hidden="true">‹</span> {page.returnLabel}
      </button>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-[12px] text-white ${phone ? "h-10 w-10" : "h-12 w-12"}`} style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${page.accentHex} 70%, white), ${page.accentHex} 55%, color-mix(in srgb, ${page.accentHex} 70%, black))` }}>
          <KindIcon kind={page.kind} size={phone ? 20 : 24} stroke={2.2} />
        </span>
        <h1 className={`font-extrabold leading-tight tracking-[-0.01em] ${phone ? "text-[22px]" : "text-[32px]"}`}>{words.title}</h1>
      </div>
      <div className={`flex gap-3 ${phone ? "flex-col" : "items-end justify-between"}`}>
        <p className={`text-[var(--muted2)] ${phone ? "text-[13.5px]" : "max-w-[800px] text-[15px]"}`}>{words.explain}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {chipMenu("Set", start.name, page.setChoices, { label: "+ New set", href: page.newSetHref })}
          {page.entryChoices.length > 0 && chipMenu(page.product === "smt" ? "Phase" : "Entry point", page.product === "smt" ? (page.phase === "ks5" ? "Post-16" : "GCSE") : page.entry, page.entryChoices)}
        </div>
      </div>
    </header>
  );

  const slider = (
    <label className={`flex items-center gap-2 rounded-[10px] bg-[var(--panel-bg)]/90 px-3 text-[12.5px] ${phone ? "min-h-[44px]" : "min-h-[34px]"}`}>
      <span className="text-[var(--muted2)]">Suggest within</span>
      <b className="w-[44px] tabular-nums">{maxKm} km</b>
      <input type="range" min={SUGGEST_KM.min} max={SUGGEST_KM.max} step={1} value={maxKm} onChange={(e) => setMaxKm(Number(e.target.value))} aria-label="Suggest within, km" className={`accent-[var(--accent)] ${phone ? "h-[44px] flex-1" : "w-[110px]"}`} />
    </label>
  );

  const mapBox = (
    <section data-guided-map="" className={`${card} relative flex flex-col overflow-hidden ${phone ? "mx-4" : "min-h-[560px]"}`}>
      <div className={phone ? "" : "absolute right-3 top-3 z-[500]"}>{slider}</div>
      <GuidedMap
        focus={focus ? { urn: page.urn, easting: focus.easting, northing: focus.northing } : null}
        focusName={page.schoolName}
        members={tickedRows}
        main={main}
        suggestions={suggestions.slice(0, MAP_SUGGESTIONS)}
        maxKm={maxKm}
        accentHex={page.accentHex}
        onAdd={addUrn}
        heightClass={phone ? (mapOpen ? "h-[420px] w-full" : "h-[220px] w-full") : "h-full min-h-[560px] w-full flex-1"}
      />
      <div className={`flex items-center justify-between gap-2 px-3 ${phone ? "py-1" : "absolute bottom-3 left-3 z-[500] rounded-[10px] bg-[var(--panel-bg)]/90 py-2"}`}>
        <span className="flex flex-col gap-0.5">
          <GuidedMapKey mainLegend={words.mainLegend} />
          {suggestions.length > MAP_SUGGESTIONS && <span className="text-[11px] text-[var(--muted2)]">The map shows the nearest {MAP_SUGGESTIONS} of {suggestions.length} suggestions.</span>}
        </span>
        {phone && (
          <button type="button" data-guided-expand="" aria-expanded={mapOpen} onClick={() => setMapOpen((o) => !o)} className="min-h-[44px] shrink-0 rounded-[10px] border border-[var(--panel-border2)] px-3 text-[12.5px] font-semibold">
            {mapOpen ? "Shrink map" : "Expand map"}
          </button>
        )}
      </div>
    </section>
  );

  const shownSet = moreSet ? ordered : ordered.slice(0, LIST_SHOWN);
  const inSet: ReactNode = (
    <section data-guided-in-set="" className={`${card} flex flex-col`}>
      {!phone && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--panel-border)] px-4 py-3">
          <h2 className="text-[14.5px] font-bold">
            In your set <span className="font-normal text-[var(--muted2)]">· {now.schools}</span>
          </h2>
          {items.length > 0 && !page.readOnly && (
            <button type="button" aria-pressed={marking} onClick={() => setMarking((m) => !m)} className={`rounded-[8px] px-2 text-[12.5px] ${marking ? "font-bold text-[var(--fg)]" : "text-[var(--muted2)]"} ${hit}`}>
              {marking ? "Done" : words.markMain}
            </button>
          )}
        </div>
      )}
      {phone && items.length > 0 && !page.readOnly && (
        <div className="flex justify-end px-3 pt-1">
          <button type="button" aria-pressed={marking} onClick={() => setMarking((m) => !m)} className="min-h-[44px] rounded-[8px] px-2 text-[13px] text-[var(--muted2)]">
            {marking ? "Done" : words.markMain}
          </button>
        </div>
      )}
      {!items.length && <p className="px-4 py-4 text-[13px] text-[var(--muted2)]">No schools yet. Add them from the map, the search or the suggestions.</p>}
      {shownSet.map((x) => {
        const r = row(x.urn);
        return (
          <div key={x.urn} data-guided-row={x.urn} data-ticked={x.ticked ? "1" : "0"} className={`flex items-center gap-2 border-b border-[var(--panel-border)] px-3 last:border-b-0 ${phone ? "py-0.5" : "py-1.5"} ${x.ticked ? "" : "opacity-50"}`}>
            <label className={`flex shrink-0 cursor-pointer items-center justify-center ${phone ? "h-[44px] w-[44px]" : "h-[30px] w-[30px]"}`}>
              <input type="checkbox" checked={x.ticked} disabled={page.readOnly} onChange={() => setItems((it) => toggle(it, x.urn))} aria-label={`${r?.name ?? x.urn} in the set`} className="h-[18px] w-[18px] rounded-full accent-[var(--accent)]" />
            </label>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-semibold">{r?.name ?? x.urn}</span>
                {x.tier === "main" && !marking && (
                  <span data-guided-main="" className="shrink-0 rounded-full bg-[var(--accent)] px-2 text-[10.5px] font-bold leading-[17px] text-[#0b0b0d]">
                    {words.mainWord}
                  </span>
                )}
              </div>
              <div className="truncate text-[12px] text-[var(--muted2)]">{x.ticked ? (r ? describe(r, page.g) : "…") : "unticked, leaves on save"}</div>
            </div>
            {marking ? (
              <button type="button" aria-pressed={x.tier === "main"} onClick={() => toggleMain(x.urn)} className={`shrink-0 rounded-full border px-3 text-[12px] font-semibold ${hit} ${x.tier === "main" ? "border-[var(--accent)] bg-[var(--accent)] text-[#0b0b0d]" : "border-[var(--panel-border2)] text-[var(--muted2)]"}`}>
                {words.mainWord}
              </button>
            ) : (
              !page.readOnly && (
                <button type="button" onClick={() => remove(x.urn)} aria-label={`Remove ${r?.name ?? x.urn}`} className={`shrink-0 rounded-[8px] px-2 text-[12.5px] text-[var(--muted2)] hover:text-[var(--fg)] ${phone ? "min-h-[44px] min-w-[44px]" : hit}`}>
                  Remove
                </button>
              )
            )}
          </div>
        );
      })}
      {ordered.length > LIST_SHOWN && (
        <button type="button" onClick={() => setMoreSet((m) => !m)} className={`px-4 text-left text-[12.5px] text-[var(--muted2)] ${phone ? "min-h-[44px]" : "min-h-[34px]"}`}>
          {moreSet ? "Show fewer" : `${ordered.length - LIST_SHOWN} more…`}
        </button>
      )}
    </section>
  );

  const shownSug = moreSug ? suggestions : suggestions.slice(0, LIST_SHOWN);
  const adding: ReactNode = (
    <section data-guided-add="" className={`${card} flex flex-col`}>
      {!phone && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <h2 className="text-[14.5px] font-bold">Add schools</h2>
          <span className="text-[12px] text-[var(--muted2)]">Search, or pick from suggestions</span>
        </div>
      )}
      <div className="flex flex-col gap-2 px-4 pt-3">
        <div data-guided-search="" className={`[&>div]:max-w-none [&_input]:rounded-[10px] [&_input]:border-[var(--panel-border2)] [&_input]:bg-[var(--bg)] [&_input]:text-[13.5px] [&_input]:text-[var(--fg)] ${phone ? "[&_input]:min-h-[44px]" : "[&_input]:py-2"}`}>
          <SchoolSearch allowRequest={false} placeholder="Search any school in England by name, town or postcode" onSelect={(sc) => addUrn(sc.urn)} />
        </div>
        <div data-guided-chips="" role="group" aria-label="Filter the suggestions" className="flex flex-wrap gap-1.5">
          {chipList.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                data-chip={c.id}
                aria-pressed={on}
                onClick={() => setChips((s) => toggleChip(s ?? [], c.id))}
                className={`inline-flex items-center gap-1 rounded-full border px-3 text-[12.5px] font-semibold ${phone ? "min-h-[44px]" : "min-h-[28px]"} ${on ? "border-[var(--accent)] bg-[var(--accent)] text-[#0b0b0d]" : "border-[var(--panel-border2)] text-[var(--chip-fg,var(--fg))]"}`}
              >
                {c.label} <span className={on ? "font-normal" : "font-normal text-[var(--muted2)]"}>{counts[c.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted2)]">
          Suggested nearby · {suggestions.length}, nearest first
        </div>
      </div>
      {chips === null && <p className="px-4 py-3 text-[12.5px] text-[var(--muted2)]">Finding schools nearby…</p>}
      {chips !== null && !suggestions.length && <p className="px-4 py-3 text-[12.5px] text-[var(--muted2)]">No suggestions within {maxKm} km with these filters. Widen the distance, or tap a chip to undo it.</p>}
      {shownSug.map((r) => (
        <div key={r.urn} data-guided-suggestion={r.urn} className="flex items-center gap-2 border-t border-[var(--panel-border)] px-3 py-1">
          <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${phone ? "h-[44px] w-[44px]" : "h-[30px] w-[30px]"}`}>
            <span className="block h-[18px] w-[18px] rounded-full border border-dashed border-[var(--accent)]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">{r.name}</div>
            <div className="truncate text-[12px] text-[var(--muted2)]">{describe(r, page.g)}</div>
          </div>
          {!page.readOnly && (
            <button type="button" onClick={() => addUrn(r.urn)} aria-label={`Add ${r.name}`} className={`shrink-0 rounded-[8px] px-2 text-[12.5px] font-bold text-[color:color-mix(in_srgb,var(--accent)_var(--accent-text-mix,65%),var(--fg))] ${phone ? "min-h-[44px] min-w-[44px]" : hit}`}>
              + Add
            </button>
          )}
        </div>
      ))}
      {suggestions.length > LIST_SHOWN && (
        <button type="button" onClick={() => setMoreSug((m) => !m)} className={`border-t border-[var(--panel-border)] px-4 text-left text-[12.5px] text-[var(--muted2)] ${phone ? "min-h-[44px]" : "min-h-[34px]"}`}>
          {moreSug ? "Show fewer" : `${suggestions.length - LIST_SHOWN} more…`}
        </button>
      )}
      <div className="h-2" />
    </section>
  );

  const stat = (figure: ReactNode, w: string, key: string) => (
    <span key={key} data-set-now={key} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <b className={`tabular-nums ${phone ? "text-[17px]" : "text-[22px]"} font-bold tracking-[-0.01em]`}>{figure}</b>
      <span className={`${phone ? "text-[11.5px]" : "text-[13px]"} text-[var(--muted2)]`}>{w}</span>
    </span>
  );
  const rw = now.results ? resultsWords(now.results) : null;
  const stats = [
    stat(now.schools, now.schools === 1 ? "school" : "schools", "schools"),
    now.km ? stat(`${now.km.min.toFixed(1)}–${now.km.max.toFixed(1)}`, `km, median ${now.km.median.toFixed(1)}`, "km") : null,
    stat(`${now.mix.a} · ${now.mix.b}`, `${now.mix.aWord} · ${now.mix.bWord}`, "mix"),
    page.g === "feeders" ? stat(now.main, `main feeder${now.main === 1 ? "" : "s"}`, "main") : rw ? stat(rw.figure, rw.words, "results") : null,
  ].filter(Boolean);
  const actions = (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={() => leave()} className={plain}>
        Cancel
      </button>
      {!page.readOnly && (
        <button type="button" data-guided-save="" disabled={busy || (!dirty && mode === "save")} onClick={() => void save()} className={solid}>
          {busy ? "Saving…" : mode === "copy" ? "Save as my set" : "Save set"}
        </button>
      )}
    </div>
  );
  const bottom = phone ? (
    <div data-guided-bar="" className="sticky bottom-0 z-[600] mt-3 flex flex-col gap-1 border-t border-[var(--panel-border)] bg-[var(--bg)] px-4 pb-3 pt-2">
      <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted2)]">This set now</div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4">{stats}</div>
      {error && <p role="alert" className="text-[12.5px] text-[var(--fb-open,#b7860b)]">{error}</p>}
      <div className="flex justify-end">{actions}</div>
    </div>
  ) : (
    <div data-guided-bar="" className={`${card} flex items-center gap-6 px-5 py-4`}>
      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--muted2)]">This set now</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-7 gap-y-1">{stats}</div>
      {error && <p role="alert" className="max-w-[240px] text-[12.5px] text-[var(--fb-open,#b7860b)]">{error}</p>}
      {actions}
    </div>
  );
  const note = mode === "copy" && !page.readOnly ? <p className={`text-[12.5px] text-[var(--muted2)] ${phone ? "px-4" : ""}`}>You can&rsquo;t change the school&rsquo;s set: saving keeps a copy as your own.</p> : null;

  if (phone)
    return (
      <div data-guided-editor="phone" className="flex min-h-screen flex-col gap-3 pb-0">
        {head}
        {note}
        {mapBox}
        <div role="tablist" aria-label="Your set and adding" className="mx-4 grid grid-cols-2 gap-1 rounded-[12px] border border-[var(--panel-border)] p-1">
          {(
            [
              ["set", `In your set · ${now.schools}`],
              ["add", "Add schools"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-[44px] rounded-[9px] text-[13.5px] font-semibold ${tab === id ? "bg-[var(--box-bg)] text-[var(--fg)]" : "text-[var(--muted2)]"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mx-4" role="tabpanel">
          {tab === "set" ? inSet : adding}
        </div>
        <div className="flex-1" />
        {bottom}
      </div>
    );
  return (
    <div data-guided-editor="desktop" className="flex flex-col gap-4">
      {head}
      {note}
      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(380px,1fr)] items-start gap-5">
        {mapBox}
        <div className="flex flex-col gap-4">{items.length ? [<div key="s">{inSet}</div>, <div key="a">{adding}</div>] : [<div key="a">{adding}</div>, <div key="s">{inSet}</div>]}</div>
      </div>
      {bottom}
    </div>
  );
}
