"use client";

// VicData 0.8 group sets, M3: the groups library (brief v2 §4, R-GROUP-LIBRARY), laid out like a music
// library: one card per group with its artwork (a tile map of England's regions, shaded by where its
// schools are), its type and size, regions (main first), phases, roll and 3-year change, and one results
// headline for the phase in view against England. "Groups like us" is the default view. Filters: type,
// size band, region (most schools in / has a school in), phases, search; sort. On a phone the cards are
// one column and the filters a bottom sheet. Head office only; the server decides (/api/group/library).
// Each card opens the group's page (GroupLibraryPage); Add to set… (M4) adds it to a set of groups.
// 0.8 non-mainstream groups (NM10): a second section, "Special, AP and nursery groups", with its own
// filter (family, size, region), cards (schools by kind, roll and same-schools change, FSM against the
// kind's England figure; never a result) and the majority rule's (i).
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDashboardTheme, useTeacherTheme, type Theme } from "@/components/shell/TeacherChrome";
import { MidBand, MidDashProvider, midRootProps, useMidPart } from "@/components/shell/MidDash";
import { AdmissionsTeacherNav } from "@/components/admissions/controls";
import { EntryChip } from "@/components/admissions/ui";
import { useWidth } from "@/components/admissions/views/charts";
import { GroupViewAsBanner } from "@/components/groups/GroupViewAsBanner";
import { groupDashVars } from "@/components/groups/dash/GroupDashboard";
import { useSmt } from "@/components/smt/api";
import { AddToSet } from "./AddToSet";
import { displayName, FOCUS_LABEL, REGION_NAMES, type Focus } from "@/lib/groups/dash";
import {
  DEFAULT_FILTER, filterFromQuery, filterToQuery, headlineWords, LIBRARY_TYPES, libraryCards, likeUsWords, phaseWords, regionWords, rollWords,
  SIZE_BAND_WORDS, TYPE_PLURAL_WORD, typeAndSize, type IndexCard, type LibraryFilter, type LibrarySort,
} from "@/lib/groups/library";
import { cardFsmWords, cardRollWords, familyOf, FAMILY_PLURAL, NM_BANDS, NM_NOTES, schoolsByKindWords, smallGroupsWords } from "@/lib/groups/non-mainstream";

type LibraryResponse = {
  viewer: { as: "head_office" | "view_as"; accountId: string; groupId: string; name: string; admin: boolean };
  source: "production" | "fixtures";
  build: { build_id: number; computed_at: string } | null;
  us: IndexCard | null;
  cards: IndexCard[];
  /** 0.8 non-mainstream groups: the special, AP and nursery groups, and how many have two schools. */
  nmCards?: IndexCard[];
  nmCounts?: { two: number; of: number };
};

const PHONE = 768;
const PAGE = 48;
const FOCI: Focus[] = ["all", "primary", "secondary", "post16"];
const SORT_WORD: Record<LibrarySort, string> = { like_us: "Groups like us", size: "Size", name: "Name", headline: "Headline result" };

// England's nine regions as a tile map (3 across, 4 down): the card's artwork.
const TILES: [string, number, number][] = [
  ["E12000001", 1, 0], // North East
  ["E12000002", 0, 1], ["E12000003", 1, 1], // North West, Yorkshire and The Humber
  ["E12000005", 0, 2], ["E12000004", 1, 2], ["E12000006", 2, 2], // West Midlands, East Midlands, East of England
  ["E12000009", 0, 3], ["E12000008", 1, 3], ["E12000007", 2, 3], // South West, South East, London
];

