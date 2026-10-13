"use client";

// VicData 0.8 SMT r1: the grade profile -- the main qualification's entries in bands (GCSE 9-7, 6-5,
// 4, 3-1; A level A*-A, B, C, D-U), latest year, for the level in focus. R-SMT-VIEW-GRADES.
import { Empty } from "@/components/admissions/ui";
import type { StagePart } from "@/lib/smt/academic";
import { fmt, yearOf } from "../ui";

const SHADES = ["var(--accent)", "rgba(var(--accent-rgb),0.62)", "rgba(var(--accent-rgb),0.36)", "var(--adm-grey-bar)"];

export function GradeBar({ part }: { part: StagePart }) {
  const g = part.grades;
  return (
    <>
      <div className="flex h-[14px] w-full overflow-hidden rounded-[4px]" role="img" aria-label={g.bands.map((b) => `${b.label}: ${fmt(b.pct, "pct")}`).join(", ")}>
        {g.bands.map((b, i) => (
          <span key={b.label} title={`${b.label}: ${fmt(b.pct, "pct")} (${b.entries} entries)`} style={{ width: `${b.pct}%`, background: SHADES[i] }} />
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] text-[var(--muted2)]">
        {g.bands.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </>
  );
}

export function GradeProfile({ parts }: { parts: StagePart[] }) {
  const shown = parts.filter((p) => p.grades.entries > 0);
  if (!shown.length) return <Empty>No graded entries at this level.</Empty>;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Grade profile</div>
      {shown.map((p) => (
        <div key={p.stage} className="flex flex-col gap-2 rounded-[9px] border border-[var(--panel-border)] p-3">
          <div className="text-[12px] font-semibold text-[var(--chip-fg)]">
            {p.stage === "ks4" ? "GCSE (9-1) entries" : "A-level entries"} &middot; {yearOf(p.grades.period, p.stage)} &middot; {fmt(p.grades.entries, "pupils")} graded
          </div>
          <GradeBar part={p} />
          <div className="grid grid-cols-4 gap-2">
            {p.grades.bands.map((b) => (
              <div key={b.label} className="flex flex-col">
                <span className="text-[16px] font-extrabold tabular-nums text-[var(--fg)]">{fmt(b.pct, "pct")}</span>
                <span className="text-[10.5px] text-[var(--muted2)]">
                  {b.label} &middot; {b.entries}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
