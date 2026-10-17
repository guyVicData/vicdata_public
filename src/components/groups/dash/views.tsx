"use client";

// VicData 0.8 groups r2 (C, D): the Overview and Schools views (docs/wireframes/groups, Main and
// Schools), drawn on SMT's and Admissions' kit inside the shared shell. Nothing here computes a figure:
// every value and every n arrives from /api/group/dash (the group lookups, worded by
// src/lib/groups/dash.ts); the views only lay them out.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Empty, Key, LineSwatch, Lbl, Tile, fillHeight } from "@/components/admissions/ui";
import { LineChart, useWidth } from "@/components/admissions/views/charts";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import { productAccent } from "@/components/shell/accent";
import { GROUP_NOTES, GROUP_SOURCE_LABELS, groupNote } from "@/catalogue/notes";
import { periodLabel, rollDirectionOfPct } from "@/catalogue/years";
import { indexTo, indexedLabel } from "@/lib/index-base";
import { FOCUS_LABEL, GROWING_SPAN, MEASURE_LABEL, MEASURE_SHORT, MEASURE_UNIT, ordinal, PHASE_NOUN, type GroupOverview, type GroupSchools, type SchoolRow } from "@/lib/groups/dash";
import { arrowOf, dirClass, fmt, Td, Th, type Unit } from "@/components/smt/ui";
import { ARROW, arrowed, flatBand } from "@/lib/signed-delta";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });
const ACCENT = productAccent("groups")!.hex;
const UP = "#16a34a";
const DOWN = "#dc2626";
const GREY = "#71717a";

type Pt = { year: number; value: number | null };
export type MapSchool = { urn: string; name: string; easting: number | null; northing: number | null; roll: number | null; trend: number | null; outside: boolean; likely: boolean; phases: string[] };
export type MembershipRow = { urn: string; name: string; confidence: "confirmed" | "likely"; joined: string | null; lastSeen: string | null; source: string };

const unitOf = (m: string): Unit => (MEASURE_UNIT[m] === "pct" ? "pct" : MEASURE_UNIT[m] === "va" ? "va" : "points");
const pctText = (v: number | null | undefined, dp = 1) => (v === null || v === undefined ? "—" : `${arrowOf(v, 0.5)} ${Math.abs(v).toFixed(dp)}%`);
export const dateText = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
export const sourcesWord = (sources: string[]) => Array.from(new Set(sources.map((s) => GROUP_SOURCE_LABELS[s] ?? s))).join(" · ");

function Stat({ label, value, sub, accent = false }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return <Tile label={label} value={value} sub={sub ?? ""} accent={accent} />;
}

