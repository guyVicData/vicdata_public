"use client";

// VicData 0.8 Admissions feedback round 1 (F-13, Guy's decision of 29 Oct): the Funnel rebuilt as "Why did
// our intake change?" -- a waterfall from your entry cohort in 2019/20 to the latest year, split into three
// parts in one area, the school's catchment radius (never its feeder list): births (cohort size), families
// moving (the area's Year 6 against its births) and your share (your Year 7 against the area's Year 6). 16+:
// the area's Year 11 and your Year 12. No funnel at 4+. Every figure comes from the server (intake.ts); the
// split is exact (the parts add up to the change), rounded to whole pupils. R-ADM-VIEW-INTAKE-CHANGE.
//
// Local births, next to it on the rail: the catchment's births (age 0) by year, indexed against the
// region and England, with the Year 7 (Year 12) entry each birth year reaches. R-ADM-VIEW-LOCAL-BIRTHS.
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { indexedLabel } from "@/lib/index-base";
import type { PipelineOk } from "../api";
import { Empty, Key, LineSwatch, ViewTitle, fillHeight, fmtN, yearLabel } from "../ui";
import { cohortWord } from "../panels/EntryNow";
import { LineChart, useWidth, yearTicks } from "./charts";

type Intake = PipelineOk["intake"];
type IntakeOk = Extract<Intake, { status: "ok" }>;

const yearWord = (age: number) => (age <= 4 ? "Reception" : `Year ${age - 4}`);
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");
const pct = (v: number) => `${v < 0.1 ? v.toFixed(2) : v.toFixed(1)}%`;
const span = (ys: number[], label: (y: number) => string) => (ys.length > 1 ? `${label(ys[0])}–${label(ys[ys.length - 1])}` : label(ys[0]));

/** "15 km around Leighton Park School (not your feeder list)": the chip and the title name the area. */
export const intakeAreaWords = (a: { label: string }) => `${a.label} (not your feeder list)`;

/** The three parts' words: label, then what moved, at each end. */
export function partWords(v: IntakeOk): Record<"births" | "moving" | "share", { label: string; sub: string }> {
  const { base, latest } = v.ends;
  const area = yearWord(v.areaAge);
  const born = v.birthsAge === 0 ? "births" : `children aged ${v.birthsAge}`;
  return {
    births: { label: v.birthsAge === 0 ? "Births" : "Cohort size", sub: `${born} in the area: ${fmtN(base.births)} → ${fmtN(latest.births)}` },
    moving: { label: "Families moving", sub: `the area’s ${area} per ${v.birthsAge === 0 ? "birth" : `child aged ${v.birthsAge}`}: ${(base.area / base.births).toFixed(2)} → ${(latest.area / latest.births).toFixed(2)}` },
    share: { label: "Your share", sub: `your ${yearWord(v.entryAge)} of the area’s ${area}: ${pct((100 * base.school) / base.area)} → ${pct((100 * latest.school) / latest.area)}` },
  };
}

/** The (i)'s variables (methods-admissions.ts' {placeholders}). */
export function intakeMethodVars(v: Intake): Record<string, string | number | null> {
  if (v.status !== "ok") return { radius: v.area?.label ?? null, how: v.area?.how ?? null };
  return {
    radius: v.area.label,
    how: v.area.how,
    lsoas: v.area.lsoaCount,
    birthsAge: v.birthsAge,
    birthsNote:
      v.birthsAge === 0
        ? "Births are the area's children aged 0 in the mid-year their school year began."
        : `The area's population figures start in mid-${v.area.firstYear}, after the ${yearLabel(v.baseYear)} ${yearWord(v.entryAge)} were born, so their cohort size is counted at age ${v.birthsAge} (mid-${v.birthYears.base[0]}), the youngest age held for them; the latest cohort is counted at the same age (mid-${v.birthYears.latest[0]}), so the two ends are like with like. "Births" in this view therefore means children aged ${v.birthsAge} living in the area.`,
    averagedNote: v.averaged ? `Your intake is under 30 at one end, so each end is a 3-year average: ${span(v.years.base, yearLabel)} and ${span(v.years.latest, yearLabel)}.` : "Each end is one year.",
    base: yearLabel(v.baseYear),
    latest: yearLabel(v.latestYear),
    areaYear: yearWord(v.areaAge),
    entryYear: yearWord(v.entryAge),
  };
}

