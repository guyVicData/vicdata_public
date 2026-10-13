import { NextResponse } from "next/server";
import { cachedReference } from "@/lib/server-cache";
import { lookupAcademicLatestYears } from "@/lib/vicdata-reference";

// 0.7 year rules: the latest year per key stage (KS2, GCSE, Post-16), from the data, with DfE's
// provisional flag (src/catalogue/years.ts). National and public -- the same for everyone, read
// with the anon key, cached an hour -- so no membership check. For pages that don't already
// carry it in a payload of their own (Reuse a meeting's "move every view on").
export async function GET() {
  const latestYears = await cachedReference("years:latest", () => lookupAcademicLatestYears()).catch(() => null);
  return NextResponse.json({ latestYears });
}