function Chip({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "ok" | "likely"; title?: string }) {
  const cls = tone === "ok" ? "bg-[var(--adm-up-bg,rgba(22,163,74,0.14))] text-[var(--adm-up-fg)]" : tone === "likely" ? "bg-[var(--group-likely-bg)] text-[var(--group-likely-fg)]" : "bg-[var(--box-bg)] text-[var(--chip-fg,var(--fg))]";
  return (
    <span title={title} className={`rounded-[6px] px-[8px] py-[2px] text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

// ------------------------------------------------------------------------------ Overview, column 1

export function GroupNow({ o, compact }: { o: GroupOverview; compact: boolean }) {
  const n = o.now;
  const bp = n.byPhase;
  const phaseLine = [bp.primary ? `${bp.primary} primary` : null, bp.secondary ? `${bp.secondary} secondary` : null, bp.post16 ? `${bp.post16} with sixth forms` : null].filter(Boolean).join(" · ");
  const g = n.change[GROWING_SPAN];
  const bands = ["XS", "S", "M", "L", "XL"];
  const maxBand = Math.max(1, ...bands.map((b) => n.sizeBands[b] ?? 0));
  return (
    <div className="flex flex-col gap-2.5">
      {!compact && <div className="text-[13px] font-bold text-[var(--fg)]">The group now</div>}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Schools" value={<span className="text-[var(--accent)]">{n.schools}</span>} sub={phaseLine || " "} accent />
        <Stat label="Combined roll" value={fmt(n.roll, "pupils")} sub={n.sinceFirst !== null ? `${pctText(n.sinceFirst)} since ${periodLabel(o.years.first)}` : " "} />
        <Stat label="Schools growing" value={<>{g.growing} <span className="text-[13px] font-semibold text-[var(--muted2)]">of {g.of}</span></>} sub={`since ${periodLabel(g.from)}, like for like`} />
        <Stat label="Areas" value={`${n.las.length} LA${n.las.length === 1 ? "" : "s"}`} sub={n.regions.filter((r) => r.code !== "outside_england").map((r) => r.name).join(", ") || " "} />
      </div>
      {!compact && (
        <>
          <div className="flex flex-col gap-0.5 border-t border-[var(--panel-border)] pt-2 text-[11.5px]">
            <Lbl>Change in the combined roll</Lbl>
            {(["1", "3", "5"] as const).map((k) => (
              <div key={k} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--muted2)]">Since {periodLabel(n.change[k].from)}</span>
                <span>
                  <b className={dirClass(n.change[k].combined, 0.5)}>{pctText(n.change[k].combined)}</b>
                  <span className="text-[var(--muted2)]"> combined · </span>
                  <span className={dirClass(n.change[k].sameSchools, 0.5)}>{pctText(n.change[k].sameSchools)}</span>
                  <span className="text-[var(--muted2)]"> like for like</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Lbl>Size spread · XS to XL</Lbl>
            <div className="flex h-[40px] items-end gap-1.5">
              {bands.map((b) => (
                <div key={b} className="flex flex-1 flex-col items-center gap-1" title={`${n.sizeBands[b] ?? 0} schools ${b}`}>
                  <div className="w-full rounded-[3px]" style={{ height: `${Math.max(4, (26 * (n.sizeBands[b] ?? 0)) / maxBand)}px`, background: (n.sizeBands[b] ?? 0) ? "var(--accent)" : "var(--box-bg)" }} />
                  <span className="rounded-[4px] bg-[var(--box-bg)] px-1.5 text-[10px] font-bold text-[var(--muted2)]">{b}</span>
                </div>
              ))}
            </div>
            <div className="text-[11.5px] text-[var(--muted2)]">Each school sized against its own phase nationally.</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>Source: {sourcesWord(o.group.sources)}</Chip>
            <Chip tone="ok">{o.group.confirmed} confirmed</Chip>
            {o.group.likely > 0 && (
              <Chip tone="likely" title={groupNote("likelyWhyCh", { group: o.group.name })}>
                {o.group.likely} likely
              </Chip>
            )}
            {n.outside.length > 0 && <Chip title={n.outside.map((e) => e.name).join(", ")}>{groupNote("outsideEngland", { n: n.outside.length })}</Chip>}
          </div>
          <div className="text-[11px] text-[var(--muted2)]">{groupNote("membershipAsOf", { date: dateText(o.group.asOf), source: sourcesWord(o.group.sources) })}</div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------ Against others

export const MAIN_ROWS = ["group", "peer_band:band", "non_group:england", "areas:la", "england:england"];

export function AgainstOthers({ o, average, candidates = [], onNamed, highlightNote }: { o: GroupOverview; average: boolean; candidates?: { id: string; label: string; schools: number }[]; onNamed?: (ids: string[]) => void; highlightNote?: ReactNode }) {
  const [mix, setMix] = useState(o.compare.key === "mix_matched");
  const named = o.compare.key.startsWith("peer_named:") ? o.compare.key.slice(11).split(",") : [];
  const a = { ...o.against, rows: o.against.rows.filter((r) => MAIN_ROWS.includes(r.key) || r.kind === "peer_named" || (mix && r.kind === "mix_matched")) };
  const head = (m: string) => `${MEASURE_SHORT[m] === "A level" ? "A-level pts" : MEASURE_SHORT[m]}`;
  const yearOfCol = (m: string) => (o.years.results[m] !== null ? periodLabel(o.years.results[m]!) : "");
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="text-[13px] font-bold text-[var(--fg)]">{o.group.name} against the groups and schools around it</div>
      <div className="overflow-x-auto rounded-[10px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left">
              <Th className="w-[34%]"> </Th>
              <Th>Schools</Th>
              <Th>Roll, 5 years</Th>
              <Th>Growing</Th>
              {a.columns.map((m) => (
                <Th key={m}>
                  <span title={`${MEASURE_LABEL[m]}, ${yearOfCol(m)}`}>{head(m)}</span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.rows.map((r) => (
              <tr key={r.key} className={`border-b border-[var(--panel-border)] last:border-0 ${r.kind === "group" ? "bg-[var(--adm-tint)] font-bold" : ""}`}>
                <Td>
                  {/* 0.8 IGCSE subjects (follow-up 5): a long set name takes two lines at most, the full name its tooltip. */}
                  <span data-set-name="" title={r.label} className="line-clamp-2 max-w-[22rem]">
                    {r.label}
                    {r.kind === "mix_matched" && <span className="ml-1 text-[10.5px] font-semibold text-[var(--muted2)]">(mix-matched)</span>}
                  </span>
                </Td>
                <Td>{r.schools === null ? "—" : r.schools.toLocaleString("en-GB")}</Td>
                <Td className={`whitespace-nowrap ${dirClass(r.roll.pct, 0.5)}`}>{pctText(r.roll.pct)}</Td>
                <Td title={`${r.growing.n} of ${r.growing.of} schools with both years`}>{r.growing.pct === null ? "—" : `${r.growing.pct.toFixed(0)}%`}</Td>
                {a.columns.map((m) => {
                  const c = r.cells[m];
                  const v = average ? c?.average : c?.value;
                  return (
                    <Td key={m} className="whitespace-nowrap" title={c && c.n !== null ? `${c.n.toLocaleString("en-GB")} schools with ${MEASURE_LABEL[m]}, ${yearOfCol(m)}` : "no figure"}>
                      {fmt(v ?? null, unitOf(m), m === "ks5_aps_alevel" ? "aps_per_entry" : undefined)}
                      {c && c.n !== null && <span className="ml-1 text-[10px] font-normal text-[var(--muted2)]">({c.n.toLocaleString("en-GB")})</span>}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {candidates.length > 0 && onNamed && (
          <>
            <span className="text-[11.5px] font-bold text-[var(--muted2)]">Add to the comparison</span>
            {candidates.slice(0, 4).map((c) => {
              const on = named.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => onNamed(on ? named.filter((x) => x !== c.id) : [...named, c.id].slice(-3))} className={`rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold ${on ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--muted2)]"}`}>
                  {on ? "✓" : "+"} {c.label}
                </button>
              );
            })}
          </>
        )}
        {a.mixAvailable && (
          <button type="button" aria-pressed={mix} onClick={() => setMix(!mix)} className={`ml-auto rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold ${mix ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--muted2)]"}`} title={GROUP_NOTES.mixMatched.replace(/\{group\}/g, o.group.name)}>
            Mix-matched: {mix ? "on" : "off"}
          </button>
        )}
      </div>
      {a.counts && <div className="text-[12px] text-[var(--muted)]">{a.counts}.</div>}
      {a.place && <div className="text-[12px] font-semibold text-[var(--fg)]">{a.place}.</div>}
      <div className="text-[11.5px] leading-snug text-[var(--muted2)]">
        Each row shows how many schools stand behind it (in brackets, the schools with that result). Results are by phase: Attainment 8 counts only secondaries with GCSE results, A-level only schools with sixth forms. {average ? "Average school: each school's figure counts once." : "Pupil-weighted."} Roll and growing are like for like.
      </div>
      {highlightNote}
    </div>
  );
}

