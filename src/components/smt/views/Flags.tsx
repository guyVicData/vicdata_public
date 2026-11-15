"use client";

// VicData 0.8 SMT r1: Overview's Flags -- Admissions-style flags on the school itself: roll falling
// three years running, results moving faster than the set's middle, the entry cohort shrinking.
// Each with the figures behind it; thresholds in one file (src/lib/smt/flags.ts). R-SMT-FLAGS.
import { FlagPill } from "@/components/admissions/ui";
import { figuresOf } from "@/components/admissions/views/Momentum";
import { smtNote } from "@/catalogue/notes";
import { flagsRuleText } from "@/lib/smt/flags-rules";
import type { SchoolPhases } from "@/lib/smt/levels";
import type { Overview } from "../api";
import { periodLabel } from "@/catalogue/years";
import { signedDelta } from "@/lib/signed-delta";

const signed = (v: number, dp = 1) => signedDelta(v, (x) => Math.abs(x).toFixed(dp), { zero: "±" });

/** 0.8 feedback C (C9, SMT 5, D5): with no flag, the figures closest to one, nearest first, each with what a
 * flag would need -- so an empty panel still says how far each figure is from a flag. */
export function ClosestToAFlag({ o }: { o: Overview }) {
  const w = o.flagWatch;
  if (!w) return null;
  const rows: { key: string; share: number; text: string }[] = [
    ...w.results.map((r) => ({
      key: `results-${r.stage}`,
      share: Math.abs(r.gap) / r.threshold,
      text: `${r.what}: ${signed(r.change)} from ${periodLabel(r.fromYear)} to ${periodLabel(r.toYear)}, against the set's middle ${signed(r.setMiddle)} (${r.schools} schools): a gap of ${signed(r.gap)}; a flag needs ±${r.threshold}.`,
    })),
    ...(w.roll ? [{ key: "roll", share: w.roll.falls / 3, text: `Roll: fell in ${w.roll.falls} of the last 3 years (${w.roll.from?.toLocaleString("en-GB")} in ${periodLabel(w.roll.fromYear)}, ${w.roll.to?.toLocaleString("en-GB")} in ${periodLabel(w.roll.toYear)}); a flag needs three falls in a row.` }] : []),
  ].sort((a, b) => b.share - a.share);
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-1.5" data-flag-watch="">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-[var(--muted2)]">Closest to a flag</div>
      {rows.map((r) => (
        <div key={r.key} data-flag-watch-row={r.key} className="flex items-center gap-2 text-[12px] leading-snug text-[var(--chip-fg)]">
          <span aria-hidden="true" className="relative h-[6px] w-[48px] shrink-0 overflow-hidden rounded-full bg-[var(--box-bg)] ring-1 ring-[var(--panel-border)]">
            <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.round(r.share * 100))}%` }} />
          </span>
          <span>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

export function SchoolFlags({ o, phases }: { o: Overview; phases: SchoolPhases }) {
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Flags: large and lasting changes</div>
      {o.flags.length ? (
        <div className="flex flex-col gap-2">
          {o.flags.map((f) => (
            <div key={f.id} className="flex flex-col gap-1 rounded-[9px] border border-[var(--panel-border)] px-3 py-2">
              <span>
                <FlagPill tone={f.tone} figures={figuresOf(f as never)}>
                  {f.label}
                </FlagPill>
              </span>
              <span className="text-[11.5px] leading-snug text-[var(--muted2)]">{figuresOf(f as never)}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-[9px] border border-dashed border-[var(--panel-border2)] p-4 text-center text-[12px] text-[var(--muted2)]">{o.flagsLoaded ? smtNote("flagsNone") : "Flags not available yet: the national thresholds aren't loaded, and no flag is ever guessed."}</div>
          <ClosestToAFlag o={o} />
        </>
      )}
      <div className="mt-auto pt-2 text-[11px] leading-[1.4] text-[var(--muted2)]">{flagsRuleText(phases)}</div>
    </>
  );
}
