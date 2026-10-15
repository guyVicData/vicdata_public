"use client";

// VicData 0.8 groups r3 (A, P): the Academic and Pupils views (docs/wireframes/groups/Academic.dc.html,
// Phone.dc.html), on the same kit as round 2's (./views.tsx). Every figure and n arrives from
// /api/group/dash (the group lookups, worded by src/lib/groups/dash-r3.ts).
import { useState, type ReactNode } from "react";
import { Empty, Key, LineSwatch, Lbl, Tile, fillHeight } from "@/components/admissions/ui";
import { LineChart } from "@/components/admissions/views/charts";
import { periodLabel } from "@/catalogue/years";
import { MEASURE_LABEL, MEASURE_UNIT, ordinal, PEER_PLURAL, PHASE_NOUN } from "@/lib/groups/dash";
import type { GroupAcademic, GroupPupils } from "@/lib/groups/dash-r3";
import { dirClass, fmt, Td, Th, type Unit } from "@/components/smt/ui";
import { reasonWords } from "@/lib/groups/dash";

const unitOf = (m: string): Unit => (MEASURE_UNIT[m] === "pct" ? "pct" : MEASURE_UNIT[m] === "va" ? "va" : "points");
const f = (v: number | null | undefined, m: string) => fmt(v ?? null, unitOf(m), m.startsWith("ks5_aps") ? "aps_per_entry" : undefined);
const yr = (p: number | null | undefined) => (p === null || p === undefined ? "" : periodLabel(p));
const PH_LABEL = { secondary: "Secondary", post16: "Post-16", primary: "Primary" } as const;

// ------------------------------------------------------------------------------ Academic column 1