// --------------------------------------------------------------------------------------- the map

export function GroupMap({ name, schools, highlight, fullscreen, room }: { name: string; schools: MapSchool[]; highlight: string | null; fullscreen: boolean; room?: number }) {
  const members: ConsortiumMapMember[] = useMemo(() => schools.filter((s) => !s.outside && s.easting !== null && s.northing !== null).map((s) => ({ urn: s.urn, name: s.name, easting: s.easting!, northing: s.northing!, roll: s.roll })), [schools]);
  const trend = new Map(schools.map((s) => [s.urn, s.trend]));
  const outside = schools.filter((s) => s.outside);
  if (!members.length) return <Empty>No located schools.</Empty>;
  const h = fullscreen && room ? fillHeight(room, 80, 560) : null;
  const colour = (urn: string) => {
    const t = trend.get(urn);
    // R-ROLL-WORDS-3YR + R-FLAT-BAND: the 3-year change; steady when it rounds to 0%.
    return t === null || t === undefined ? GREY : { up: UP, down: DOWN, flat: GREY }[rollDirectionOfPct(t, 0)];
  };
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">{name}&rsquo;s schools, sized by roll, coloured by the change over three years</div>
      <div className="flex min-h-0 gap-3">
        <div className="min-w-0 flex-1" style={h ? { height: h } : undefined}>
          <ConsortiumMap
            members={members}
            targetUrn={highlight ?? ""}
            heightClass={`${h ? "h-full" : fullscreen ? "h-[560px]" : "h-[330px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
            colourOf={(x) => (x.urn === highlight ? ACCENT : colour(x.urn))}
            tooltipOf={(x) => `${x.name}${x.roll !== null ? ` — ${x.roll.toLocaleString("en-GB")} pupils` : ""}`}
          />
        </div>
        {outside.length > 0 && (
          <div className="w-[160px] shrink-0 text-[12px]">
            <Lbl>Outside England</Lbl>
            {outside.map((s) => (
              <div key={s.urn} className="mt-1">
                {s.name}
                <div className="text-[11px] text-[var(--muted2)]">not on the map: no DfE data</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: UP }} />}>Growing</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: GREY }} />}>Steady (under 0.5%)</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: DOWN }} />}>Shrinking</Key>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------ joined and left

export function JoinedLeft({ membership, schools, compact = false }: { membership: MembershipRow[]; schools?: { urn: string; current: boolean }[]; compact?: boolean }) {
  const rows = membership
    .map((m) => ({ ...m, left: schools ? !schools.find((s) => s.urn === m.urn)?.current : false }))
    .sort((a, b) => (b.joined ?? b.lastSeen ?? "").localeCompare(a.joined ?? a.lastSeen ?? "") || a.name.localeCompare(b.name));
  const shown = compact ? rows.slice(0, 6) : rows;
  if (!rows.length) return <Empty>No membership dates.</Empty>;
  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto text-[12.5px]">
      {!compact && <div className="text-[13px] font-bold text-[var(--fg)]">Joined and left</div>}
      {shown.map((r) => (
        <div key={r.urn} className="flex items-baseline justify-between gap-3 border-b border-[var(--panel-border)] py-1 last:border-0">
          <span className="min-w-0 truncate">
            {r.name}
            {r.joined || r.left ? ` ${r.left ? "left" : "joined"}` : ""}
            {r.confidence === "likely" && <span className="ml-1 rounded-[5px] bg-[var(--group-likely-bg)] px-[6px] text-[10px] font-bold text-[var(--group-likely-fg)]">likely</span>}
          </span>
          <span className="shrink-0 text-[var(--muted2)]">{r.joined ? dateText(r.joined) : `listed · last seen ${dateText(r.lastSeen)}`}</span>
        </div>
      ))}
      {compact && rows.length > shown.length && <div className="text-[11.5px] text-[var(--muted2)]">{rows.length - shown.length} more in the Joined view.</div>}
      <div className="pt-1 text-[11px] text-[var(--muted2)]">Dated where the source dates it; &ldquo;last seen&rdquo; where it doesn&rsquo;t.</div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ row 2

const yr = (p: number) => periodLabel(p);

// 0.8 IGCSE subjects (follow-up 5): a set's legend entry stays on one line however long its name
// ("Non-group schools, same regions and phases as …"), truncated with the full name as its tooltip, so the
// legend wraps within the panel, every series keeps its entry, and the footnote stays on the panel. The
// full name is also in the panel's (i) (GroupDashboard captionOf).
export function SetKey({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span data-set-key="" title={label} className="inline-flex min-w-0 max-w-full items-center gap-[6px] text-[11px] text-[var(--chip-fg)]">
      {swatch}
      <span className="min-w-0 max-w-[15rem] truncate">{label}</span>
    </span>
  );
}

export function RollTrend({ o, fullscreen, room }: { o: GroupOverview; fullscreen: boolean; room?: number }) {
  const lines = o.trends.roll.lines;
  const { base, out } = indexTo(lines.map((l) => l.pts));
  if (!lines.length || lines[0].pts.filter((p) => p.value !== null).length < 2) return <Empty>Not enough census years to draw a trend.</Empty>;
  const years = lines[0].pts.map((p) => p.year);
  const colour = (i: number) => (i === 0 ? "var(--accent)" : i === 1 ? "var(--adm-grey-1,#a1a1aa)" : "var(--adm-grey-2,#71717a)");
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Combined roll, indexed ({indexedLabel(base)})</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 150, 300) : 150}
        reference={{ y: 100 }}
        yFormat={(v) => v.toFixed(0)}
        xLabels={[yr(years[0]), yr(years[years.length - 1])]}
        series={lines.map((l, i) => ({ id: l.key, label: l.label, colour: colour(i), width: i === 0 ? 2.6 : 1.8, dashed: i > 1 ? "5 4" : undefined, points: out[i].map((p) => ({ x: p.year, y: p.value })), title: (pt) => `${l.label} ${yr(pt.x)}: ${pt.y?.toFixed(1)}` }))}
      />
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
        {lines.map((l, i) => (
          <SetKey key={l.key} swatch={<LineSwatch colour={colour(i)} width={14} dashed={i > 1} />} label={l.label} />
        ))}
      </div>
      <div className="text-[10.5px] leading-snug text-[var(--muted)]">{GROUP_NOTES.likeForLike}</div>
    </>
  );
}

export function ResultsTrend({ o, average, fullscreen, room }: { o: GroupOverview; average: boolean; fullscreen: boolean; room?: number }) {
  const [i, setI] = useState(0);
  const parts = o.trends.results;
  if (!parts.length) return <Empty>No published results for the phase in view.</Empty>;
  const p = parts[Math.min(i, parts.length - 1)];
  const colour = (k: number) => (k === 0 ? "var(--accent)" : k === 1 ? "var(--adm-grey-1,#a1a1aa)" : "var(--adm-grey-2,#71717a)");
  const years = p.lines[0].pts.map((x) => x.year);
  return (
    <>
      {(() => {
        const title = `Results against ${p.lines.slice(1).map((l) => l.label).join(" and ") || "the comparison set"}`;
        return <div title={title} className="truncate text-[13px] font-bold text-[var(--fg)]">{title}</div>;
      })()}
      {parts.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {parts.map((x, k) => (
            <button key={x.measure} type="button" onClick={() => setI(k)} aria-pressed={k === i} className={`rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold ${k === Math.min(i, parts.length - 1) ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--muted2)]"}`}>
              {MEASURE_SHORT[x.measure] === "Att 8" ? "Attainment 8" : x.measure === "ks5_aps_alevel" ? "A-level points" : "KS2"}
            </button>
          ))}
        </div>
      )}
      <LineChart
        height={fullscreen ? fillHeight(room, 170, 300) : 130}
        yFormat={(v) => fmt(v, unitOf(p.measure))}
        xLabels={years.length ? [yr(years[0]), yr(years[years.length - 1])] : null}
        series={p.lines.map((l, k) => ({ id: l.key, label: l.label, colour: colour(k), width: k === 0 ? 2.6 : 1.8, dashed: k > 1 ? "5 4" : undefined, points: (average ? l.average : l.pts).map((x) => ({ x: x.year, y: x.value })), dots: true, title: (pt) => `${l.label} ${yr(pt.x)}: ${fmt(pt.y, unitOf(p.measure))}${(() => { const n = l.n[years.indexOf(pt.x)]; return n !== null && n !== undefined ? ` (${n} schools)` : ""; })()}` }))}
      />
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
        {p.lines.map((l, k) => (
          <SetKey key={l.key} swatch={<LineSwatch colour={colour(k)} width={14} dashed={k > 1} />} label={l.label} />
        ))}
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">{average ? "Average school: each school counts once." : "Pupil-weighted."} {MEASURE_LABEL[p.measure]}.</div>
    </>
  );
}

