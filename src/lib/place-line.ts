// VicData 0.8 SMT r3 snags (fix 1): a place line ("Malvern · Worcestershire · West Midlands") that
// never repeats itself. A part is dropped when it names the same place as the part before it: compared
// case-insensitively, ignoring "City of" / "Borough of" (as a prefix, or GIAS's ", City of" suffix).
// Leighton Park: town Reading, LA Reading -> "Reading · South East". Pure.

const key = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^(the\s+)?(city|borough)\s+of\s+/, "")
    .replace(/,\s*(city|borough)\s+of$/, "")
    .replace(/\s+/g, " ");

/** The parts that aren't empty and don't repeat the part before them. */
export function placeParts(parts: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (!p || !p.trim()) continue;
    if (out.length && key(out[out.length - 1]) === key(p)) continue;
    out.push(p.trim());
  }
  return out;
}

export const placeLine = (parts: (string | null | undefined)[]) => placeParts(parts).join(" · ");
