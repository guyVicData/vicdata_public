"use client";

// The school's entry points as the Admissions home lists them: the saved ones, else its ages' defaults
// (as AdmissionsDashboard's defaultEntries). Shared by the Admissions home (and the SMT home's Admissions
// tab) and the SMT Pupils walk's last screen, so both open on the same entry point.
import { freshToken } from "@/components/admissions/member";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type ListsAnswer = { entryPoints: { entry_point: string }[] };

export function defaultEntries(low: number | null, high: number | null): string[] {
  if (low === null || high === null) return ["11+"];
  const out: string[] = [];
  if (low <= 4 && high >= 4) out.push("4+");
  if (low <= 11 && high >= 12) out.push("11+");
  if (low <= 16 && high >= 17) out.push("16+");
  return out.length ? out : [`age:${Math.max(2, Math.min(17, low))}`];
}

export async function schoolEntries(urn: string): Promise<string[]> {
  const [lists, row] = await Promise.all([
    // Not through the 10-minute cache: a just-saved entry point shows at once.
    (async () => {
      const t = await freshToken();
      const r = t ? await fetch(`/api/admissions/lists?urn=${urn}`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null) : null;
      return r && r.ok ? ((await r.json()) as ListsAnswer) : null;
    })(),
    createBrowserSupabaseClient().from("schools").select("statutory_low_age, statutory_high_age").eq("urn", urn).maybeSingle<{ statutory_low_age: number | null; statutory_high_age: number | null }>(),
  ]);
  const saved = (lists?.entryPoints ?? []).map((e) => e.entry_point);
  return saved.length ? saved : defaultEntries(row.data?.statutory_low_age ?? null, row.data?.statutory_high_age ?? null);
}