export function ShareOfPlaces({ o, fullscreen }: { o: GroupOverview; fullscreen: boolean }) {
  const s = o.trends.share;
  const rows = fullscreen ? s.las : s.las.slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r.pct ?? 0));
  const phase = o.focus === "all" ? "" : `${PHASE_NOUN[o.focus][0]} `;
  if (!rows.length) return <Empty>No schools in England to measure.</Empty>;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">
        Share of {s.sector === "independent" ? "independent " : ""}
        {phase}places, by LA
      </div>
      <div className="flex flex-col gap-1.5 text-[12.5px]">
        {rows.map((r) => (
          <div key={r.code} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_52px] items-center gap-2" title={`${r.group.toLocaleString("en-GB")} of ${r.total?.toLocaleString("en-GB") ?? "—"} pupils`}>
            <span className="truncate">{r.name}</span>
            <span className="h-[9px] rounded-[3px] bg-[var(--box-bg)]">
              <span className="block h-full rounded-[3px] bg-[var(--accent)]" style={{ width: `${(100 * (r.pct ?? 0)) / max}%` }} />
            </span>
            <span className="text-right font-semibold">{fmt(r.pct, "pct")}</span>
          </div>
        ))}
      </div>
      {s.las.length > rows.length && <div className="text-[11px] text-[var(--muted2)]">{s.las.length - rows.length} more LAs in full screen.</div>}
      <div className="text-[11px] text-[var(--muted2)]">
        Across its regions: {fmt(s.pct, "pct")} ({s.regions.map((r) => `${r.name} ${fmt(r.pct, "pct")}`).join(", ")}).
      </div>
    </>
  );
}