export function Funnel({ p, fullscreen, room }: { p: PipelineOk; fullscreen: boolean; room?: number }) {
  const v = p.intake;
  if (p.entry.age <= 4) return <Empty>No funnel at 4+: there are no Reception projections yet.</Empty>;
  if (v.status !== "ok") return <Empty>{v.reason}</Empty>;
  const words = partWords(v);
  const steps: { key: string; label: string; sub: string; from: number; to: number; kind: "end" | "part" }[] = [];
  let run = v.split.start;
  steps.push({ key: "start", label: `Your ${yearWord(v.entryAge)}`, sub: span(v.years.base, yearLabel), from: 0, to: run, kind: "end" });
  for (const part of v.split.parts) {
    steps.push({ key: part.key, label: words[part.key].label, sub: words[part.key].sub, from: run, to: run + part.value, kind: "part" });
    run += part.value;
  }
  steps.push({ key: "end", label: `Your ${yearWord(v.entryAge)}`, sub: span(v.years.latest, yearLabel), from: 0, to: v.split.end, kind: "end" });
  return (
    <>
      <ViewTitle>Why did our intake change?</ViewTitle>
      <div className="text-[11.5px] leading-snug text-[var(--muted2)]">
        Your {cohortWord(v.entryAge)}, {yearLabel(v.baseYear)} to {yearLabel(v.latestYear)}: <b className="text-[var(--fg)]">{signed(v.split.change)}</b> ({fmtN(v.split.start)} &rarr; {fmtN(v.split.end)}), within {intakeAreaWords(v.area)}.
      </div>
      <Waterfall steps={steps} height={fullscreen ? fillHeight(room, 150, 380) : 250} />
      {v.averaged && <div className="text-[10.5px] text-[var(--muted)]">{ADMISSIONS_NOTES.intakeAveraged}</div>}
      {v.area.boarding && <div className="rounded-[9px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-2 text-[11.5px] leading-snug text-[var(--chip-fg)]">{ADMISSIONS_NOTES.intakeBoarding}</div>}
    </>
  );
}

type Step = { key: string; label: string; sub: string; from: number; to: number; kind: "end" | "part" };

/** The waterfall: the two ends as solid bars, each part floating from the running total, up in the
 * accent and down in orange. The axis starts below the lowest running total (said under it), so a
 * change of a few pupils on an intake of 200 can be seen. */
