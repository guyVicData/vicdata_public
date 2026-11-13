"use client";

// VicData 0.8 group sets, M4 (brief v2 §5.3; Guy's D3): a set of groups on the Group pages.
//   SideBySide        our group first and highlighted, each group in the set with its type and size and
//                     its same-type rank, then the set's median ("n of m groups"; "mixed types" when the
//                     set mixes them; "not published" where a type never publishes a measure). The
//                     Weighting switch applies to every row and the median follows it.
//   SetTrend          the panel: ours solid, the set's median, the middle-half band (none under 4 groups,
//                     and the (i) says why); no hover or pinning. Full screen (the large view): every
//                     group's line thin and muted, ours on top in full colour, the set's groups listed
//                     beside the chart -- hover or click brings a line forward, click pins it (tap on a
//                     phone) -- and a toggle for the median and band.
// Every figure arrives from /api/group/dash (each group's own figures, production's); the median and the
// band are taken here over those figures, one vote per group (group-sets.ts).
import { useMemo, useState, type ReactNode } from "react";
import { Empty, Key, LineSwatch, fillHeight } from "@/components/admissions/ui";
import { LineChart } from "@/components/admissions/views/charts";
import { FEATURED_ROW_BG } from "@/components/shell/accent";
import { periodLabel } from "@/catalogue/years";
import { MEASURE_LABEL, MEASURE_SHORT, MEASURE_UNIT, type GroupOverview, type SideBySide as SideBySideData } from "@/lib/groups/dash";
import { bandWords, ofGroupsWords, setTrend, type Pt } from "@/lib/groups/group-sets";
import { arrowOf, dirClass, fmt, Td, Th, type Unit } from "@/components/smt/ui";

const unitOf = (m: string): Unit => (MEASURE_UNIT[m] === "pct" ? "pct" : MEASURE_UNIT[m] === "va" ? "va" : "points");
const pctText = (v: number | null | undefined, dp = 1) => (v === null || v === undefined ? "—" : `${arrowOf(v, 0.5)} ${Math.abs(v).toFixed(dp)}%`);
const yr = (p: number) => periodLabel(p);
const MEDIAN = "var(--fg)";
const MUTED = "var(--adm-grey-2,#a1a1aa)";
const BAND = "var(--accent)";

// ---------------------------------------------------------------------------------- side by side

