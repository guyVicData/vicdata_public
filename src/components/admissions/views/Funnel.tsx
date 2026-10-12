"use client";

// VicData 0.7 admissions r2 (D3), r3 (F7): the funnel -- births → the Year 6 (or Year 11) pool →
// your entry cohort, for this September's entrants, like with like (R-ADM-VIEW-FUNNEL,
// R-ADM-FUNNEL-SAME-AREA). Births and the pool cover the same area with the same weights (the
// school's own LA, or the lead's blend), and the pool is every pupil of that age in every school
// there, state and independent. Each bar leads with a bold label, then the area and the year in
// plain words (ADMISSIONS_NOTES); the hover keeps the method. "Not a flow of the same children" is
// the panel's note. For a boarding school the ISC context note sits under it.
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { cleanLaNameForDisplay } from "@/lib/la-name-display";
import type { PipelineOk } from "../api";
import { Empty, ViewTitle, fillHeight, fmtN, yearLabel } from "../ui";
import { cohortWord } from "../panels/EntryNow";

type Stage = PipelineOk["funnel"][number];
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const laWord = (x: { laCode: string; laName: string | null }) => (x.laName ? cleanLaNameForDisplay(x.laName) : x.laCode);

/** "Worcestershire", or "Worcestershire 70% · Herefordshire 30%" for a blend. */
export function areaWords(area: Stage["area"]): string {
  if (!area?.length) return "the area";
  if (area.length === 1) return laWord(area[0]);
  return area.map((x) => `${laWord(x)} ${Math.round(x.weight * 100)}%`).join(" · ");
}

/** The words after a bar's bold label. */
export function stageWords(s: Stage): string {
  const area = areaWords(s.area);
  if (s.kind === "births") return fill(ADMISSIONS_NOTES.funnelBirths, { area, from: (s.year ?? 0) - 1, to: s.year ?? 0 });
  if (s.kind === "pool") return fill((s.area?.length ?? 0) > 1 ? ADMISSIONS_NOTES.funnelPoolBlend : ADMISSIONS_NOTES.funnelPoolOne, { area, year: yearLabel(s.year ?? 0) });
  return fill(ADMISSIONS_NOTES.funnelEntry, { year: yearLabel(s.year ?? 0) });
}

function method(s: Stage): string {
  const sexSplit = !!s.bySex;
  if (s.kind === "births") return `ONS births by calendar year, in ${areaWords(s.area)}. ${ADMISSIONS_NOTES.birthSplit}${sexSplit ? ` ${ADMISSIONS_NOTES.birthSex}` : ""}`;
  if (s.kind === "pool") return `${fill(ADMISSIONS_NOTES.funnelPoolMethod, { age: s.age ?? "" })}${s.schools ? ` ${fmtN(s.schools)} schools.` : ""} ${ADMISSIONS_NOTES.areaUndercount}${s.value === null && sexSplit ? ` ${ADMISSIONS_NOTES.funnelPoolBySex}` : ""}`;
  return `January ${(s.year ?? 0) + 1} census: your own pupils aged ${s.age}.`;
}

export function Funnel({ p, fullscreen, room }: { p: PipelineOk; fullscreen: boolean; room?: number }) {
  const stages = p.funnel;
  if (!stages.length) return <Empty>No funnel at 4+: there are no Reception projections yet.</Empty>;
  if (!stages.some((s) => s.value !== null)) return <Empty>No figures to follow back for this entry point.</Empty>;
  const max = Math.max(1, ...stages.map((s) => s.value ?? 0));
  return (
    <>
      <ViewTitle>From births to your {cohortWord(p.entry.age)}: this September&rsquo;s entrants, followed back</ViewTitle>
      <div className="flex grow flex-col justify-center gap-3" style={{ minHeight: fullscreen ? fillHeight(room, 90, 360) : 230 }}>
        {stages.map((s, i) => {
          const w = s.value === null ? 0 : Math.max(6, (s.value / max) * 100);
          return (
            <div key={i} className="flex flex-col items-center gap-1" title={method(s)}>
              <div className="flex w-full items-center justify-center">
                <span
                  className="flex h-[34px] items-center justify-center rounded-[6px] text-[13px] font-extrabold tabular-nums"
                  style={{ width: `${w}%`, minWidth: 64, background: s.kind === "entry" ? "var(--accent)" : s.kind === "births" ? "var(--adm-grey-bar)" : "var(--adm-tint)", color: s.kind === "entry" ? "var(--adm-on-accent)" : "var(--fg)", border: s.kind === "pool" ? "1px solid var(--accent)" : undefined }}
                >
                  {s.value === null ? "not held" : fmtN(s.value)}
                </span>
              </div>
              <span className="text-center text-[11px] text-[var(--muted2)]">
                <b className="font-bold text-[var(--fg)]">{s.label}</b> {stageWords(s)}
              </span>
            </div>
          );
        })}
      </div>
      {p.school.boarding && <div className="rounded-[9px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-2 text-[11.5px] leading-snug text-[var(--chip-fg)]">{ADMISSIONS_NOTES.boardingCensus}</div>}
    </>
  );
}
