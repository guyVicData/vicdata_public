import { NextRequest, NextResponse } from "next/server";
import { lookupReferenceData } from "@/lib/vicdata-reference";
import { estimateIntake, targetCountFromIntakeEstimate, type EntryPoint } from "@/lib/intake-estimate";

// Server-only: keeps vicdata-reference.ts's anon key server-side, same pattern as the
// State of the School page's data fetching. Computes the Feeder Set target-count
// scaling (rolls spec §5) from the cohort-progression intake estimate (§7) -- see
// docs/OPEN_QUESTIONS.md for the reasoning and judgment calls behind this.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const entryPoint = request.nextUrl.searchParams.get("entryPoint") as EntryPoint | null;

  if (!urn || (entryPoint !== "y7" && entryPoint !== "sixth_form")) {
    return NextResponse.json({ error: "urn and a valid entryPoint are required" }, { status: 400 });
  }

  const facts = await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn] });
  const estimate = estimateIntake(facts, entryPoint);
  const targetCount = targetCountFromIntakeEstimate(estimate);

  return NextResponse.json({ estimate, targetCount });
}
