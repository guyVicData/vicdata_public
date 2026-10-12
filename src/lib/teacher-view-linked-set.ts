// VicData 0.7 admissions r2b (E2): a comparator set handed to the Teacher subject dashboard in
// its address -- Admissions' "Open in the subject explorer with these rivals". Pure.
//
//   ?set=<urn>,<urn>,...   at most 30 URNs, each a 6-digit URN (anything else is ignored).
//                          Comparisons opens on them as a temporary custom set, "Admissions
//                          rivals", through the chooser's own unsaved-choice path ({ kind:
//                          "urns" }): same ranking, figures and views. Nothing is saved.
//   &subject=<name>        optional: the subject to focus, matched to the school's subjects by
//                          name (case aside); no match, no change.
// With no usable `set`, null: the page is exactly as it is without the parameter.
export const LINKED_SET_LABEL = "Admissions rivals";
export const LINKED_SET_MAX = 30;

export type LinkedSet = { urns: string[]; subject: string | null };

export function parseLinkedSet(search: URLSearchParams): LinkedSet | null {
  const raw = search.get("set");
  if (!raw) return null;
  const urns = Array.from(new Set(raw.split(",").map((u) => u.trim()).filter((u) => /^\d{6}$/.test(u)))).slice(0, LINKED_SET_MAX);
  if (!urns.length) return null;
  const subject = search.get("subject")?.trim() || null;
  return { urns, subject };
}

/** The chooser choice the page stores for an unsaved custom set, as a JSON string. */
export function linkedSetChoice(set: LinkedSet): string {
  return JSON.stringify({ kind: "urns", label: LINKED_SET_LABEL, urns: set.urns });
}

/** The subject item a linked subject names, if the school has it. */
export function linkedSubjectKey<T extends { key: string; label: string; subject: string }>(items: T[], subject: string | null): string | null {
  if (!subject) return null;
  const s = subject.toLowerCase();
  return (items.find((i) => i.subject.toLowerCase() === s) ?? items.find((i) => i.label.toLowerCase() === s))?.key ?? null;
}

/** The address without `set` (and the `subject` that came with it): the set has been changed. */
export function withoutLinkedSet(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("set");
  url.searchParams.delete("subject");
  return url.pathname + (url.search ? url.search : "") + url.hash;
}
