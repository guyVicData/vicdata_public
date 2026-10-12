"use client";

// VicData 0.7 admissions r2 (D3): the funnel -- births → the Year 6 (or Year 11) pools in the set →
// the entry cohort, for this September's entrants (R-ADM-VIEW-FUNNEL). Each stage is its own count
// from its own source, labelled so: not a flow of the same children. For a boarding entry point the
// ISC context note sits under it (international pupils aren't in the census).
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import type { PipelineOk } from "../api";
import { Empty, ViewTitle, fmtN } from "../ui";
import { cohortWord } from "../panels/EntryNow";

export function Funnel({ p, fullscreen }: { p: PipelineOk; fullscreen: boolean }) {
  const stages = p.funnel;
  const max = Math.max(1, ...stages.map((s) => s.value ?? 0));
  if (!stages.some((s) => s.value !== null)) return <Empty>No figures to follow back for this entry point.</Empty>;
  const sourceOf = (s: (typeof stages)[number]) =>
    s.kind === "births"
      ? `ONS births, academic year to August ${s.year}, in the LA blend (${p.blend.map((b) => `${b.laName ?? b.laCode} ${Math.round(b.weight * 100)}%`).join(" · ")}). ${ADMISSIONS_NOTES.birthSplit}`
      : s.kind === "pool"
        ? `January ${(s.year ?? 0) + 1} census: aged ${s.age} in the ${s.schools} schools of this rung.`
        : `January ${(s.year ?? 0) + 1} census: your own pupils aged ${s.age}.`;
  return (
    <>
      <ViewTitle>From births to your {cohortWord(p.entry.age)}: this September&rsquo;s entrants, followed back</ViewTitle>
      <div className="flex grow flex-col justify-center gap-3" style={{ minHeight: fullscreen ? 360 : 230 }}>
        {stages.map((s, i) => {
          const w = s.value === null ? 0 : Math.max(6, (s.value / max) * 100);
          return (
            <div key={i} className="flex flex-col items-center gap-1" title={sourceOf(s)}>
              <div className="flex w-full items-center justify-center">
                <span
                  className="flex h-[34px] items-center justify-center rounded-[6px] text-[13px] font-extrabold tabular-nums"
                  style={{ width: `${w}%`, background: s.kind === "entry" ? "var(--accent)" : s.kind === "births" ? "var(--adm-grey-bar)" : "var(--adm-tint)", color: s.kind === "entry" ? "var(--adm-on-accent)" : "var(--fg)", border: s.kind === "pool" ? "1px solid var(--accent)" : undefined }}
                >
                  {s.value === null ? "not held" : fmtN(s.value)}
                </span>
              </div>
              <span className="text-[11px] text-[var(--muted2)]">
                {s.label}
                {s.year !== null && s.kind !== "births" ? ` · ${s.year}/${String((s.year + 1) % 100).padStart(2, "0")}` : s.kind === "births" ? ` · born ${(s.year ?? 0) - 1}/${String((s.year ?? 0) % 100).padStart(2, "0")}` : ""}
                {s.kind === "births" ? ` · ${ADMISSIONS_NOTES.estimate.toLowerCase()} for the area` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {p.school.boarding && <div className="rounded-[9px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-2 text-[11.5px] leading-snug text-[var(--chip-fg)]">{ADMISSIONS_NOTES.boardingCensus}</div>}
    </>
  );
}