export function AcademicNow({ a, average }: { a: GroupAcademic; average: boolean }) {
  const o = a.overview;
  return (
    <div className="flex flex-col gap-3">
      {a.headlines.map((h) => {
        const main = h.measures[0];
        const place = main.place;
        const peer = o.group.type in PEER_PLURAL ? `${PEER_PLURAL[o.group.type]}` : "groups";
        return (
          <div key={h.phase} className="flex flex-col gap-2">
            <div className="text-[13px] font-bold text-[var(--fg)]">
              {PH_LABEL[h.phase]} results now <span className="font-normal text-[var(--muted2)]">· {yr(h.year)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Tile label={`Schools with ${h.phase === "secondary" ? "GCSE" : h.phase === "post16" ? "A-level" : "KS2"} results`} value={<span className="text-[var(--accent)]">{h.withFigure}</span>} sub={`of ${h.inPhase} · the rest listed, with the reason`} accent />
              {h.measures.slice(0, 2).map((m) => (
                <Tile key={m.measure} label={m.label} value={f(average ? m.group?.average_school : m.group?.weighted, m.measure)} sub={`${average ? "average school" : "pupil-weighted"} · ${o.compare.label.toLowerCase().startsWith("peer") ? "peers" : o.compare.label} ${f(average ? m.set?.average_school : m.set?.weighted, m.measure)} · England ${f(m.england?.weighted, m.measure)}`} />
              ))}
              <Tile label={`Rank among peer ${peer}`} value={place ? ordinal(place.rank, place.tied) : "—"} sub={place ? `of ${place.of} ${peer} with ${o.group.type === "mat" ? "the same size band" : "a similar size"}` : "no peer figure this year"} />
            </div>
            <div className="text-[11.5px] text-[var(--muted2)]">
              Spread across the group: lowest {f(h.spread.lowest, main.measure)} · median {f(h.spread.median, main.measure)} · highest {f(h.spread.highest, main.measure)} ({h.spread.n} schools)
            </div>
            {h.excluded.length > 0 && (
              <details className="text-[11.5px] text-[var(--muted2)]">
                <summary className="cursor-pointer">{h.excluded.length} schools without a figure, with the reason</summary>
                <ul className="mt-1">
                  {h.excluded.map((e) => (
                    <li key={e.urn}>
                      {e.name}: {reasonWords(e.reason)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
      <div className="border-t border-[var(--panel-border)] pt-2 text-[11.5px] leading-snug text-[var(--muted2)]">
        <Lbl>Value added</Lbl>
        Progress 8 is published to {yr(a.va.p8.year)} (none since: no KS2 baseline); A-level value added to {yr(a.va.alevel.year)}. Both sit in the Value added view, never in a results chart.
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ Schools ranked

export function SchoolsRanked({ a, highlight, fullscreen }: { a: GroupAcademic; highlight: string | null; fullscreen: boolean }) {
  const r = a.ranked;
  const rows = fullscreen ? r.rows : r.rows.slice(0, 12);
  const vals = r.rows.map((x) => x.value).filter((v): v is number => v !== null);
  const lo = Math.min(...vals, r.england ?? Infinity, r.set?.value ?? Infinity);
  const hi = Math.max(...vals, r.england ?? -Infinity, r.set?.value ?? -Infinity);
  const w = (v: number) => `${Math.max(3, (100 * (v - lo * 0.95)) / (hi - lo * 0.95 || 1))}%`;
  if (!r.rows.length) return <Empty>No member schools in this phase.</Empty>;
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="text-[13px] font-bold text-[var(--fg)]">
        {MEASURE_LABEL[r.measure]}, each school against the group, {r.set?.label ?? "the comparison set"} and England <span className="font-normal text-[var(--muted2)]">· {yr(r.year)}</span>
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto text-[12.5px]">
        {rows.map((x) => (
          <div key={x.urn} className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_56px_170px] items-center gap-2 border-b border-[var(--panel-border)] py-1 ${x.urn === highlight ? "bg-[var(--adm-tint)]" : ""}`}>
            <span className="truncate">
              {x.name}
              {x.likely && <span className="ml-1 rounded-[5px] bg-[var(--group-likely-bg)] px-[6px] text-[10px] font-bold text-[var(--group-likely-fg)]">likely</span>}
            </span>
            {x.value !== null ? (
              <span className="h-[9px] rounded-[3px] bg-[var(--box-bg)]">
                <span className="block h-full rounded-[3px] bg-[var(--accent)]" style={{ width: w(x.value) }} />
              </span>
            ) : (
              <i className="text-[11.5px] text-[var(--muted2)]">{x.reason}</i>
            )}
            <span className="text-right font-semibold">{x.value !== null ? f(x.value, r.measure) : "—"}</span>
            <span className="text-right text-[11.5px] text-[var(--muted2)]">{x.inGroup ? `${ordinal(x.inGroup.rank, x.inGroup.tied)} in group` : "—"}{x.national ? ` · ${ordinal(x.national.rank, x.national.tied)} nat.` : ""}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--muted2)]">
        <span>Group median {f(r.groupMedian, r.measure)}</span>
        {r.set && <span>{r.set.label} {f(r.set.value, r.measure)}{r.set.n !== null ? ` (${r.set.n} schools)` : ""}</span>}
        <span>Non-group {f(r.nonGroup, r.measure)}</span>
        <span>England {f(r.england, r.measure)}</span>
      </div>
      <div className="text-[11px] text-[var(--muted2)]">
        Showing {rows.length} of {r.rows.length}. Ranks share ties; IGCSE schools are listed as &ldquo;not ranked at GCSE&rdquo;, never ranked. National ranks among every school in England with the figure.
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ Subject areas

export function SubjectAreasAcross({ a }: { a: GroupAcademic }) {
  const s = a.areas;
  if (!s.stage) return <Empty>KS2 results have no subject areas: this view is for GCSE and Post-16.</Empty>;
  if (!s.rows.length) return <Empty>No subject areas with enough entries this year.</Empty>;
  const gaps = s.rows.map((r) => Math.abs(r.gap ?? 0));
  const max = Math.max(0.1, ...gaps);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] font-bold text-[var(--fg)]">
        Subject areas, gap to England <span className="font-normal text-[var(--muted2)]">· {s.stage === "ks4" ? "GCSE" : "Post-16"} {yr(s.year)}, points per entry</span>
      </div>
      <div className="flex flex-col gap-1 text-[12.5px]">
        {s.rows.map((r) => (
          <div key={r.familyId} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_60px_minmax(0,1.3fr)] items-center gap-2" title={r.group ? `${r.group.n_schools} schools, ${r.group.entries.toLocaleString("en-GB")} entries` : ""}>
            <span className="truncate">{r.label}</span>
            <span className="relative h-[10px] rounded-[3px] bg-[var(--box-bg)]">
              <span className="absolute top-0 h-full w-px bg-[var(--muted2)]" style={{ left: "50%" }} />
              {r.gap !== null && <span className="absolute top-0 h-full rounded-[3px]" style={{ left: r.gap >= 0 ? "50%" : `${50 - (50 * Math.abs(r.gap)) / max}%`, width: `${(50 * Math.abs(r.gap)) / max}%`, background: r.gap >= 0 ? "var(--adm-up-fg)" : "var(--adm-down-fg)" }} />}
            </span>
            <span className={`text-right font-semibold ${dirClass(r.gap, 0.05)}`}>{r.gap === null ? "—" : `${r.gap > 0 ? "+" : r.gap < 0 ? "−" : "±"}${Math.abs(r.gap).toFixed(2)}`}</span>
            <span className="text-[11px] text-[var(--muted2)]">{r.group?.shown ? `${r.group.n_schools} schools, ${r.group.entries.toLocaleString("en-GB")} entries` : `withheld: fewer than ${s.min?.schools ?? 2} schools with ${s.min?.entries ?? 10}+ entries`}</span>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-[var(--fg)]">
        {s.strengths.length ? `Strongest against England: ${s.strengths.join(" and ")}. ` : ""}
        {s.weaknesses.length ? `Weakest: ${s.weaknesses.join(" and ")}.` : ""}
      </div>
      <div className="text-[11px] leading-snug text-[var(--muted2)]">
        Described, not ranked. Each area counts schools with {s.min?.entries ?? 10} or more entries in it, and shows only where at least {s.min?.schools ?? 2} schools do. IGCSE schools are out at GCSE. Against {a.overview.compare.label}: hover a row.
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ Value added

export function ValueAddedPanel({ a, fullscreen }: { a: GroupAcademic; fullscreen: boolean }) {
  const al = a.va.alevel;
  const p8 = a.va.p8;
  const show = (rows: typeof al.rows) => (fullscreen ? rows : rows.slice(0, 8));
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="text-[13px] font-bold text-[var(--fg)]">Value added, as DfE publishes it</div>
      <section>
        <Lbl>A-level value added · {yr(al.year)}</Lbl>
        <div className="text-[12px] text-[var(--muted2)]">
          Group {fmt(al.group?.weighted ?? null, "va")} (pupil-weighted, {al.group?.n_with_figure ?? 0} schools) · England {fmt(al.england, "va")}
        </div>
        <table className="mt-1 w-full border-collapse text-[12px]">
          <tbody>
            {show(al.rows).map((r) => (
              <tr key={r.urn} className="border-b border-[var(--panel-border)] last:border-0">
                <Td>{r.name}</Td>
                <Td className={`text-right ${dirClass(r.value, 0.05)}`}>{r.value !== null ? fmt(r.value, "va") : <span className="text-[var(--muted2)]">{r.note}</span>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {(p8.rows.length > 0 || p8.notPublished > 0) && (
        <section>
          <Lbl>Progress 8 · {yr(p8.year)} (the last published year)</Lbl>
          <div className="text-[12px] text-[var(--muted2)]">
            Group {fmt(p8.group?.weighted ?? null, "va")} ({p8.group?.n_with_figure ?? 0} state schools){p8.notPublished ? ` · ${p8.notPublished} independent schools: not published` : ""}
          </div>
          <table className="mt-1 w-full border-collapse text-[12px]">
            <tbody>
              {show(p8.rows).map((r) => (
                <tr key={r.urn} className="border-b border-[var(--panel-border)] last:border-0">
                  <Td>{r.name}</Td>
                  <Td className={`text-right ${dirClass(r.value, 0.05)}`}>{r.value !== null ? fmt(r.value, "va") : <span className="text-[var(--muted2)]">{r.note}</span>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="text-[11px] text-[var(--muted2)]">Value added is never drawn in a results chart (R-GROUP-VA-SEPARATE). Independent schools have no Progress 8: not published.</div>
    </div>
  );
}

// ------------------------------------------------------------------------------ row 2

export function ImprovingDeclining({ a }: { a: GroupAcademic }) {
  const i = a.improving;
  const max = Math.max(1, i.improved, i.steady, i.fell);
  const bar = (n: number, colour: string, label: string) => (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-[18px] font-bold">{n}</span>
      <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(4, (90 * n) / max)}px`, background: colour }} />
      <span className="text-[11.5px] text-[var(--muted2)]">{label}</span>
    </div>
  );
  if (!i.of) return <Empty>No school has the headline in both {yr(i.from)} and {yr(i.to)}.</Empty>;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">How many schools improved</div>
      <div className="flex items-end gap-3">
        {bar(i.improved, "var(--adm-up-fg)", "Improved")}
        {bar(i.steady, "var(--adm-grey-2,#71717a)", "Steady")}
        {bar(i.fell, "var(--adm-down-fg)", "Fell")}
      </div>
      <div className="text-[11px] text-[var(--muted2)]">
        {MEASURE_LABEL[i.measure]}, {yr(i.from)} to {yr(i.to)}, {i.of} schools with both years. Steady: within {i.threshold} {MEASURE_UNIT[i.measure] === "pct" ? "percentage points" : "points"} either way.
      </div>
    </>
  );
}

export function BandsReserved() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--panel-border2)] p-6 text-center text-[12.5px] text-[var(--muted2)]">
      <b className="text-[var(--fg)]">Results by band: top 25%, middle 50%, bottom 25%</b>
      Not built yet: it arrives with the bands, as SMT&rsquo;s does.
    </div>
  );
}

// ------------------------------------------------------------------------------ Pupils

export function PupilsNow({ p, compact }: { p: GroupPupils; compact: boolean }) {
  const n = p.overview.now;
  const so = p.stayingOn;
  return (
    <div className="flex flex-col gap-2.5">
      {!compact && <div className="text-[13px] font-bold text-[var(--fg)]">The group&rsquo;s pupils now</div>}
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Combined roll" value={<span className="text-[var(--accent)]">{fmt(n.roll, "pupils")}</span>} sub={`${fmt(n.change["1"].combined, "pct")} on ${periodLabel(n.change["1"].from)}, combined`} accent />
        <Tile label="By phase" value={<span className="text-[15px]">{fmt(p.rollByPhase.primary, "pupils")} · {fmt(p.rollByPhase.secondary, "pupils")} · {fmt(p.rollByPhase.post16, "pupils")}</span>} sub={`pupils aged 5–10 · 11–15 · 16–18, in ${n.byPhase.primary} · ${n.byPhase.secondary} · ${n.byPhase.post16} schools`} />
        <Tile label="Year 12 against Year 11" value={so.pct === null ? "—" : `${so.pct.toFixed(1)}%`} sub={so.pct === null ? "no sixth form with both years" : `${fmt(so.y12, "pupils")} in Year 12 against ${fmt(so.y11, "pupils")} in Year 11 last year · ${so.schools} schools`} />
        {p.boarding.boarders > 0 ? <Tile label="Day · boarding" value={`${fmt(p.boarding.day, "pupils")} · ${fmt(p.boarding.boarders, "pupils")}`} sub={`${p.boarding.schools} schools with boarders`} /> : <Tile label="Growing · shrinking" value={`${p.growing.growing} · ${p.growing.shrinking}`} sub={`of ${p.growing.of} schools, since ${periodLabel(p.growing.from)}`} />}
      </div>
      {!compact && (
        <div className="flex flex-col gap-0.5 text-[11.5px]">
          <Lbl>Roll by phase · change like for like</Lbl>
          {(["1", "3", "5"] as const).map((k) => (
            <div key={k} className="flex justify-between">
              <span className="text-[var(--muted2)]">Since {periodLabel(n.change[k].from)}</span>
              <span className={dirClass(n.change[k].sameSchools, 0.5)}>{fmt(n.change[k].sameSchools, "pct")} like for like · {fmt(n.change[k].combined, "pct")} combined</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupShape({ p, fullscreen, room }: { p: GroupPupils; fullscreen: boolean; room?: number }) {
  const ages = p.shape.ages;
  const first = p.shape.firstAges;
  const lo = ages.findIndex((n) => n > 0);
  const hi = ages.length - 1 - [...ages].reverse().findIndex((n) => n > 0);
  if (lo < 0) return <Empty>No census ages to draw.</Empty>;
  const max = Math.max(1, ...ages, ...first);
  const H = fullscreen ? fillHeight(room, 160, 340) : 190;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">
        The group&rsquo;s shape: pupils by single year of age <span className="font-normal text-[var(--muted2)]">· {periodLabel(p.shape.year)} against {periodLabel(p.shape.first)}</span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: H }}>
        {ages.slice(lo, hi + 1).map((n, i) => (
          <div key={i} className="relative flex flex-1 flex-col items-center justify-end" title={`Age ${lo + i}: ${n.toLocaleString("en-GB")} (${periodLabel(p.shape.first)}: ${(first[lo + i] ?? 0).toLocaleString("en-GB")})`}>
            <div className="w-full rounded-t-[3px] bg-[var(--accent)]" style={{ height: `${(H - 20) * (n / max)}px` }} />
            <div className="absolute w-full border-t-2 border-dashed border-[var(--fg)] opacity-50" style={{ bottom: `${20 + (H - 20) * ((first[lo + i] ?? 0) / max)}px` }} />
            <span className="mt-1 text-[9.5px] text-[var(--muted2)]">{lo + i}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Key swatch={<span className="h-[9px] w-[12px] rounded-[2px] bg-[var(--accent)]" />}>{periodLabel(p.shape.year)}</Key>
        <Key swatch={<LineSwatch colour="var(--fg)" dashed width={14} />}>{periodLabel(p.shape.first)}</Key>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">Combined across the group&rsquo;s schools (outside England not counted), described, never ranked.</div>
    </>
  );
}

export function EntryCohorts({ p, highlight, fullscreen, room }: { p: GroupPupils; highlight: string | null; fullscreen: boolean; room?: number }) {
  const rows = p.entries.filter((e) => e.pts.filter((x) => x.value).length >= 2);
  const ages = Array.from(new Set(rows.map((r) => r.age))).sort((a, b) => a - b);
  const [picked, setAge] = useState<number | null>(null);
  if (!rows.length) return <Empty>Not enough census years.</Empty>;
  const age = picked !== null && ages.includes(picked) ? picked : ages.includes(11) ? 11 : ages[0];
  const years = rows[0].pts.map((x) => x.year);
  const shown = rows.filter((r) => r.age === age);
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Entry cohorts across schools, read-only</div>
      <div className="flex flex-wrap gap-1.5">
        {ages.map((x) => (
          <button key={x} type="button" aria-pressed={x === age} onClick={() => setAge(x)} className={`rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold ${x === age ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--muted2)]"}`}>
            Entry at {x} ({rows.filter((r) => r.age === x).length})
          </button>
        ))}
      </div>
      <LineChart
        height={fullscreen ? fillHeight(room, 170, 320) : 150}
        xLabels={[periodLabel(years[0]), periodLabel(years[years.length - 1])]}
        series={shown.map((r) => ({ id: r.urn, label: r.name, colour: r.urn === highlight ? "var(--accent)" : "var(--adm-grey-2,#a1a1aa)", width: r.urn === highlight ? 2.6 : 1.4, points: r.pts.map((x) => ({ x: x.year, y: x.value })), title: (pt) => `${r.name} ${periodLabel(pt.x)}: ${pt.y ?? "—"} pupils aged ${r.age}` }))}
      />
      <div className="text-[10.5px] text-[var(--muted)]">Each school&rsquo;s main entry point (the age with the largest rise over the age below): its pupils of that age each January.</div>
    </>
  );
}

export function LeavingAt16({ p, fullscreen }: { p: GroupPupils; fullscreen: boolean }) {
  const rows = fullscreen ? p.leaving : p.leaving.slice(0, 10);
  if (!rows.length) return <Empty>No school in the group has a sixth form with both years.</Empty>;
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="text-[13px] font-bold text-[var(--fg)]">
        Year 12 against Year 11 <span className="font-normal text-[var(--muted2)]">· {periodLabel(p.stayingOn.year)}</span>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[var(--panel-border)] text-left">
            <Th>School</Th>
            <Th>Year 11, {periodLabel(p.stayingOn.year - 1)}</Th>
            <Th>Year 12, {periodLabel(p.stayingOn.year)}</Th>
            <Th>Year 12 against Year 11</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.urn} className="border-b border-[var(--panel-border)] last:border-0">
              <Td>{r.name}</Td>
              <Td>{fmt(r.y11, "pupils")}</Td>
              <Td>{fmt(r.y12, "pupils")}</Td>
              <Td className="font-semibold">{r.pct === null ? "—" : `${r.pct.toFixed(1)}%`}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[11px] text-[var(--muted2)]">Over 100%: the sixth form takes more pupils in than its own Year 11 had. Group: {p.stayingOn.pct === null ? "—" : `${p.stayingOn.pct.toFixed(1)}%`} across {p.stayingOn.schools} schools.</div>
    </div>
  );
}

export function MarketShare({ p, fullscreen }: { p: GroupPupils; fullscreen: boolean }) {
  const rows = fullscreen ? p.market.rows : p.market.rows.slice(0, 10);
  if (!rows.length) return <Empty>No school with an LA total to measure.</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.pct ?? 0));
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="text-[13px] font-bold text-[var(--fg)]">Each school&rsquo;s share of its own area</div>
      <div className="flex flex-col gap-1 text-[12.5px]">
        {rows.map((r) => (
          <div key={r.urn} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_52px] items-center gap-2" title={`${r.pupils.toLocaleString("en-GB")} of ${r.laPupils?.toLocaleString("en-GB") ?? "—"} ${PHASE_NOUN[r.phase][0]} pupils in ${r.la ?? "its LA"}`}>
            <span className="truncate">{r.name}</span>
            <span className="h-[9px] rounded-[3px] bg-[var(--box-bg)]">
              <span className="block h-full rounded-[3px] bg-[var(--accent)]" style={{ width: `${(100 * (r.pct ?? 0)) / max}%` }} />
            </span>
            <span className="text-right font-semibold">{fmt(r.pct, "pct")}</span>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-[var(--muted2)]">{p.market.label} (the default, labelled): a school&rsquo;s pupils in its main phase against all its LA&rsquo;s pupils of that phase. Admissions&rsquo; rivals-based share is per school, in that school&rsquo;s own Admissions.</div>
    </div>
  );
}

export type ProjectionRow = { urn: string; name: string; km: number; from: "saved" | "default"; ages: string; now: number | null; end: number | null; endYear: number | null; latestYear: number | null; pct: number | null };

export function ProjectionPerSchool({ rows, fullscreen }: { rows: ProjectionRow[] | null; fullscreen: boolean }) {
  if (!rows) return <Empty>Reading each school&rsquo;s area…</Empty>;
  if (!rows.length) return <Empty>No located schools in England to project around.</Empty>;
  const shown = fullscreen ? rows : rows.slice(0, 8);
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="text-[13px] font-bold text-[var(--fg)]">Children around each school, projected</div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[var(--panel-border)] text-left">
            <Th>School</Th>
            <Th>Area</Th>
            <Th>Now</Th>
            <Th>Projected</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.urn} className="border-b border-[var(--panel-border)] last:border-0">
              <Td className="max-w-[160px] truncate">{r.name}</Td>
              <Td className="text-[var(--muted2)]">{r.km} km{r.from === "saved" ? " (saved)" : ""}, ages {r.ages}</Td>
              <Td>{fmt(r.now, "pupils")}</Td>
              <Td className={dirClass(r.pct, 1)}>{r.end === null ? "—" : `${fmt(r.end, "pupils")} by ${r.endYear} (${r.pct === null ? "—" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%`})`}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[10.5px] leading-snug text-[var(--muted)]">Shown per school: catchments overlap, and the projection functions give each area&rsquo;s total, so adding them would count a neighbourhood near two schools twice. Each at the school&rsquo;s saved catchment, else its default. Not a forecast of any school&rsquo;s roll.</div>
    </div>
  );
}

export function GrowingShrinking({ p }: { p: GroupPupils }): ReactNode {
  const g = p.growing;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Schools growing and shrinking</div>
      <div className="flex items-end gap-6">
        <div>
          <div className="text-[28px] font-bold text-[var(--adm-up-fg)]">{g.growing}</div>
          <div className="text-[11.5px] text-[var(--muted2)]">growing</div>
        </div>
        <div>
          <div className="text-[28px] font-bold text-[var(--adm-down-fg)]">{g.shrinking}</div>
          <div className="text-[11.5px] text-[var(--muted2)]">shrinking</div>
        </div>
        <div>
          <div className="text-[28px] font-bold text-[var(--muted2)]">{Math.max(0, g.of - g.growing - g.shrinking)}</div>
          <div className="text-[11.5px] text-[var(--muted2)]">no change</div>
        </div>
      </div>
      <div className="text-[11px] text-[var(--muted2)]">Each school&rsquo;s roll, {periodLabel(g.from)} against {periodLabel(g.from + 1)}, {g.of} schools with both years.</div>
    </>
  );
}