/** "▲ Gaining share" etc. from the share series (first year against the latest). */
export function shareFlag(series: Pt[]): ReactNode {
  const v = series.filter((p) => p.value !== null);
  if (v.length < 2) return null;
  const d = v[v.length - 1].value! - v[0].value!;
  return <span className={`text-[12px] font-bold ${d > 0.1 ? "text-[var(--adm-up-fg)]" : d < -0.1 ? "text-[var(--adm-down-fg)]" : "text-[var(--muted2)]"}`}>{ARROW[flatBand(d, 1, 0.1)]} {d > 0.1 ? "Gaining share" : d < -0.1 ? "Losing share" : "Steady share"}</span>;
}

// ----------------------------------------------------------------------------------- Schools

export function SchoolsNow({ o, membership, schools }: { o: GroupOverview; membership: MembershipRow[]; schools: GroupSchools }) {
  const n = o.now;
  const outside = n.outside.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-bold text-[var(--fg)]">The group now</div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Schools" value={<span className="text-[var(--accent)]">{o.group.confirmed + o.group.likely}</span>} sub={`${n.byPhase.primary} primary-age · ${n.byPhase.secondary} senior · ${n.byPhase.post16} sixth-form`} accent />
        <Stat label="Combined roll" value={fmt(n.roll, "pupils")} sub={n.sinceFirst !== null ? `${pctText(n.sinceFirst)} since ${periodLabel(o.years.first)}` : " "} />
        <Stat label="Day · boarding" value={`${fmt(n.roll - n.boarders, "pupils")} · ${fmt(n.boarders, "pupils")}`} sub="pupils, latest census" />
        <Stat label="Outside England" value={outside} sub={outside ? "no DfE data: listed, not added" : "every school in England"} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Lbl>Membership</Lbl>
        <div className="flex flex-wrap gap-1.5">
          <Chip>Source: {sourcesWord(o.group.sources)}</Chip>
          <Chip tone="ok">{o.group.confirmed} confirmed</Chip>
          {o.group.likely > 0 && <Chip tone="likely">{o.group.likely} likely</Chip>}
        </div>
        {o.group.likely > 0 && <div className="text-[12px] text-[var(--muted2)]">{groupNote("likelyWhyCh", { group: o.group.name })}</div>}
        <div className="text-[11px] text-[var(--muted2)]">{groupNote("membershipAsOf", { date: dateText(o.group.asOf), source: sourcesWord(o.group.sources) })}</div>
      </div>
      <div className="flex min-h-0 flex-col gap-1">
        <Lbl>Joined and left</Lbl>
        <JoinedLeft membership={membership} schools={schools.rows} compact />
      </div>
    </div>
  );
}

