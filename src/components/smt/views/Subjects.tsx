"use client";

// VicData 0.8 SMT r1: Academic's Subjects -- the area's subjects (or the phase's, at All areas):
// entries, Teacher's average points, the rank in the set and in England (Teacher's subjectRanking,
// so the figures match the subject explorer's), "Since 2022/23", and "Subject explorer ->" with the
// same set (?set=, r2b). Below the minimum entries a subject isn't ranked. R-SMT-VIEW-SUBJECTS.
import Link from "next/link";
import { Empty } from "@/components/admissions/ui";
import { TREND_BASE_PERIOD, periodLabel } from "@/catalogue/years";
import { smtNote } from "@/catalogue/notes";
import type { StagePart } from "@/lib/smt/academic";
import { MIN_SUBJECT_ENTRIES_UI } from "@/lib/smt/levels";
import { Td, Th, dirClass, fmt, rankText } from "../ui";

export function explorerHref(stage: "ks4" | "ks5", setUrns: string[], setLabel: string, subject?: string): string {
  const q = new URLSearchParams();
  if (setUrns.length) q.set("set", setUrns.slice(0, 30).join(","));
  if (setUrns.length) q.set("setLabel", setLabel);
  if (subject) q.set("subject", subject);
  const s = q.toString().replace(/%2C/g, ",");
  return `/teacher/${stage}${s ? `?${s}` : ""}`;
}

export function Subjects({ parts, setUrns, setLabel, phase }: { parts: StagePart[]; setUrns: string[]; setLabel: string; phase: string }) {
  if (phase === "whole" || phase === "primary") return <Empty>{phase === "primary" ? "KS2 results have no subjects to rank." : "Choose GCSE or Post-16 to see its subjects, each ranked against the set."}</Empty>;
  const p = parts[0];
  if (!p || !p.subjects.length) return <Empty>No subjects in this area.</Empty>;
  const unit = p.stage === "ks4" ? "grade" : "points";
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Each subject, its rank, and where it&rsquo;s heading</div>
      <div className="min-h-0 overflow-y-auto rounded-[9px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--panel-border)]">
            <tr>
              <Th>Subject</Th>
              <Th>Entries</Th>
              <Th>{p.stage === "ks4" ? "Avg grade" : "Points"}</Th>
              <Th>{setLabel}</Th>
              <Th>England</Th>
              <Th>Since {periodLabel(TREND_BASE_PERIOD)}</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {p.subjects.map((s) => (
              <tr key={`${s.subject}|${s.qualification}`} data-subject={s.subject} className="border-b border-[var(--panel-border)] last:border-0">
                <Td className="text-[var(--fg)]" title={s.qualification}>
                  {s.subject}
                </Td>
                <Td>{fmt(s.entries, "pupils")}</Td>
                <Td className="font-bold text-[var(--fg)]">{s.ranked ? fmt(s.avg, unit) : "—"}</Td>
                <Td title={s.ranked ? undefined : smtNote("smallEntries", { min: MIN_SUBJECT_ENTRIES_UI })}>{s.set ? `${s.set.rank} of ${s.set.of}` : <i className="text-[var(--muted2)]">not ranked</i>}</Td>
                <Td>{s.england ? rankText(s.england) : "—"}</Td>
                <Td className={`font-bold ${dirClass(s.since)}`}>{s.since === null ? "—" : `${s.since > 0.05 ? "▲" : s.since < -0.05 ? "▼" : "▬"} ${Math.abs(s.since).toFixed(2)}`}</Td>
                <Td>
                  <Link href={explorerHref(p.stage, setUrns, setLabel, s.subject)} className="whitespace-nowrap text-[11.5px] font-bold text-[var(--adm-accent-text)]">
                    Subject explorer &rarr;
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-auto text-[11px] leading-[1.4] text-[var(--muted2)]">Ranks are among the set&rsquo;s schools with that subject (the subject explorer&rsquo;s own ranking). {smtNote("smallEntries", { min: MIN_SUBJECT_ENTRIES_UI })}</div>
    </>
  );
}
