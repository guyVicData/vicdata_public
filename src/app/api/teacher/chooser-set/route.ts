import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveDefaultNearest, resolveFixedSet, resolveRankingSet } from "@/lib/chooser-sets";
import type { RankingFilters } from "@/lib/comparator-chooser";

// Teacher view comparator chooser: the rows and series the Comparisons column reads for a
// choice made in the chooser but not (necessarily) saved -- a list of schools, or a
// ranking. See src/lib/chooser-sets.ts for how each is resolved. POST, because a list of
// schools or a ranking's filters is the request, not a key.
// A list of schools works at every phase (rankFixedSets supports KS2); a ranking only at
// GCSE and Post-16, the phases with an exam population to rank within.
type Body =
  | { urn: string; phase: "ks2" | "ks4" | "ks5"; set: { kind: "urns"; urns: string[] } }
  | { urn: string; phase: "ks2" | "ks4" | "ks5"; set: { kind: "ranking"; filters: RankingFilters } }
  // Comparator dropdown round: the column's default before anything is chosen -- the
  // chooser's own "10 nearest schools", resolved here in one request.
  | { urn: string; phase: "ks2" | "ks4" | "ks5"; set: { kind: "nearest" } };

// Generous: an LA with its 16+ colleges runs to 60-odd schools (The Chase: 66), and saved
// sets have no cap at all -- this only stops an absurd request.
const MAX_URNS = 200;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!authHeader || !body || !body.urn || !["ks2", "ks4", "ks5"].includes(body.phase) || !body.set) {
    return NextResponse.json({ error: "urn, phase, set and Authorization are required" }, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  // Same gate as every Teacher view route: approved staff of this school only.
  const { data: membership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", body.urn)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  if (!membership) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  try {
    if (body.set.kind === "nearest") return NextResponse.json(await resolveDefaultNearest(body.urn, body.phase));
    if (body.set.kind === "urns") {
      const urns = Array.from(new Set(body.set.urns.filter((u) => typeof u === "string" && /^\d{5,7}$/.test(u)))).slice(0, MAX_URNS);
      return NextResponse.json(await resolveFixedSet(body.urn, body.phase, urns));
    }
    if (body.phase === "ks2") return NextResponse.json({ error: "Rankings are for GCSE and Post-16." }, { status: 400 });
    const { data: target } = await supabase.from("schools").select("current_name, la_name").eq("urn", body.urn).maybeSingle<{ current_name: string; la_name: string | null }>();
    return NextResponse.json(await resolveRankingSet(body.urn, target?.current_name ?? "This school", body.phase, body.set.filters, target?.la_name ?? null));
  } catch (err) {
    console.error("[teacher/chooser-set] failed:", err);
    return NextResponse.json({ error: "Could not load these schools." }, { status: 502 });
  }
}