type SortKey = "roll" | "name" | "headline" | "national" | "trend";

export function SchoolsTable({ s, highlight, onHighlight }: { s: GroupSchools; highlight: string | null; onHighlight: (urn: string) => void }) {
  const [sort, setSort] = useState<SortKey>("roll");
  const rows = [...s.rows].sort((a, b) => {
    const nul = (x: number | null | undefined) => (x === null || x === undefined ? -Infinity : x);
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "headline") return nul(b.headline?.value) - nul(a.headline?.value) || a.name.localeCompare(b.name);
    if (sort === "national") return (a.national?.rank ?? Infinity) - (b.national?.rank ?? Infinity) || a.name.localeCompare(b.name);
    if (sort === "trend") return nul(b.trend) - nul(a.trend) || a.name.localeCompare(b.name);
    return nul(b.roll) - nul(a.roll) || a.name.localeCompare(b.name);
  });
  const sortBtn = (k: SortKey, label: string) => (
    <button type="button" onClick={() => setSort(k)} aria-pressed={sort === k} className={`uppercase ${sort === k ? "text-[var(--fg)]" : ""}`}>
      {label}
      {sort === k ? " ↓" : ""}
    </button>
  );
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="min-h-0 overflow-auto rounded-[10px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[var(--panel-bg)]">
            <tr className="border-b border-[var(--panel-border)] text-left">
              <Th>{sortBtn("name", "School")}</Th>
              <Th>Phase</Th>
              <Th>{sortBtn("roll", "Roll")}</Th>
              <Th>Size</Th>
              <Th>Shape</Th>
              <Th>{sortBtn("headline", "Headline")}</Th>
              <Th>In group</Th>
              <Th>{sortBtn("national", "National")}</Th>
              <Th>VA</Th>
              <Th>{sortBtn("trend", "Trend")}</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <SchoolTr key={r.urn} r={r} on={r.urn === highlight} onHighlight={onHighlight} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11.5px] text-[var(--muted2)]">
        Showing {s.counts.shown} of {s.counts.listed} · {s.counts.withHeadline} with a {s.focus === "all" ? "headline" : `${FOCUS_LABEL[s.focus]} headline`}, {s.counts.withoutHeadline} with the reason instead · each name opens the school&rsquo;s SMT view where head office has access, otherwise its public page
      </div>
    </div>
  );
}