export function RegionArtwork({ regions, size = 64, label }: { regions: Record<string, number>; size?: number; label: string }) {
  const max = Math.max(1, ...TILES.map(([c]) => regions[c] ?? 0));
  const cell = size / 4;
  return (
    <svg width={size * 0.75} height={size} viewBox={`0 0 ${cell * 3} ${cell * 4}`} role="img" aria-label={label} className="shrink-0 rounded-[8px] bg-[var(--box-bg)]">
      {TILES.map(([code, x, y]) => {
        const n = regions[code] ?? 0;
        return (
          <rect key={code} x={x * cell + 1.5} y={y * cell + 1.5} width={cell - 3} height={cell - 3} rx={2.5} fill={n ? "var(--accent)" : "var(--panel-border2)"} fillOpacity={n ? 0.25 + 0.75 * (n / max) : 0.5}>
            <title>{`${REGION_NAMES[code]}: ${n} school${n === 1 ? "" : "s"}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function readFilter(): LibraryFilter {
  if (typeof window === "undefined") return DEFAULT_FILTER;
  return filterFromQuery(new URLSearchParams(window.location.search));
}
function writeFilter(f: LibraryFilter) {
  const u = new URL(window.location.href);
  const keep = u.searchParams.get("account");
  const q = filterToQuery(f);
  if (keep) q.set("account", keep);
  for (const k of ["lookAs", "as", "peek"]) {
    const v = u.searchParams.get(k);
    if (v) q.set(k, v);
  }
  window.history.replaceState(null, "", `${u.pathname}${q.toString() ? `?${q}` : ""}`);
}
const accountQuery = () => {
  if (typeof window === "undefined") return "";
  const u = new URLSearchParams(window.location.search);
  const q = new URLSearchParams();
  for (const k of ["account", "lookAs", "as", "peek"]) {
    const v = u.get(k);
    if (v) q.set(k, v);
  }
  return q.toString();
};

export function GroupLibrary() {
  // 0.8 front door 2b (M3): the library follows Mid with the Group pages (its body the orange field);
  // loading and errors draw Dark under Mid, as before.
  const [plainTheme, setTheme] = useTeacherTheme();
  const dashTheme = useDashboardTheme();
  const acc = accountQuery();
  const load = useSmt<LibraryResponse>(`/api/group/library${acc ? `?${acc}` : ""}`, null);
  const mid = dashTheme.mid && load.status === "ready";
  const theme: Theme = mid ? dashTheme.theme : plainTheme;
  return (
    <MidDashProvider mid={mid} part="group" theme={theme}>
    <main id="teacher-root" data-theme={theme} {...midRootProps(mid, "group")} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={groupDashVars(theme)}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-5 sm:px-7">
        <MidBand className="flex flex-col gap-4" style={groupDashVars("dark")}>
        <GroupViewAsBanner />
        <AdmissionsTeacherNav schoolUrn={null} theme={mid ? "dark" : theme} onTheme={setTheme} />
        </MidBand>
        {load.status === "ready" ? (
          <Library d={load.data} acc={acc} />
        ) : (
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-[13px] text-[var(--muted2)]">
            {load.status === "loading" ? "Loading the groups library…" : load.code === 401 ? <><Link href="/login?next=/teacher/group/groups" className="font-bold text-[var(--group-accent-text)]">Sign in</Link> to see the groups library.</> : load.code === 404 ? "Not found." : load.message}
          </div>
        )}
      </div>
    </main>
    </MidDashProvider>
  );
}

function Library({ d, acc }: { d: LibraryResponse; acc: string }) {
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < PHONE;
  // A special, AP or nursery group opens on its own section (unless the address names one).
  const [f, setF] = useState<LibraryFilter>(() => {
    const r = readFilter();
    const named = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("section");
    return !named && familyOf(d.us?.kind) !== "mainstream" ? { ...r, section: "nm" } : r;
  });
  const [shown, setShown] = useState(PAGE);
  const [sheet, setSheet] = useState(false);
  const set = (p: Partial<LibraryFilter>) => {
    const next = { ...f, ...p };
    setF(next);
    setShown(PAGE);
    writeFilter(next);
  };
  const nm = f.section === "nm";
  const nmAll = useMemo(() => d.nmCards ?? [], [d.nmCards]);
  const usNm = familyOf(d.us?.kind) !== "mainstream";
  // "Like us" lives only in our own section (a special trust's head office has none among mainstream groups).
  const ownSection = !!d.us && nm === usNm;
  const fx = useMemo<LibraryFilter>(() => (ownSection ? f : { ...f, likeUs: false, sort: f.sort === "like_us" ? "size" : f.sort }), [f, ownSection]);
  const cards = useMemo(() => libraryCards(nm ? nmAll : d.cards, d.us, fx), [nm, nmAll, d.cards, d.us, fx]);
  const usName = d.us ? displayName(d.us.name) : d.viewer.name;
  const back = `/teacher/group/overview${acc ? `?${acc}` : ""}`;
  const filters = nm ? <NmFilters f={fx} set={set} /> : <Filters f={fx} set={set} us={d.us} />;
  const sectionSwitch = nmAll.length > 0 && (
    <span role="group" aria-label="Section" className="flex flex-wrap items-center gap-2" data-library-section={f.section}>
      <EntryChip label={`Mainstream groups · ${d.cards.length.toLocaleString("en-GB")}`} active={!nm} onClick={() => set({ section: "mainstream", bands: [], families: [], likeUs: !usNm, sort: usNm ? "size" : "like_us" })} />
      <EntryChip label={`Special, AP and nursery groups · ${nmAll.length.toLocaleString("en-GB")}`} active={nm} onClick={() => set({ section: "nm", bands: [], types: [], phases: [], likeUs: usNm, sort: usNm ? "like_us" : "size", focus: "all" })} />
    </span>
  );
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [sheet]);
  // 0.8 front door 2b (M3): in Mid the library's body is the orange field, its header line on the colour.
  const mid = useMidPart() !== null;
  return (
    <div ref={rootRef} className="flex flex-col gap-3" data-library="" data-mid-field={mid ? "" : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-2" data-on-field={mid ? "" : undefined}>
        <div className="flex flex-col gap-0.5">
          <Link href={back} className="text-[12px] font-bold text-[var(--group-accent-text)]">← Back to {usName} · Overview</Link>
          <h1 className="text-[20px] font-extrabold tracking-tight">Groups library</h1>
          <div className="text-[12.5px] text-[var(--muted2)]">
            {nm
              ? `${nmAll.length.toLocaleString("en-GB")} special and AP trusts and nursery federations of 2 or more schools, compared only with each other and with state-funded schools of the same kinds`
              : `${d.cards.length.toLocaleString("en-GB")} groups to compare ${usName} with: multi-academy trusts, federations, foundation trusts and independent groups of 2 or more schools`}
          </div>
        </div>
        {!nm && (
          <span role="group" aria-label="Phase" className="flex flex-wrap items-center gap-2">
            {FOCI.map((p) => <EntryChip key={p} label={FOCUS_LABEL[p]} active={f.focus === p} onClick={() => set({ focus: p })} />)}
          </span>
        )}
      </div>
      {sectionSwitch}
      {nm && <NmIntro counts={d.nmCounts ?? null} />}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={f.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search groups by name"
          aria-label="Search groups by name"
          className="h-[38px] min-w-0 flex-1 rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] px-4 text-[13px] text-[var(--fg)] placeholder:text-[var(--muted2)] sm:max-w-[360px]"
        />
        {(ownSection || (!d.us && !nm)) && <EntryChip label={nm ? `${FAMILY_PLURAL[familyOf(d.us?.kind)]} like us` : "Groups like us"} active={f.likeUs} onClick={() => set({ likeUs: !f.likeUs, sort: !f.likeUs ? "like_us" : f.sort === "like_us" ? "size" : f.sort })} />}
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--muted2)]" data-on-field={mid ? "" : undefined}>
          Sort
          <select value={fx.sort} onChange={(e) => set({ sort: e.target.value as LibrarySort })} className="h-[34px] rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 text-[12.5px] font-semibold text-[var(--fg)]">
            {(Object.keys(SORT_WORD) as LibrarySort[]).filter((s) => (s !== "like_us" || ownSection) && (s !== "headline" || !nm)).map((s) => <option key={s} value={s}>{SORT_WORD[s]}</option>)}
          </select>
        </label>
        {phone && <button type="button" onClick={() => setSheet(true)} className="h-[38px] rounded-full border border-[var(--panel-border2)] px-4 text-[13px] font-bold">Filters{activeCount(f) ? ` (${activeCount(f)})` : ""}</button>}
      </div>
      {!phone && filters}
      {fx.likeUs && ownSection && <div className="text-[12px] text-[var(--muted2)]" data-on-field={mid ? "" : undefined}>{likeUsWords(d.us)}.</div>}
      <div className="text-[12px] text-[var(--muted)]" aria-live="polite" data-on-field={mid ? "" : undefined}>{cards.length.toLocaleString("en-GB")} group{cards.length === 1 ? "" : "s"}</div>
      {cards.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--panel-border2)] p-6 text-center text-[13px] text-[var(--muted2)]">No groups match. Clear a filter, or turn off Groups like us.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {cards.slice(0, shown).map((c) => (nm ? <NmCard key={c.group_id} c={c} acc={acc} account={d.viewer.accountId} readOnly={d.viewer.as !== "head_office"} ourKind={d.us?.kind ?? null} /> : <Card key={c.group_id} c={c} focus={f.focus} acc={acc} account={d.viewer.accountId} readOnly={d.viewer.as !== "head_office"} ourKind={d.us?.kind ?? null} />))}
        </div>
      )}
      {shown < cards.length && (
        <button type="button" onClick={() => setShown(shown + PAGE)} className="self-center rounded-full border border-[var(--panel-border2)] px-5 py-2 text-[13px] font-bold">
          Show more ({(cards.length - shown).toLocaleString("en-GB")} more)
        </button>
      )}
      <div className="text-[11px] text-[var(--muted2)]" data-on-field={mid ? "" : undefined}>
        Figures: VicData&rsquo;s group aggregates{d.build ? `, build ${d.build.build_id} (${new Date(d.build.computed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})` : ""}{d.source === "fixtures" ? " · test fixtures" : ""}. Members at the time; {nm ? <>FSM against England is the state-funded schools of the group&rsquo;s main kind (special, AP and PRUs, or nursery). Results aren&rsquo;t compared for these groups.</> : <>England is the group&rsquo;s sector&rsquo;s (mainstream state-funded, or independent mainstream). Groups more than half special schools, alternative provision, PRUs or nursery schools are in their own section, Special, AP and nursery groups.</>}
      </div>
      {phone && sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setSheet(false)} role="dialog" aria-modal="true" aria-label="Filters">
          <div className="max-h-[80vh] overflow-y-auto rounded-t-[16px] border-t border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Close filters" onClick={() => setSheet(false)} className="mx-auto mb-3 block h-[44px] w-[64px]"><span className="mx-auto block h-[5px] w-[44px] rounded-full bg-[var(--panel-border2)]" /></button>
            {filters}
            <button type="button" onClick={() => setSheet(false)} className="mt-4 h-[44px] w-full rounded-full bg-[var(--accent)] text-[14px] font-bold text-[#1f0f04]">Show {cards.length.toLocaleString("en-GB")} groups</button>
          </div>
        </div>
      )}
    </div>
  );
}

const activeCount = (f: LibraryFilter) => f.types.length + f.bands.length + f.regions.length + f.phases.length + f.families.length;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-[78px] shrink-0 text-[11.5px] font-bold uppercase tracking-wide text-[var(--muted2)]">{label}</span>
      {children}
    </div>
  );
}

function Filters({ f, set, us }: { f: LibraryFilter; set: (p: Partial<LibraryFilter>) => void; us: IndexCard | null }) {
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
      <Row label="Type">
        {LIBRARY_TYPES.map((t) => <EntryChip key={t} label={TYPE_PLURAL_WORD[t]} active={f.types.includes(t) || (f.likeUs && us?.type === t && !f.types.length)} onClick={() => set({ types: toggle(f.types, t), likeUs: false })} />)}
      </Row>
      <Row label="Schools">
        {SIZE_BAND_WORDS.map((b) => <EntryChip key={b} label={b} active={f.bands.includes(b)} onClick={() => set({ bands: toggle(f.bands, b) })} />)}
      </Row>
      <Row label="Region">
        <select
          aria-label="Region"
          value={f.regions[0] ?? ""}
          onChange={(e) => set({ regions: e.target.value ? [e.target.value] : [] })}
          className="h-[34px] rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 text-[12.5px] font-semibold text-[var(--fg)]"
        >
          <option value="">Anywhere</option>
          {Object.entries(REGION_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <EntryChip label="Most schools in" active={f.regionMode === "most"} onClick={() => set({ regionMode: "most" })} />
        <EntryChip label="Has a school in" active={f.regionMode === "has"} onClick={() => set({ regionMode: "has" })} />
      </Row>
      <Row label="Phases">
        {(["primary", "secondary", "post16"] as const).map((p) => <EntryChip key={p} label={`Has ${p === "post16" ? "sixth forms" : `${p} schools`}`} active={f.phases.includes(p)} onClick={() => set({ phases: toggle(f.phases, p) })} />)}
      </Row>
    </div>
  );
}

export function Card({ c, focus, acc, account, readOnly, ourKind = null }: { c: IndexCard; focus: Focus; acc: string; account: string; readOnly: boolean; ourKind?: string | null }) {
  const ts = typeAndSize(c);
  const h = headlineWords(c, focus);
  const name = displayName(c.name);
  const href = `/teacher/group/groups/${encodeURIComponent(c.group_id)}${acc ? `?${acc}` : ""}`;
  return (
    <article className="flex flex-col gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3" data-group-card={c.group_id}>
      <Link href={href} className="flex gap-3 hover:opacity-90">
        <RegionArtwork regions={c.regions} label={`Where ${name}'s schools are: ${regionWords(c)}`} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="text-[14px] font-extrabold leading-tight text-[var(--fg)]">{name}</div>
          <div className="text-[12px] font-semibold text-[var(--muted)]">
            {ts.line}
            {ts.likely && <span className="ml-1.5 rounded-full bg-[var(--group-likely-bg)] px-1.5 py-[1px] text-[10.5px] font-bold text-[var(--group-likely-fg)]">{ts.likely}</span>}
          </div>
          <div className="text-[11.5px] text-[var(--muted2)]">{regionWords(c)}</div>
        </div>
      </Link>
      <div className="flex flex-col gap-0.5 border-t border-[var(--panel-border)] pt-2 text-[12px]">
        <div className="text-[var(--muted2)]">{phaseWords(c)}</div>
        <div className="text-[var(--fg)]">{rollWords(c)}</div>
        <div className={h.value === null ? "italic text-[var(--muted2)]" : "font-semibold text-[var(--fg)]"}>{h.text}</div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <Link href={href} className="text-[12px] font-bold text-[var(--group-accent-text)]">Open →</Link>
        <AddToSet groupId={c.group_id} account={account} query={acc} readOnly={readOnly} ourKind={ourKind} groupKind={c.kind ?? null} groupName={name} />
      </div>
    </article>
  );
}

/** The non-mainstream section's (i): the majority rule, the families, the pools, nursery FSM, small groups. */
function NmIntro({ counts }: { counts: { two: number; of: number } | null }) {
  return (
    <details className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-[12px]" data-nm-intro="">
      <summary className="cursor-pointer font-semibold text-[var(--fg)]">
        <span aria-hidden className="mr-1.5 inline-flex h-[16px] w-[16px] items-center justify-center rounded-full border border-[var(--muted2)] text-[10px] font-bold">i</span>
        More than half of each group&rsquo;s current schools are special, AP, PRU or nursery schools
      </summary>
      <div className="mt-2 flex flex-col gap-1.5 text-[var(--muted)]">
        <p>{NM_NOTES.line}</p>
        <p>{NM_NOTES.families}</p>
        <p>{NM_NOTES.stateFunded}</p>
        <p>{NM_NOTES.nurseryFsm}</p>
        {counts && <p>{smallGroupsWords(counts.two, counts.of)}</p>}
      </div>
    </details>
  );
}

function NmFilters({ f, set }: { f: LibraryFilter; set: (p: Partial<LibraryFilter>) => void }) {
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3" data-nm-filters="">
      <Row label="Kind">
        {(["special_ap", "nursery"] as const).map((k) => <EntryChip key={k} label={FAMILY_PLURAL[k]} active={f.families.includes(k)} onClick={() => set({ families: toggle(f.families, k), likeUs: false })} />)}
      </Row>
      <Row label="Schools">
        {NM_BANDS.map((b) => <EntryChip key={b} label={b} active={f.bands.includes(b)} onClick={() => set({ bands: toggle(f.bands, b) })} />)}
      </Row>
      <Row label="Region">
        <select aria-label="Region" value={f.regions[0] ?? ""} onChange={(e) => set({ regions: e.target.value ? [e.target.value] : [] })} className="h-[34px] rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 text-[12.5px] font-semibold text-[var(--fg)]">
          <option value="">Anywhere</option>
          {Object.entries(REGION_NAMES).filter(([code]) => code !== "outside_england").map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <EntryChip label="Most schools in" active={f.regionMode === "most"} onClick={() => set({ regionMode: "most" })} />
        <EntryChip label="Has a school in" active={f.regionMode === "has"} onClick={() => set({ regionMode: "has" })} />
      </Row>
    </div>
  );
}

/** A special and AP trust's or nursery federation's card: schools by kind, roll and same-schools change,
 * FSM against its kind's England figure. No results (R-NM-NO-RESULTS). */
export function NmCard({ c, acc, account, readOnly, ourKind }: { c: IndexCard; acc: string; account: string; readOnly: boolean; ourKind: string | null }) {
  const ts = typeAndSize(c);
  const name = displayName(c.name);
  const href = `/teacher/group/groups/${encodeURIComponent(c.group_id)}${acc ? `?${acc}` : ""}`;
  const fam = familyOf(c.kind);
  return (
    <article className="flex flex-col gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3" data-group-card={c.group_id} data-nm-card={fam}>
      <Link href={href} className="flex gap-3 hover:opacity-90">
        <RegionArtwork regions={c.regions} label={`Where ${name}'s schools are: ${regionWords(c)}`} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="text-[14px] font-extrabold leading-tight text-[var(--fg)]">{name}</div>
          <div className="text-[12px] font-semibold text-[var(--muted)]">
            {ts.line}
            <span className="ml-1.5 rounded-full bg-[var(--box-bg)] px-1.5 py-[1px] text-[10.5px] font-bold text-[var(--group-accent-text)]">{fam === "nursery" ? "Nursery federation" : "Special and AP trust"}</span>
          </div>
          <div className="text-[11.5px] text-[var(--muted2)]">{regionWords(c)}</div>
        </div>
      </Link>
      <div className="flex flex-col gap-0.5 border-t border-[var(--panel-border)] pt-2 text-[12px]">
        <div className="text-[var(--muted2)]">{schoolsByKindWords(c.schools_by_kind)}</div>
        <div className="text-[var(--fg)]">{cardRollWords(c)}</div>
        <div className="font-semibold text-[var(--fg)]">{cardFsmWords(c)}</div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <Link href={href} className="text-[12px] font-bold text-[var(--group-accent-text)]">Open →</Link>
        <AddToSet groupId={c.group_id} account={account} query={acc} readOnly={readOnly} ourKind={ourKind} groupKind={c.kind ?? null} groupName={name} />
      </div>
    </article>
  );
}
