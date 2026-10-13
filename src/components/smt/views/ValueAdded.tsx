"use client";

// VicData 0.8 SMT r1: Academic's Value added -- A-level value added by qualification type (the two
// published years, DfE's 95% interval and banding), by subject (dfe_ks5_subject_value_added), and
// Progress 8 where DfE published it, or which reason applies. Honest wording from SMT_NOTES.
// R-SMT-VA-HONEST, R-SMT-P8-REASON.
import { Empty, Lbl } from "@/components/admissions/ui";
import { SMT_NOTES } from "@/catalogue/notes";
import type { Academic, SmtSchool } from "../api";
import { Td, Th, fmt, yearOf } from "../ui";

function Interval({ value, lo, hi }: { value: number | null; lo: number | null; hi: number | null }) {
  if (value === null) return <span>—</span>;
  const span = 1.2; // the axis runs -1.2 to +1.2
  const x = (v: number) => `${Math.max(0, Math.min(100, ((v + span) / (2 * span)) * 100))}%`;
  const clear = lo !== null && hi !== null && (lo > 0 || hi < 0);
  return (
    <span className="relative block h-[14px] w-full min-w-[120px]" title={lo !== null ? `${fmt(value, "va")} (95% range ${fmt(lo, "va")} to ${fmt(hi, "va")})${clear ? "" : ": not clearly different from average"}` : fmt(value, "va")}>
      <span className="absolute bottom-0 left-1/2 top-0 w-px bg-[var(--edge-strong)]" />
      {lo !== null && hi !== null && <span className="absolute top-[6px] h-[2px] bg-[var(--adm-grey-2)]" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />}
      <span className="absolute top-[3px] h-[8px] w-[8px] -translate-x-1/2 rounded-full" style={{ left: x(value), background: clear ? "var(--accent)" : "var(--adm-grey-soft)" }} />
    </span>
  );
}

export function ValueAdded({ a, school }: { a: Academic; school: SmtSchool }) {
  const phase = a.level.phase;
  if (phase === "primary") return <Empty>{SMT_NOTES.vaNotKs2}</Empty>;
  const showP8 = (phase === "gcse" || phase === "whole") && school.phases.gcse;
  const showA = (phase === "post16" || phase === "whole") && school.phases.post16;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Value added</div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        {showP8 && (
          <div className="flex flex-col gap-1">
            <Lbl>Progress 8 (GCSE)</Lbl>
            <div className="text-[12.5px] leading-[1.45] text-[var(--chip-fg)]" data-p8={a.va.p8.status}>
              {a.va.p8.status === "published" ? (
                <>
                  <b className="text-[var(--fg)]">{fmt(a.va.p8.value, "va")}</b> in {yearOf(a.va.p8.period)}
                  {a.va.p8.lo !== null ? ` (95% range ${fmt(a.va.p8.lo, "va")} to ${fmt(a.va.p8.hi, "va")})` : ""}. {a.va.p8.text}
                </>
              ) : (
                a.va.p8.text
              )}
            </div>
            {phase === "gcse" && <div className="text-[11.5px] text-[var(--muted2)]">{SMT_NOTES.vaNoGcseSubjects}</div>}
          </div>
        )}
        {showA && (
          <div className="flex flex-col gap-1">
            <Lbl>A-level value added, by qualification type</Lbl>
            {a.va.alevel.length ? (
              <table className="w-full border-collapse">
                <thead className="border-b border-[var(--panel-border)]">
                  <tr>
                    <Th>Qualification</Th>
                    <Th>Year</Th>
                    <Th>Value added</Th>
                    <Th className="w-[40%]">Against average (0)</Th>
                    <Th>DfE banding</Th>
                  </tr>
                </thead>
                <tbody>
                  {a.va.alevel.map((r) => (
                    <tr key={`${r.qualification}|${r.period}`} className="border-b border-[var(--panel-border)] last:border-0">
                      <Td className="text-[var(--fg)]">{r.qualification}</Td>
                      <Td>{yearOf(r.period)}</Td>
                      <Td className="font-bold text-[var(--fg)]">{fmt(r.value, "va")}</Td>
                      <Td>
                        <Interval value={r.value} lo={r.lo} hi={r.hi} />
                      </Td>
                      <Td>{r.banding ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-[12px] text-[var(--muted2)]">{SMT_NOTES.vaNotPublished}</div>
            )}
            {a.va.subjects.length > 0 && (
              <>
                <Lbl>By subject, {yearOf(a.va.subjects[0].period)}</Lbl>
                <table className="w-full border-collapse">
                  <tbody>
                    {a.va.subjects.slice(0, 14).map((r) => (
                      <tr key={`${r.subject}|${r.qualification}`} className="border-b border-[var(--panel-border)] last:border-0">
                        <Td className="text-[var(--fg)]" title={r.qualification}>
                          {r.subject}
                        </Td>
                        <Td>{r.entries ?? "—"} entries</Td>
                        <Td className="font-bold text-[var(--fg)]">{fmt(r.value, "va")}</Td>
                        <Td className="w-[40%]">
                          <Interval value={r.value} lo={r.lo} hi={r.hi} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <div className="text-[11px] leading-[1.4] text-[var(--muted2)]">{SMT_NOTES.alevelVa}</div>
          </div>
        )}
      </div>
    </>
  );
}
