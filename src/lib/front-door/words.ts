// VicData 0.8 review fixes (14 Nov, M3): the walks' sentence rules in one place (R-WALK-WORDS). Every walk
// answer is written with these, so a place always reads "Nth of N", a count agrees with its noun ("1 school",
// "no schools"), a name ending in s takes a bare apostrophe ("Physics' grades"), a list ends "… and …", and
// a change under half a unit reads "level". Pure.
import { GRADING_2122_PERIOD, periodLabel } from "@/catalogue/years";
import { ordinalWord, placeText } from "@/lib/rank";

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st: the one shared formatter's (src/lib/rank.ts). */
export const ordinal = ordinalWord;

/** "3rd of 11" -- with what's ranked when given ("3rd of 11 schools"); "=3rd of 11" where the place is shared, as
 * the dashboards write it (R-RANK-TIES: the one shared formatter, placeText). */
export function placeOf(rank: number, of: number, what?: string, tied?: boolean): string {
  return placeText({ rank, of, tied }, what);
}

/** "1 school", "3 schools", "no schools" (zero: "no", unless `zero` says otherwise). */
export function plural(k: number, one: string, many = `${one}s`, zero = "no"): string {
  if (k === 0) return `${zero} ${many}`;
  return `${Math.round(k).toLocaleString("en-GB")} ${k === 1 ? one : many}`;
}

/** The possessive (one rule, logged 14 Nov): "Physics'", "Ark Schools'", "St Helens'"; else "'s". */
export function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`;
}

/** "a", "a and b", "a, b and c" (no Oxford comma). */
export function listJoin(items: string[], word = "and"): string {
  const xs = items.filter((x) => x && x.trim());
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} ${word} ${xs[xs.length - 1]}`;
}

/** "up 3%", "down 1.2%", "level" (|v| under half the last digit shown). */
export function pctWords(v: number, d = 0): string {
  if (Math.abs(v) < 0.5 * 10 ** -d) return "level";
  return `${v > 0 ? "up" : "down"} ${Math.abs(v).toFixed(d)}%`;
}

/** "risen 3%", "fallen 1.2%", "held level" (with "has" before it: "has risen 3%"). */
export function changedWords(v: number, d = 0, unit = "%"): string {
  if (Math.abs(v) < 0.5 * 10 ** -d) return "held level";
  return `${v > 0 ? "risen" : "fallen"} ${Math.abs(v).toFixed(d)}${unit}`;
}

/** A number for a sentence: thousands separated, `d` decimals, a true minus for negatives. */
export function num(v: number, d = 0): string {
  const s = d ? Math.abs(v).toFixed(d) : Math.round(Math.abs(v)).toLocaleString("en-GB");
  return `${v < 0 && Number(s.replace(/,/g, "")) !== 0 ? "−" : ""}${s}`;
}

/** The learners' word: pupils at GCSE (and every other phase), students in the sixth form (the app's own:
 * teacher-view-phases' "students at Post-16"). */
export function learners(phase: "ks4" | "ks5" | string, n?: number): string {
  const p16 = phase === "ks5";
  if (n === undefined) return p16 ? "students" : "pupils";
  return plural(n, p16 ? "student" : "pupil");
}

/** The small-cohort threshold for a walk's "only N pupils" note: the front door's own 10 (teacher-screens'
 * header: "a figure under 10 pupils says only"), the same as FSM_MIN_PUPILS. Logged 14 Nov. */
export const SMALL_N = 10;
export function smallNote(phase: string, n: number | null | undefined): string {
  return n !== null && n !== undefined && n < SMALL_N ? ` (only ${learners(phase, n)})` : "";
}

/** The grading caveat, when a results trend measures from 2020/21 or 2021/22 (the dashboard's words:
 * notes.ts TREND_BASE_NOTE, "grades were awarded more generously"). */
export function gradingCaveat(fromPeriod: number | null | undefined): string {
  if (fromPeriod === null || fromPeriod === undefined || fromPeriod > GRADING_2122_PERIOD) return "";
  return ` ${periodLabel(fromPeriod)}'s grades were awarded more generously, so compare with care.`;
}

/** Problems with a sentence (R-WALK-WORDS): empty, doubled spaces or punctuation, a placeholder left. */
export function sentenceProblems(s: string, kind: "question" | "answer"): string[] {
  const out: string[] = [];
  if (!s || !s.trim()) return ["empty"];
  if (/ {2,}/.test(s)) out.push("doubled space");
  if (/([.,;:?!])\1/.test(s.replace(/\.\.\./g, "…")) || /[,;:] ?[.,;:?!]/.test(s) || /\. \./.test(s)) out.push("doubled punctuation");
  if (/\[[^\]]*\]/.test(s)) out.push("placeholder left");
  if (/\bundefined\b|\bNaN\b|\bnull\b/.test(s)) out.push("undefined/NaN/null");
  if (kind === "question" && !s.trim().endsWith("?")) out.push("question doesn't end in ?");
  if (kind === "answer" && !/[.?!)]$/.test(s.trim())) out.push("answer doesn't end a sentence");
  if (kind === "answer" && /^[a-z]/.test(s.trim())) out.push("answer starts lower-case");
  if (/\b1 (schools|pupils|students|subjects|headlines|entries|groups|feeder schools|nearest schools)\b/.test(s)) out.push("plural after 1");
  if (/\b0 (of|schools|held)\b/.test(s)) out.push("bare zero");
  if (/s's\b/.test(s)) out.push("s's possessive");
  if (/\bthe most\b/.test(s) && /\baverage\b|points per entry/.test(s)) out.push("'the most' for an average");
  return out;
}
