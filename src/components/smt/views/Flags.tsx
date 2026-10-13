"use client";

// VicData 0.8 SMT r1: Overview's Flags -- Admissions-style flags on the school itself: roll falling
// three years running, results moving faster than the set's middle, the entry cohort shrinking.
// Each with the figures behind it; thresholds in one file (src/lib/smt/flags.ts). R-SMT-FLAGS.
import { FlagPill } from "@/components/admissions/ui";
import { figuresOf } from "@/components/admissions/views/Momentum";
import { smtNote } from "@/catalogue/notes";
import { SMT_FLAG_RULES } from "@/lib/smt/flags-rules";
import type { Overview } from "../api";

export function SchoolFlags({ o }: { o: Overview }) {
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
        <div className="rounded-[9px] border border-dashed border-[var(--panel-border2)] p-4 text-center text-[12px] text-[var(--muted2)]">{o.flagsLoaded ? smtNote("flagsNone") : "Flags not available yet: the national thresholds aren't loaded, and no flag is ever guessed."}</div>
      )}
      <div className="mt-auto text-[11px] leading-[1.4] text-[var(--muted2)]">{smtNote("flagsRule", { gap: `${SMT_FLAG_RULES.resultsGap.ks4} Attainment 8 points or ${SMT_FLAG_RULES.resultsGap.ks5} A-level points` })}</div>
    </>
  );
}
