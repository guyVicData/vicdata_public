"use client";

// VicData 0.8 SMT r1: Academic, column 1 -- the level's headlines (Academic.dc.html). Whole school:
// both phases; GCSE: entries, average grade (or Attainment 8), grade 7+, rank in the set; Post-16:
// points per entry, rank, A-level value added. Value added in its own block with honest wording,
// then the grade profile. R-SMT-VIEW-ACADEMIC-NOW, R-SMT-P8-REASON, R-SMT-VA-HONEST.
import { Lbl, Tile } from "@/components/admissions/ui";
import { SMT_NOTES, smtNote } from "@/catalogue/notes";
import type { Academic, SmtSchool } from "../api";
import type { StagePart, Tile as TileData } from "@/lib/smt/academic";
import { NoteTile, fmt, ord, rankText, yearOf } from "../ui";
import { GradeBar } from "./Grades";

const STAGE: Record<"ks4" | "ks5", string> = { ks4: "GCSE", ks5: "Post-16" };

function tileOf(t: TileData) {
  if (t.note === "igcse") return <NoteTile key={t.key} label="GCSE" title="IGCSE school" sub="no comparable GCSE results" />;
  if (t.unit === "rank") return <Tile key={t.key} small label={t.label} value={t.value === null ? "—" : ord(t.value)} sub={t.sub} />;
  const sub = t.set ? `${rankText(t.set)} ${t.set.label.replace(/^.* with /, "with ")}` : t.england ? `national rank ${rankText(t.england)}` : t.sub;
  return <Tile key={t.key} small={t.key !== "entries"} label={t.label} value={t.unit === "pupils" ? fmt(t.value, "pupils") : fmt(t.value, t.unit as Exclude<typeof t.unit, "rank">, t.key)} sub={t.key === "entries" ? t.sub : sub} accent={t.key === "entries"} />;
}

export function PartTiles({ part, a }: { part: StagePart; a: Academic }) {
  return (
    <div className="flex flex-col gap-[6px]">
      {a.level.phase === "whole" && <Lbl>{STAGE[part.stage]} &middot; {yearOf(part.period, part.stage)}</Lbl>}
      <div className="grid grid-cols-2 gap-2">{part.tiles.map((t) => tileOf(t))}</div>
    </div>
  );
}

export function ValueAddedBlock({ a, school }: { a: Academic; school: SmtSchool }) {
  const lines: string[] = [];
  const phase = a.level.phase;
  if (phase === "primary") lines.push(SMT_NOTES.vaNotKs2);
  if ((phase === "gcse" || phase === "whole") && school.phases.gcse) {
    lines.push(a.va.p8.status === "published" ? `Progress 8 ${fmt(a.va.p8.value, "va")} (${yearOf(a.va.p8.period)}${a.va.p8.lo !== null ? `, range ${fmt(a.va.p8.lo, "va")} to ${fmt(a.va.p8.hi, "va")}` : ""}). ${a.va.p8.text}` : a.va.p8.text);
    if (phase === "gcse" && a.level.area) lines.push(SMT_NOTES.vaNoGcseSubjects);
  }
  if ((phase === "post16" || phase === "whole") && school.phases.post16) {
    const latest = a.va.alevel.filter((r) => r.qualification === "A level").at(-1);
    lines.push(latest ? `A-level value added ${fmt(latest.value, "va")} (${yearOf(latest.period)}${latest.lo !== null ? `, range ${fmt(latest.lo, "va")} to ${fmt(latest.hi, "va")}` : ""}${latest.banding ? `: ${latest.banding.toLowerCase()}` : ""}).` : SMT_NOTES.vaNotPublished);
  }
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--panel-border)] pt-2">
      <Lbl>Value added</Lbl>
      {lines.map((l) => (
        <div key={l} className="text-[12px] leading-[1.45] text-[var(--chip-fg)]">
          {l}
        </div>
      ))}
    </div>
  );
}

export function AcademicNow({ a, school }: { a: Academic; school: SmtSchool }) {
  const title = a.level.phase === "whole" ? "The school's results now" : a.level.phase === "primary" ? "Primary now" : `${a.areaLabel ?? "All areas"} at ${a.level.phase === "gcse" ? "GCSE" : "Post-16"} now`;
  const main = a.parts.length === 1 ? a.parts[0] : null;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">{title}</div>
      {a.ks2.length > 0 && (
        <div className="flex flex-col gap-[6px]">
          {a.level.phase === "whole" && <Lbl>KS2 &middot; {yearOf(a.ks2[0].period, "ks2")}</Lbl>}
          <div className="grid grid-cols-2 gap-2">{a.ks2.map((t) => tileOf(t))}</div>
        </div>
      )}
      {a.level.phase === "primary" && !a.ks2.length && <NoteTile label="KS2" title="No published results" sub="Most independent preps don't sit KS2 tests." />}
      {a.parts.map((p) => (
        <PartTiles key={p.stage} part={p} a={a} />
      ))}
      <ValueAddedBlock a={a} school={school} />
      {main && main.grades.entries > 0 && (
        <div className="flex flex-col gap-1 border-t border-[var(--panel-border)] pt-2">
          <Lbl>Grade profile</Lbl>
          <GradeBar part={main} />
        </div>
      )}
      {a.igcse && (a.level.phase === "gcse" || a.level.phase === "whole") && <div className="text-[11px] leading-snug text-[var(--muted2)]">{smtNote("igcseView", { school: school.name })}</div>}
    </>
  );
}