function Waterfall({ steps, height }: { steps: Step[]; height: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const levels = steps.flatMap((s) => (s.kind === "end" ? [s.to] : [s.from, s.to]));
  const lo0 = Math.min(...levels);
  const hi = Math.max(...levels);
  const span = Math.max(hi - lo0, 0.15 * hi, 4);
  const raw = Math.max(0, lo0 - span * 0.6);
  const step = raw > 200 ? 50 : raw > 50 ? 10 : 5;
  const lo = Math.floor(raw / step) * step;
  const top = hi + span * 0.18;
  const W = Math.max(w, 10);
  const col = W / steps.length;
  // A phone's columns are too narrow for the detail line: it stays in the hover, and the label wraps.
  const narrow = col < 110;
  const labelH = narrow ? 34 : 58;
  const plotH = Math.max(80, height - labelH);
  const bar = Math.min(64, col * 0.56);
  const y = (v: number) => 14 + (plotH - 14) * (1 - (v - lo) / (top - lo || 1));
  return (
    <div ref={ref} data-waterfall="" className="w-full">
      {w > 0 && (
        <svg width={W} height={plotH + labelH} role="img" aria-label={steps.map((s) => `${s.label} ${s.kind === "end" ? s.to : signed(s.to - s.from)}`).join(", ")}>
          <line x1={0} x2={W} y1={plotH} y2={plotH} stroke="var(--adm-axis)" />
          {steps.map((s, i) => {
            const cx = col * i + col / 2;
            const a = s.kind === "end" ? lo : s.from;
            const b = s.to;
            const up = b >= a;
            const fill = s.kind === "end" ? "var(--accent)" : up ? "var(--adm-tint)" : "var(--adm-down-bg)";
            const stroke = s.kind === "end" ? "none" : up ? "var(--accent)" : "var(--adm-orange)";
            const yTop = y(Math.max(a, b));
            const hBar = Math.max(2, Math.abs(y(a) - y(b)));
            const value = s.kind === "end" ? fmtN(s.to) : signed(s.to - s.from);
            return (
              <g key={s.key} data-step={s.key} data-value={s.kind === "end" ? s.to : s.to - s.from}>
                <title>{`${s.label}: ${value}. ${s.sub}`}</title>
                {i < steps.length - 1 && <line x1={cx + bar / 2} x2={cx + col - bar / 2} y1={y(s.to)} y2={y(s.to)} stroke="var(--adm-grey-line)" strokeDasharray="2 3" />}
                <rect x={cx - bar / 2} y={yTop} width={bar} height={hBar} rx={3} fill={fill} stroke={stroke} strokeWidth={s.kind === "end" ? 0 : 1.2} />
                <text x={cx} y={yTop - 5} textAnchor="middle" fontSize={12.5} fontWeight={800} fill={s.kind === "end" ? "var(--fg)" : up ? "var(--adm-accent-text)" : "var(--adm-orange)"}>
                  {value}
                </text>
                <foreignObject x={col * i + 2} y={plotH + 4} width={col - 4} height={labelH - 4}>
                  <div className="text-center leading-[1.2]">
                    <div className={`font-bold text-[var(--fg)] ${narrow ? "text-[10px]" : "text-[11px]"}`}>{s.label}</div>
                    {!narrow && <div className="mt-[2px] text-[9.5px] leading-[1.25] text-[var(--muted)]">{s.sub}</div>}
                    {narrow && s.kind === "end" && <div className="text-[9.5px] text-[var(--muted)]">{s.sub}</div>}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      )}
      {lo > 0 && <div className="text-[10px] text-[var(--muted)]">The bars start at {fmtN(lo)}, not 0, so the parts can be seen.</div>}
    </div>
  );
}

// ----------------------------------------------------------------------------- Local births

type Births = PipelineOk["localBirths"];

export function LocalBirths({ p, fullscreen, room }: { p: PipelineOk; fullscreen: boolean; room?: number }) {
  const v = p.localBirths;
  if (v.status !== "ok") return <Empty>{v.reason}</Empty>;
  const years = v.rows.map((r) => r.year);
  const entryWord = v.entryAge === 4 ? "Reception" : yearWord(v.entryAge);
  const ix = v.indexed;
  const raw = (k: "catchment" | "region" | "england", y: number) => v.rows.find((r) => r.year === y)?.[k] ?? null;
  const mid = years[Math.floor((years.length - 1) / 2)];
  return (
    <>
      <ViewTitle>Births within {v.area.label}, against {v.regionName ?? "the region"} and England</ViewTitle>
      <LineChart
        height={fullscreen ? fillHeight(room, 160, 300) : 165}
        reference={{ y: 100 }}
        yFormat={(x) => x.toFixed(0)}
        xLabels={[String(years[0]), String(years[years.length - 1])]}
        ticks={yearTicks(years, String)}
        xLabels2={{ caption: `${entryWord} entry in`, labels: [yearLabel(years[0] + v.entryAge), yearLabel(years[years.length - 1] + v.entryAge), years.length > 2 ? yearLabel(mid + v.entryAge) : null] }}
        series={[
          { id: "en", label: "England", colour: "var(--adm-grey-2)", width: 1.6, dashed: "4 3", points: ix.england.map((x) => ({ x: x.year, y: x.value })), title: (pt) => `England ${pt.x}: ${pt.y?.toFixed(0)} (${fmtN(raw("england", pt.x))} aged 0)` },
          { id: "rg", label: v.regionName ?? "Region", colour: "var(--adm-grey-soft)", width: 1.6, points: ix.region.map((x) => ({ x: x.year, y: x.value })), title: (pt) => `${v.regionName ?? "Region"} ${pt.x}: ${pt.y?.toFixed(0)} (${fmtN(raw("region", pt.x))} aged 0)` },
          { id: "me", label: "Your catchment", colour: "var(--accent)", points: ix.catchment.map((x) => ({ x: x.year, y: x.value })), title: (pt) => `Within ${v.area.label} ${pt.x}: ${pt.y?.toFixed(0)} (${fmtN(raw("catchment", pt.x))} aged 0; ${entryWord} in ${yearLabel(pt.x + v.entryAge)})` },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Within {v.area.km} km</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-soft)" width={14} weight={2} />}>{v.regionName ?? "Region"}</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-2)" width={14} weight={2} dashed />}>England</Key>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">Indexed: {indexedLabel(v.base, "calendar")}. Mid-year births (children aged 0), so each year reaches {entryWord} {v.entryAge} years on.</div>
    </>
  );
}

export function localBirthsMethodVars(v: Births): Record<string, string | number | null> {
  if (v.status !== "ok") return { radius: v.area?.label ?? null, how: v.area?.how ?? null };
  return { radius: v.area.label, how: v.area.how, lsoas: v.area.lsoaCount, region: v.regionName, base: v.base, first: v.rows[0]?.year ?? null, last: v.rows[v.rows.length - 1]?.year ?? null, entryAge: v.entryAge };
}
