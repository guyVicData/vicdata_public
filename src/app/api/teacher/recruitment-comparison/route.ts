import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSubjectHeadlineForSchools, type KsStage } from "@/lib/academic-data-view";

// Teacher view, Phase 6: the automatic school-vs-school comparison behind a candidate
// (design brief v2 §10).
//
// §10 is precise about what this is and is not: "own-school-vs-candidate's-current-school,
// scoped to the job's subject, across sector, gender, roll size, candidate/entry size,
// subject results, and trends -- using whichever measurable phases (KS4/KS5) both schools
// genuinely have data for. This reuses data the platform already has; nothing here is a
// new data view."
//
// So there is no new source here -- the same subject headline lookup the dashboard uses.
// The "both schools genuinely have data for" clause is the load-bearing one and is
// enforced below: a phase where only one side has a figure is dropped rather than shown
// with a blank opposite it, because a one-sided row invites reading absence as weakness.
//
// Privacy (§10): the candidate's NAME never comes near this route. It takes a URN and
// returns ordinary school-level data -- "not data about the candidate". The name stays in
// recruitment_candidates behind RLS.
const PHASES: KsStage[] = ["ks4", "ks5"];

type SchoolContext = {
  urn: string;
  name: string | null;
  sector: string | null;
  gender: string | null;
  roll: number | null;
};

type PhaseComparison = {
  phase: KsStage;
  mine: { entries: number | null; points: number | null; trend: (number | null)[] };
  theirs: { entries: number | null; points: number | null; trend: (number | null)[] };
  periods: number[];
};

export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const candidateUrn = request.nextUrl.searchParams.get("candidateUrn");
  const subject = request.nextUrl.searchParams.get("subject");
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !candidateUrn || !authHeader) {
    return NextResponse.json({ error: "anchorUrn, candidateUrn and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  // Same membership gate as every other Teacher view route: an approved membership at the
  // school being viewed. The candidate's school needs no membership -- it is public
  // school-level data, exactly as it is everywhere else on the platform.
  const { data: membership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", anchorUrn)
    .maybeSingle();
  if (membershipError) {
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });
  }

  const { data: schoolRows } = await supabase
    .from("schools")
    .select("urn, current_name, establishment_type_group, gender, number_of_pupils")
    .in("urn", [anchorUrn, candidateUrn]);

  const contextFor = (urn: string): SchoolContext => {
    const r = (schoolRows ?? []).find((s) => s.urn === urn);
    return {
      urn,
      name: r?.current_name ?? null,
      sector: r?.establishment_type_group ?? null,
      gender: r?.gender ?? null,
      roll: r?.number_of_pupils ?? null,
    };
  };

  const comparisons: PhaseComparison[] = [];
  for (const phase of PHASES) {
    const byUrn = await fetchSubjectHeadlineForSchools([anchorUrn, candidateUrn], phase, undefined, phase === "ks5" ? null : undefined);
    const rowsFor = (urn: string) =>
      (byUrn.get(urn) ?? []).filter((h) => !subject || h.subject === subject);

    const mineRows = rowsFor(anchorUrn);
    const theirRows = rowsFor(candidateUrn);

    const mean = (rows: typeof mineRows, period: number, key: "avgPointScore" | "entriesTotal") => {
      const vals = rows.filter((r) => r.period === period).map((r) => r[key]).filter((v): v is number => v !== null && v !== undefined);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const hasFigureAt = (rows: typeof mineRows, p: number) =>
      mean(rows, p, "entriesTotal") !== null || mean(rows, p, "avgPointScore") !== null;

    const periods = Array.from(new Set([...mineRows, ...theirRows].map((r) => r.period))).sort((a, b) => a - b);

    // §10's "whichever measurable phases both schools GENUINELY have data for", and the
    // word genuinely is doing the work here. Two weaker versions of this check were wrong
    // against real data, both caught on Haverstock vs Camden for Arabic:
    //
    //   - "both sides have rows" let through a KS4 table comparing "--" against "--",
    //     because DfE suppresses figures for small entry counts while the rows remain;
    //   - "both sides have a figure in SOME year" still produced blank headline rows,
    //     because the headline is read at the latest period and Camden's Arabic figures
    //     stop before Haverstock's do.
    //
    // So the comparison is anchored on the latest period where BOTH sides genuinely have
    // a figure. If there is no such year, there is no like-for-like comparison to make and
    // the phase is dropped rather than shown empty.
    const shared = periods.filter((p) => hasFigureAt(mineRows, p) && hasFigureAt(theirRows, p));
    if (shared.length === 0) continue;
    const latest = shared[shared.length - 1];

    const side = (rows: typeof mineRows) => ({
      entries: mean(rows, latest, "entriesTotal"),
      points: mean(rows, latest, "avgPointScore"),
      trend: shared.map((p) => mean(rows, p, "avgPointScore")),
    });

    comparisons.push({ phase, periods: shared, mine: side(mineRows), theirs: side(theirRows) });
  }

  return NextResponse.json({
    mine: contextFor(anchorUrn),
    theirs: contextFor(candidateUrn),
    subject: subject ?? null,
    comparisons,
  });
}