export function SideBySide({ o, average, compact = false }: { o: GroupOverview; average: boolean; compact?: boolean }) {
  const t = o.sideBySide!;
  const head = (m: string) => `${MEASURE_SHORT[m] === "A level" ? "A-level pts" : MEASURE_SHORT[m]}`;
  const yearOfCol = (m: string) => (o.years.results[m] !== null ? periodLabel(o.years.results[m]!) : "");
  const cols = compact ? t.columns.slice(0, 1) : t.columns;
  const cell = (r: SideBySideData["rows"][number], m: string) => {
    const c = r.cells[m];
    const v = average ? c?.average : c?.value;
    if (r.missing) return <i className="text-[11px] font-normal text-[var(--muted2)]">no figures</i>;
    if ((v === null || v === undefined) && r.notPublished.includes(m)) return <i className="text-[11px] font-normal text-[var(--muted2)]">not published</i>;
    return (
      <>
        {fmt(v ?? null, unitOf(m), m === "ks5_aps_alevel" ? "aps_per_entry" : undefined)}
        {!compact && c && c.n !== null && c.n > 0 && <span className="ml-1 text-[10px] font-normal text-[var(--muted2)]">({c.n.toLocaleString("en-GB")})</span>}
      </>
    );
  };
  return (
    <div className="flex min-h-0 flex-col gap-2" data-side-by-side="">
      {!compact && <div className="text-[13px] font-bold text-[var(--fg)]">{o.group.name} against {o.picker.name}, side by side</div>}
      <div className="overflow-x-auto rounded-[10px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left">
              <Th className="w-[34%]"> </Th>
              {!compact && <Th>Schools</Th>}
              <Th>Roll, 5 years</Th>
              {!compact && <Th>Growing</Th>}
              {cols.map((m) => (
                <Th key={m}>
                  <span title={`${MEASURE_LABEL[m]}, ${yearOfCol(m)}`}>{head(m)}</span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.key} data-featured-row={r.ours ? "" : undefined} data-set-group={r.ours ? "ours" : r.key.slice(11)} className={`border-b border-[var(--panel-border)] ${r.ours ? "font-bold" : ""}`} style={r.ours ? { background: FEATURED_ROW_BG } : undefined}>
                <Td>
                  <span title={r.label} className="line-clamp-2 max-w-[22rem]">{r.label}</span>
                  <span className="block text-[10.5px] font-semibold text-[var(--muted2)]">
                    {r.typeSize}
                    {r.rank && !compact ? ` · ${r.rank}` : ""}
                  </span>
                </Td>
                {!compact && <Td>{r.schools === null ? "—" : r.schools.toLocaleString("en-GB")}</Td>}
                <Td className={`whitespace-nowrap ${dirClass(r.roll.pct, 0.5)}`}>{r.missing ? "—" : pctText(r.roll.pct)}</Td>
                {!compact && <Td title={`${r.growing.n} of ${r.growing.of} schools with both years`}>{r.growing.pct === null ? "—" : `${r.growing.pct.toFixed(0)}%`}</Td>}
                {cols.map((m) => (
                  <Td key={m} className="whitespace-nowrap">{cell(r, m)}</Td>
                ))}
              </tr>
            ))}
            <tr data-set-median="" className="border-b border-[var(--panel-border)] bg-[var(--box-bg)] italic">
              <Td>
                <span className="font-semibold not-italic">{compact ? "Median" : "Median of the set"}</span>
                <span className="block text-[10.5px] font-semibold not-italic text-[var(--muted2)]">
                  {ofGroupsWords(t.median.n, t.rows.length - 1)}
                  {t.median.mixed ? " · mixed types" : ""}
                </span>
              </Td>
              {!compact && <Td>{t.median.schools === null ? "—" : Math.round(t.median.schools).toLocaleString("en-GB")}</Td>}
              <Td className={`whitespace-nowrap ${dirClass(t.median.roll, 0.5)}`}>{pctText(t.median.roll)}</Td>
              {!compact && <Td>{t.median.growing === null ? "—" : `${t.median.growing.toFixed(0)}%`}</Td>}
              {cols.map((m) => {
                const c = t.median.cells[m];
                const v = average ? c?.average : c?.value;
                return (
                  <Td key={m} className="whitespace-nowrap" title={c ? `${ofGroupsWords(c.n, c.of)} with ${MEASURE_LABEL[m]}` : undefined}>
                    {fmt(v ?? null, unitOf(m), m === "ks5_aps_alevel" ? "aps_per_entry" : undefined)}
                    {!compact && c && <span className="ml-1 text-[10px] font-normal text-[var(--muted2)]">({c.n} of {c.of})</span>}
                  </Td>
                );
              })}
            </tr>
            {t.england && !compact && (
              <tr className="text-[var(--muted2)]">
                <Td>{t.england.label}</Td>
                <Td>{t.england.schools === null ? "—" : t.england.schools.toLocaleString("en-GB")}</Td>
                <Td className="whitespace-nowrap">{pctText(t.england.roll.pct)}</Td>
                <Td>{t.england.growing.pct === null ? "—" : `${t.england.growing.pct.toFixed(0)}%`}</Td>
                {cols.map((m) => {
                  const c = t.england!.cells[m];
                  return <Td key={m} className="whitespace-nowrap">{fmt((average ? c?.average : c?.value) ?? null, unitOf(m), m === "ks5_aps_alevel" ? "aps_per_entry" : undefined)}</Td>;
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!compact && (
        <div className="text-[11.5px] leading-snug text-[var(--muted2)]">
          Each group&rsquo;s own figures, {average ? "average school (each school counts once)" : "pupil-weighted"}; the median is of the groups&rsquo; figures, one vote per group with a figure. Ranks are within each group&rsquo;s own type. In brackets, the schools with that result.
        </div>
      )}
    </div>
  );
}

/** Pupils, Now: roll and its change side by side (our group, each group, the median). */
export function RollSideBySide({ o }: { o: GroupOverview }) {
  const t = o.sideBySide!;
  return (
    <div className="flex flex-col gap-1 text-[12px]" data-roll-side-by-side="">
      {t.rows.map((r) => (
        <div key={r.key} className={`flex items-baseline justify-between gap-2 border-b border-[var(--panel-border)] py-1 ${r.ours ? "font-bold" : ""}`}>
          <span className="min-w-0 truncate" title={`${r.label} · ${r.typeSize}`}>
            {r.label}
            <span className="ml-1 text-[10.5px] font-semibold text-[var(--muted2)]">{r.typeSize}</span>
          </span>
          <span className="shrink-0 tabular-nums">
            {r.pupils === null ? "—" : fmt(r.pupils, "pupils")} <span className={dirClass(r.roll.pct, 0.5)}>{pctText(r.roll.pct)}</span>
          </span>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-2 py-1 italic text-[var(--muted)]">
        <span>
          Median · {ofGroupsWords(t.median.n, t.rows.length - 1)}
          {t.median.mixed ? " · mixed types" : ""}
        </span>
        <span className="tabular-nums">
          {t.median.pupils === null ? "—" : fmt(t.median.pupils, "pupils")} <span className={dirClass(t.median.roll, 0.5)}>{pctText(t.median.roll)}</span>
        </span>
      </div>
      <div className="text-[10.5px] text-[var(--muted2)]">Pupils at the latest census; the change over 5 years, like for like.</div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ the trend

type Line = { key: string; label: string; pts: Pt[] };

/** A trend against a set of groups: `lines[0]` is our group, the rest the set's groups. */
export function SetTrend({ lines, title, format, fullscreen, room, reference, footnote, controls }: { lines: Line[]; title: ReactNode; format: (v: number) => string; fullscreen: boolean; room?: number; reference?: { y: number } | null; footnote?: ReactNode; controls?: ReactNode }) {
  const [ours, ...groups] = lines;
  const tr = useMemo(() => setTrend(groups), [groups]);
  const [showMedian, setShowMedian] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  if (!ours || ours.pts.filter((p) => p.value !== null).length < 2) return <Empty>Not enough years to draw a trend.</Empty>;
  const years = Array.from(new Set(lines.flatMap((l) => l.pts.map((p) => p.year)))).sort((a, b) => a - b);
  const xLabels: [string, string] | null = years.length ? [yr(years[0]), yr(years[years.length - 1])] : null;
  const medianSeries = { id: "median", label: "Median of the set", colour: MEDIAN, width: 1.8, dashed: "5 4", points: tr.median.map((p) => ({ x: p.year, y: p.value })) };
  const oursSeries = { id: ours.key, label: ours.label, colour: "var(--accent)", width: 2.8, points: ours.pts.map((p) => ({ x: p.year, y: p.value })) };
  const band = tr.band ? [{ id: "middle-half", colour: BAND, opacity: 0.14, points: tr.band }] : [];

  if (!fullscreen) {
    // The panel: ours, the median, the band. No hover, no pinning (D3).
    return (
      <>
        <div className="truncate text-[13px] font-bold text-[var(--fg)]">{title}</div>
        {controls}
        <LineChart height={controls ? 120 : 140} reference={reference ?? null} yFormat={format} xLabels={xLabels} bands={band} series={[medianSeries, oursSeries]} />
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
          <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>{ours.label}</Key>
          <Key swatch={<LineSwatch colour={MEDIAN} width={14} dashed />}>Median of {groups.length} groups</Key>
          {tr.band ? <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: BAND, opacity: 0.3 }} />}>Middle half</Key> : <span className="text-[10.5px] text-[var(--muted2)]" title={tr.bandNote}>No band under 4 groups (i)</span>}
        </div>
        {footnote && <div className="text-[10.5px] leading-snug text-[var(--muted)]">{footnote}</div>}
      </>
    );
  }

  // The large view: every group's line, ours on top, the list beside it.
  const forward = new Set([...pinned, ...(hover ? [hover] : [])]);
  const groupSeries = groups.map((g) => {
    const on = forward.has(g.key);
    return { id: g.key, label: g.label, colour: on ? "var(--group-strong,#c2410c)" : MUTED, width: on ? 2.2 : 1.1, opacity: on ? 1 : 0.45, points: g.pts.map((p) => ({ x: p.year, y: p.value })), title: (pt: { x: number; y: number | null }) => `${g.label} ${yr(pt.x)}: ${pt.y === null ? "—" : format(pt.y)}` };
  });
  // Lines brought forward are drawn last, so they sit above the muted ones (ours always on top).
  const ordered = [...groupSeries.filter((s) => !forward.has(s.id)), ...groupSeries.filter((s) => forward.has(s.id))];
  const last = (l: Line) => [...l.pts].reverse().find((p) => p.value !== null) ?? null;
  return (
    <div className="flex min-h-0 flex-col gap-2" data-set-trend-large="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-bold text-[var(--fg)]">{title}</div>
        {controls}
        <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian(!showMedian)} data-median-toggle="" className={`rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold ${showMedian ? "border-[var(--accent)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--muted2)]"}`}>
          Median and band: {showMedian ? "on" : "off"}
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-3 md:flex-row">
        <div className="min-w-0 flex-1">
          <LineChart height={fillHeight(room, 220, 420)} reference={reference ?? null} yFormat={format} xLabels={xLabels} bands={showMedian ? band : []} series={[...ordered, ...(showMedian ? [medianSeries] : []), oursSeries]} />
        </div>
        <ul className="flex shrink-0 flex-col gap-0.5 text-[12px] md:w-[240px]" aria-label="The set's groups" data-set-trend-list="">
          <li className="flex items-baseline justify-between gap-2 px-2 py-1 font-bold">
            <span className="min-w-0 truncate"><span className="mr-1.5 inline-block h-[3px] w-[12px] align-middle" style={{ background: "var(--accent)" }} />{ours.label}</span>
            <span className="shrink-0 tabular-nums">{last(ours) ? format(last(ours)!.value!) : "—"}</span>
          </li>
          {groups.map((g) => {
            const on = pinned.includes(g.key);
            return (
              <li key={g.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  data-set-trend-item={g.key}
                  onMouseEnter={() => setHover(g.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(g.key)}
                  onBlur={() => setHover(null)}
                  onClick={() => setPinned(on ? pinned.filter((x) => x !== g.key) : [...pinned, g.key])}
                  className={`flex min-h-[32px] w-full items-baseline justify-between gap-2 rounded-[8px] px-2 py-1 text-left hover:bg-[var(--box-bg)] ${on ? "bg-[var(--box-bg)] font-semibold" : ""}`}
                >
                  <span className="min-w-0 truncate">{g.label}{on && <span className="ml-1 rounded-[5px] bg-[var(--adm-tint)] px-[5px] text-[10px] font-bold text-[var(--adm-accent-text)]">pinned</span>}</span>
                  <span className="shrink-0 tabular-nums text-[var(--muted)]">{last(g) ? format(last(g)!.value!) : "—"}</span>
                </button>
              </li>
            );
          })}
          {showMedian && (
            <li className="flex items-baseline justify-between gap-2 px-2 py-1 italic text-[var(--muted)]">
              <span>Median</span>
              <span className="tabular-nums">{(() => { const m = [...tr.median].reverse().find((p) => p.value !== null); return m ? format(m.value!) : "—"; })()}</span>
            </li>
          )}
        </ul>
      </div>
      <div className="text-[10.5px] leading-snug text-[var(--muted)]">Hover or click a group to bring its line forward; click again to unpin. {bandWords(groups.length)}</div>
      {footnote && <div className="text-[10.5px] leading-snug text-[var(--muted)]">{footnote}</div>}
    </div>
  );
}