function SchoolTr({ r, on, onHighlight }: { r: SchoolRow; on: boolean; onHighlight: (urn: string) => void }) {
  const phase = r.ages ?? (r.outsideEngland ? "16–19" : "—");
  return (
    <tr className={`border-b border-[var(--panel-border)] last:border-0 ${on ? "bg-[var(--adm-tint)]" : ""}`} onClick={() => onHighlight(r.urn)}>
      <Td>
        {r.outsideEngland ? (
          <span>{r.name}</span>
        ) : (
          <Link href={r.link.href} className="font-semibold text-[var(--adm-accent-text)] hover:underline" title={r.link.kind === "smt" ? "Its SMT dashboards, read-only" : "Its public page"}>
            {r.name}
          </Link>
        )}
        {r.confidence === "likely" && <span className="ml-1 rounded-[5px] bg-[var(--group-likely-bg)] px-[6px] text-[10px] font-bold text-[var(--group-likely-fg)]">likely</span>}
      </Td>
      <Td>{phase}</Td>
      <Td>{r.roll === null ? "—" : r.roll.toLocaleString("en-GB")}</Td>
      <Td>{r.size ? <span className="rounded-[4px] bg-[var(--adm-tint)] px-1.5 text-[10.5px] font-bold text-[var(--adm-accent-text)]">{r.size}</span> : "—"}</Td>
      <Td className="text-[var(--muted2)]">{r.shape ?? "—"}</Td>
      <Td className="min-w-[132px]">{r.headline ? `${r.headline.label} ${fmt(r.headline.value, unitOf(r.headline.measure), r.headline.measure === "ks5_aps_alevel" ? "aps_per_entry" : undefined)}` : <i className="text-[var(--muted2)]">{r.reason}</i>}</Td>
      <Td>{r.inGroup ? `${ordinal(r.inGroup.rank, r.inGroup.tied)} of ${r.inGroup.of}` : "—"}</Td>
      <Td>{r.national ? `${ordinal(r.national.rank, r.national.tied)} of ${r.national.of.toLocaleString("en-GB")}` : "—"}</Td>
      <Td>{r.va ? fmt(r.va.value, "va") : <span className="text-[var(--muted2)]" title={r.vaNote ?? undefined}>{r.vaNote ? "not published" : "—"}</span>}</Td>
      <Td className={`whitespace-nowrap ${dirClass(r.trend, 0.5, 1)}`}>{r.trend === null ? "—" : arrowed(r.trend, (x) => `${x.toFixed(1)}%`, 1, 0.5)}</Td>
      <Td className="text-[var(--muted2)]">{r.joined ? dateText(r.joined) : r.basis === "assumed" ? "undated" : "—"}</Td>
    </tr>
  );
}

export function WhoIsGrowing({ s, o, highlight, fullscreen, room }: { s: GroupSchools; o: GroupOverview; highlight: string | null; fullscreen: boolean; room?: number }) {
  const series = s.rows.filter((r) => r.rollsByYear.filter((p) => p.value).length >= 2);
  if (!series.length) return <Empty>Not enough census years to draw a trend.</Empty>;
  const indexed = series.map((r) => {
    const first = r.rollsByYear.find((p) => p.value);
    return { r, pts: r.rollsByYear.map((p) => ({ x: p.year, y: p.value && first?.value ? (100 * p.value) / first.value : null })) };
  });
  const group = o.trends.roll.lines[0];
  const years = group.pts.map((p) => p.year);
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Who is growing, who is shrinking</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 170, 320) : 140}
        reference={{ y: 100 }}
        yFormat={(v) => v.toFixed(0)}
        xLabels={years.length ? [yr(years[0]), yr(years[years.length - 1])] : null}
        series={[
          ...indexed.map(({ r, pts }) => ({ id: r.urn, label: r.name, colour: r.urn === highlight ? ACCENT : "var(--adm-grey-2,#a1a1aa)", width: r.urn === highlight ? 2.4 : 1, opacity: r.urn === highlight ? 1 : 0.5, points: pts, title: (pt: { x: number; y: number | null }) => `${r.name} ${yr(pt.x)}: ${pt.y?.toFixed(0)}` })),
          { id: "group", label: o.group.name, colour: "var(--accent)", width: 2.8, points: group.pts.map((p) => ({ x: p.year, y: p.value })) },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Group, like for like</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-2,#a1a1aa)" width={14} />}>Each school, its own first year = 100</Key>
      </div>
    </>
  );
}

