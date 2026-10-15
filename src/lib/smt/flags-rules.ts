// VicData 0.8 SMT round 1: the flag thresholds, in one place (R-SMT-FLAGS). Pure; flags.ts applies them.
import { smtNote } from "@/catalogue/notes";
export const SMT_FLAG_RULES = {
  // Results rising or falling faster than the set: the school's two-year change in its headline,
  // against the median two-year change of the set's schools with both years, by at least this much
  // (in the measure's own points). Attainment 8 is out of 90 (2 points is a fifth of a grade per
  // subject); A-level points per entry are 10 to a grade (3 points is about a third of a grade).
  resultsGap: { ks4: 2, ks5: 3, ks2: 5 } as Record<"ks2" | "ks4" | "ks5", number>,
  // ...and only when the set has at least this many schools with both years.
  resultsMinSchools: 4,
  // Roll falling: Admissions' rule (FLAG_RULES.losingYears, three falls in a row), never on a roll
  // below this.
  rollMinPupils: 50,
} as const;

// 0.8 audit fixes (3, S1): the flags caption, filled the one way. The results clause names the
// school's own measures (GCSE unless it sits IGCSEs, Post-16 where it has one); none, no clause.
const GAP_WORDS = { ks4: (n: number) => `${n} Attainment 8 points`, ks5: (n: number) => `${n} A-level points per entry` };
export function flagsRuleText(p: { gcse: boolean; post16: boolean; igcse?: boolean }): string {
  const stages = [...(p.gcse && !p.igcse ? (["ks4"] as const) : []), ...(p.post16 ? (["ks5"] as const) : [])];
  if (!stages.length) return smtNote("flagsRuleNoResults");
  const words = stages.map((k) => GAP_WORDS[k](SMT_FLAG_RULES.resultsGap[k]) + (stages.length > 1 ? (k === "ks4" ? " at GCSE" : " at Post-16") : ""));
  return smtNote("flagsRule", { gap: words.join(" or "), min: SMT_FLAG_RULES.resultsMinSchools });
}
