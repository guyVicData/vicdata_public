// VicData 0.8 front door: the walk rules' checks (R-WALK-RHYTHM, R-WALK-KEYS, R-DUMBBELL), shared by the unit
// tests (fixtures) and the rule runners (real data). Pure.
import { screenMeta, WALKS, type Walk, type WalkRhythm } from "./walks";
import { dumbbellRows, teacherScreens, type Chart, type KeyEntry } from "./teacher-screens";
import type { TeacherModel } from "./teacher-model";

const ORDER: WalkRhythm[] = ["this-year", "in-context", "over-time", "wider"];

/** Configuration: every screen a real view, in the one rhythm, Results walks on Average points. */
export function walkConfigProblems(walks: Walk[] = WALKS): string[] {
  const out: string[] = [];
  for (const w of walks) {
    let last = -1;
    for (const s of w.screens) {
      if (!screenMeta(s.view)) out.push(`${w.id}: ${s.view} is not a view`);
      const r = ORDER.indexOf(s.rhythm);
      if (r < last) out.push(`${w.id}: ${s.view} breaks the rhythm (${s.rhythm} after ${ORDER[last]})`);
      last = Math.max(last, r);
      if (!s.question.trim().endsWith("?")) out.push(`${w.id}: ${s.view} has no question`);
    }
    if (w.screens.length && w.screens[0].rhythm !== "this-year") out.push(`${w.id}: doesn't start with this year`);
    if (/-well$/.test(w.id) && w.screens.some((s) => s.options?.measure !== "points")) out.push(`${w.id}: a Results screen not on Average points`);
  }
  return out;
}

/** Built on a model: every screen answers in a sentence; region never a line; every chart keyed. */
export function walkScreenProblems(m: TeacherModel): string[] {
  const out: string[] = [];
  const region = m.area.region?.name ?? null;
  for (const w of WALKS.filter((x) => x.product === (m.phase === "ks4" ? "gcse" : "post16"))) {
    teacherScreens(m, w).forEach((sc, i) => {
      const at = `${w.id} ${i + 1}`;
      if (sc.answer.trim().length < 12 || !/[.!?]$/.test(sc.answer.trim())) out.push(`${at}: no answer sentence ("${sc.answer}")`);
      if (/\[[a-z-]+\]/.test(sc.question + sc.answer + sc.title)) out.push(`${at}: an unfilled template`);
      if (sc.chart.kind === "lines" && sc.chart.series.some((s) => s.role === "region" || (region && s.label === region))) out.push(`${at}: region drawn as a line`);
      out.push(...keyProblems(sc.chart).map((p) => `${at}: ${p}`));
    });
  }
  return out;
}

/** R-WALK-KEYS: a key entry for every colour (role and shade) and mark on the chart. */
export function keyProblems(c: Chart): string[] {
  const has = (role: string, shade?: number) => c.keys.some((k: KeyEntry) => k.role === role && (shade === undefined || k.shade === shade));
  const out: string[] = [];
  const need = (role: string, shade?: number) => {
    if (!has(role, shade)) out.push(`no key for ${role}${shade === undefined ? "" : ` shade ${shade}`}`);
  };
  if (c.kind === "lines") {
    for (const s of c.series) need(s.role, s.role === "peer" ? s.shade : undefined);
    if (c.unpublished.length && !c.keys.some((k) => k.mark === "dash")) out.push("no key for the dotted unpublished years");
  } else if (c.kind === "vbars") {
    for (const r of new Set(c.rows.map((x) => x.role))) need(r);
    if (c.average) need("average");
  } else if (c.kind === "hbars" || c.kind === "map") {
    for (const r of new Set((c.kind === "map" ? c.points : c.rows).map((x) => x.role))) need(r);
  } else if (c.kind === "dumbbell") {
    for (const r of new Set(c.rows.map((x) => x.role))) need(r);
    if (!c.keys.some((k) => k.mark === "ring") || !c.keys.some((k) => k.mark === "dot")) out.push("no key for the ring and the dot");
  } else if (c.kind === "grades") {
    need("focus");
    if (c.rows.some((r) => r.england !== null)) need("england");
  } else if (c.kind === "ranking") need("focus");
  return out;
}

/** R-DUMBBELL: ordered by the latest entries, the focus marked, the school average last, the change the data's. */
export function dumbbellProblems(m: TeacherModel): string[] {
  const d = dumbbellRows(m);
  if (!d) return [];
  const out: string[] = [];
  const subjects = d.rows.slice(0, -1);
  const last = d.rows[d.rows.length - 1];
  if (last.role !== "average") out.push("the school-average row isn't last");
  for (let i = 1; i < subjects.length; i++) if (subjects[i].latest > subjects[i - 1].latest) out.push(`not ordered by the latest entries at ${subjects[i].label}`);
  const focus = m.whole.rows.find((r) => r.focus);
  const fr = subjects.find((r) => r.role === "focus");
  if (focus && focus.entries[d.firstIdx] !== null && focus.entries[d.lastIdx] !== null) {
    if (!fr) out.push("the focus row is missing");
    else if (fr.latest - fr.first !== (focus.entries[d.lastIdx] as number) - (focus.entries[d.firstIdx] as number)) out.push("the focus row's change isn't the data's");
  }
  if (subjects.filter((r) => r.role === "focus").length > 1) out.push("more than one focus row");
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  if (Math.abs(last.latest - mean(subjects.map((r) => r.latest))) > 1e-9 || Math.abs(last.first - mean(subjects.map((r) => r.first))) > 1e-9) out.push("the school average isn't the plain average of the subjects");
  return out;
}