export function SizeAndResults({ s, highlight, fullscreen, room }: { s: GroupSchools; highlight: string | null; fullscreen: boolean; room?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const pts = s.rows.filter((r) => r.headline && r.roll);
  const measure = pts[0]?.headline?.measure ?? null;
  const same = pts.filter((r) => r.headline!.measure === measure);
  if (!measure || same.length < 2) return <Empty>Fewer than two schools with a published headline in this phase.</Empty>;
  const H = fullscreen ? fillHeight(room, 140, 360) : 150;
  const W = Math.max(w, 10);
  const xs = same.map((r) => r.roll!);
  const ys = same.map((r) => r.headline!.value);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const sx = (v: number) => 14 + ((v - x0) / (x1 - x0 || 1)) * (W - 28);
  const sy = (v: number) => H - 14 - ((v - y0) / (y1 - y0 || 1)) * (H - 28);
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Size against {MEASURE_LABEL[measure]}</div>
      <div ref={ref} className="w-full">
        <svg width={W} height={H} role="img" aria-label={`Each school's roll against ${MEASURE_LABEL[measure]}`}>
          <line x1={14} x2={W - 14} y1={H - 14} y2={H - 14} stroke="var(--panel-border2)" />
          <line x1={14} x2={14} y1={10} y2={H - 14} stroke="var(--panel-border2)" />
          {same.map((r) => (
            <circle key={r.urn} cx={sx(r.roll!)} cy={sy(r.headline!.value)} r={r.urn === highlight ? 7 : 5} fill={r.urn === highlight ? ACCENT : "var(--accent)"} fillOpacity={r.urn === highlight ? 1 : 0.55} stroke={r.urn === highlight ? "var(--fg)" : "none"}>
              <title>{`${r.name}: ${r.roll!.toLocaleString("en-GB")} pupils, ${fmt(r.headline!.value, unitOf(measure))}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-[10.5px] text-[var(--muted2)]">
        <span>Roll: {x0.toLocaleString("en-GB")} to {x1.toLocaleString("en-GB")}</span>
        <span>
          {MEASURE_SHORT[measure]}: {fmt(y0, unitOf(measure))} to {fmt(y1, unitOf(measure))}
        </span>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">{same.length} schools with both figures; the rest are listed in the table with the reason.</div>
    </>
  );
}

export function Shapes({ s, highlight, fullscreen }: { s: GroupSchools; highlight: string | null; fullscreen: boolean }) {
  const rows = s.rows.filter((r) => r.rollByAge.some((n) => n > 0));
  const shown = fullscreen ? rows : rows.slice(0, 6);
  if (!rows.length) return <Empty>No census ages to draw.</Empty>;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {shown.map((r) => {
          const ages = r.rollByAge.map((n, a) => ({ a, n })).filter((x) => x.n > 0);
          const lo = ages[0].a;
          const hi = ages[ages.length - 1].a;
          const span = r.rollByAge.slice(lo, hi + 1);
          const max = Math.max(1, ...span);
          return (
            <div key={r.urn} className={`flex flex-col gap-1 rounded-[8px] p-1 ${r.urn === highlight ? "bg-[var(--adm-tint)]" : ""}`}>
              <div className="flex h-[44px] items-end gap-px">
                {span.map((n, i) => (
                  <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${Math.max(2, (44 * n) / max)}px`, background: "var(--accent)", opacity: 0.45 + (0.55 * n) / max }} title={`Age ${lo + i}: ${n}`} />
                ))}
              </div>
              <div className="truncate text-[10.5px] text-[var(--muted2)]" title={r.name}>
                {r.name.replace(/ (School|Academy)$/, "")} · {r.shape ?? `${lo}–${hi + 1}`}
              </div>
            </div>
          );
        })}
      </div>
      {rows.length > shown.length && <div className="text-[11px] text-[var(--muted2)]">{rows.length - shown.length} more in full screen.</div>}
      <div className="text-[10.5px] text-[var(--muted)]">Each school by single year of age, described, never ranked.</div>
    </>
  );
}
