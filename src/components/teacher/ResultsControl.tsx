"use client";

// VicData 0.6.1 S5 (D3 + D4): the dashboard top bar's Results switch and grade band choice,
// side by side -- for members (ControlBar, PhoneNav) and the editor's bar alike, one
// component, so the two can't drift.
//
//   Results: Average points ▾      the measure (saved under measure:results, as before)
//   Grades: 7–9 ▾                  Grade bands only: the range (saved under band:range)
//
// The band follows the focused subject's own scale (bandRangeFor, presetsFor): at GCSE 9–1
// the presets "4–9" and "7–9" plus Custom; 0.6.5 S1: at Post-16 the scale's one default
// (e.g. "A* to A") plus Custom; every other named scale Custom only.
// Custom opens an in-place range picker in the same popover: from grade ▾ to grade ▾.
// Never drawn inside an embed: meeting slots and previews set both through embed.ts.
//
// It replaces Column 1's own measure pill (MeasurePicker, under the column heading), the
// in-panel band row (Grade bands' presets and "Custom…") and the Grades view's
// click-two-grades picking -- the one place a member chooses which result they see.
import { useState } from "react";
import { PillMenu } from "./PillMenu";
import { MenuDivider, MenuHeading, MenuRow } from "./PanelMenu";
import { BOTTOM_RANK, GCSE_SCALE, presetsFor, spanBetween, type GradeRange, type PresetContext } from "@/lib/subject-grades";

// 0.6.5 S2: `disabledReason` greys a measure this focus can't have (A*-E on a BTEC, IB,
// T Level or Pre-U focus), with the reason on hover.
export type ResultsChoice = { id: string; label: string; disabledReason?: string };

export type BandChoice = {
  // The focused subject's own scale ([] = no published grades to pick from).
  scale: string[];
  range: GradeRange | null;
  onRange: (top: string, bottom: string) => void;
  // 0.6.5 S1: which presets the scale offers (Post-16's depend on the phase and qualification).
  presets?: PresetContext;
};

// "7–9" at GCSE 9–1 (bottom–top, as the presets say it); "A* to B" on a named scale.
export function bandValue(range: GradeRange): string {
  const gcse = range.scale === GCSE_SCALE || (range.scale.length === GCSE_SCALE.length && range.scale.every((g, i) => g === GCSE_SCALE[i]));
  if (range.top === range.bottom) return range.top;
  return gcse ? `${range.bottom}–${range.top}` : `${range.top} to ${range.bottom}`;
}

// The grades a range can start or end on: the scale's own, best first. "*" is a raw
// duplicate of A* in the source (subject-grades.ts), so it isn't offered on its own.
export function pickableGrades(scale: string[]): string[] {
  return scale.filter((g) => g !== "*" && !(g in BOTTOM_RANK));
}

export function ResultsControl({
  measures,
  active,
  onMeasure,
  band,
  align = "left",
  compact = false,
  nowrap = false,
}: {
  measures: ResultsChoice[];
  active: ResultsChoice;
  onMeasure: (id: string) => void;
  // Shown on Grade bands and Grade counts (0.6.3 S1: the counts selection IS the range);
  // null = no focused subject (nothing to pick a range on).
  band: BandChoice | null;
  align?: "left" | "right";
  // Phone width (PhoneNav): the band's popover opens from the pill's right edge, so it
  // stays inside a 390px screen.
  compact?: boolean;
  // The editor's bar: the two pills stay on one line.
  nowrap?: boolean;
}) {
  return (
    <div data-results-control="" className={`flex items-center gap-2 print:hidden ${nowrap ? "shrink-0 flex-nowrap" : "min-w-0 max-w-full flex-wrap"}`}>
      <PillMenu label="Results" value={active.label} menuLabel="Switch measure" width={236} align={align}>
        {(close) => (
          <>
            <MenuHeading>Switch measure</MenuHeading>
            {measures.map((m) => (
              <MenuRow
                key={m.id}
                label={m.label}
                selected={m.id === active.id}
                disabled={!!m.disabledReason}
                title={m.disabledReason}
                onClick={() => { onMeasure(m.id); close(); }}
              />
            ))}
          </>
        )}
      </PillMenu>
      {(active.id === "bands" || active.id === "counts") && band && <BandMenu band={band} align={compact ? "right" : align} width={compact ? 248 : 260} />}
    </div>
  );
}

function BandMenu({ band, align, width }: { band: BandChoice; align: "left" | "right"; width: number }) {
  const presets = presetsFor(band.scale, band.presets);
  const preset = band.range ? presets.find((p) => p.top === band.range!.top && p.bottom === band.range!.bottom) : undefined;
  const custom = !!band.range && !preset;
  const value = band.range ? (custom && presets.length ? `Custom ${bandValue(band.range)}` : bandValue(band.range)) : "Pick a range";
  return (
    <span data-band-control="" className="contents">
      <PillMenu label="Grades" value={value} menuLabel="Grade band" width={width} align={align} title={`Grades: ${value}`}>
        {(close) => <BandMenuBody band={band} presets={presets} preset={preset?.id ?? null} custom={custom} close={close} />}
      </PillMenu>
    </span>
  );
}

function BandMenuBody({ band, presets, preset, custom, close }: { band: BandChoice; presets: ReturnType<typeof presetsFor>; preset: string | null; custom: boolean; close: () => void }) {
  // No presets on this scale: the popover opens straight on the picker.
  const [picking, setPicking] = useState(presets.length === 0 || custom);
  const grades = pickableGrades(band.scale);
  return (
    <>
      <MenuHeading>Grade band</MenuHeading>
      {presets.map((p) => (
        <MenuRow key={p.id} label={`Grades ${p.label}`} selected={p.id === preset && !picking} onClick={() => { band.onRange(p.top, p.bottom); close(); }} />
      ))}
      {presets.length > 0 && <MenuRow label="Custom…" selected={picking} onClick={() => setPicking(true)} />}
      {picking &&
        (grades.length < 2 ? (
          <p className="px-2 py-1.5 text-[12px] text-[var(--muted)]">No published grades to pick a range from for this subject.</p>
        ) : (
          <>
            {presets.length > 0 && <MenuDivider />}
            <RangePicker grades={grades} scale={band.scale} range={band.range} onPick={(top, bottom) => { band.onRange(top, bottom); close(); }} />
          </>
        ))}
    </>
  );
}

const SELECT =
  "min-w-0 flex-1 rounded-lg border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 py-1.5 text-[13px] font-medium text-[var(--fg)]";

// From grade ▾ to grade ▾, best first; the two ends can be picked either way round.
function RangePicker({ grades, scale, range, onPick }: { grades: string[]; scale: string[]; range: GradeRange | null; onPick: (top: string, bottom: string) => void }) {
  const [from, setFrom] = useState(range && grades.includes(range.top) ? range.top : grades[0]);
  const [to, setTo] = useState(range && grades.includes(range.bottom) ? range.bottom : grades[Math.min(2, grades.length - 1)]);
  const span = spanBetween(scale, from, to);
  const label = bandValue({ scale, ...span });
  return (
    <div data-band-picker="" className="flex flex-col gap-2 px-2 pb-1 pt-1.5">
      <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
        <span>From</span>
        <select aria-label="From grade" value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT}>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <span>to</span>
        <select aria-label="To grade" value={to} onChange={(e) => setTo(e.target.value)} className={SELECT}>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => onPick(span.top, span.bottom)}
        className="rounded-full bg-[var(--fg)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--bg)] hover:opacity-90"
      >
        Show grades {label}
      </button>
    </div>
  );
}
