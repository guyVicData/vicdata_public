import { NextRequest, NextResponse } from "next/server";
import { resolveCaller, schoolAccountIdOf } from "@/lib/view-as-server";

// VicData 0.8 View as: GET ?urn -> the caller as the one server helper decides it, for a page in View
// as (or a peek): { urn, name, accountId, catchmentKm, roles, access, readOnly }. The viewed school's
// account and saved catchment are read with the service role, only after resolveCaller has confirmed
// a platform admin -- the platform admin's own RLS shows them nothing at a school they aren't a member
// of, which is what broke SMT and Admissions in View as (17 Oct). Any school: one with no account (or no
// members) gets accountId "". Members never call this; anyone else gets 403. Reads only.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const c = await resolveCaller(request, urn, { refusal: "Not found." });
  if (c instanceof NextResponse) return c;
  if (c.access === "member") return NextResponse.json({ error: "Not found." }, { status: 403 });
  const [accountId, school] = await Promise.all([
    schoolAccountIdOf(c, c.urn),
    c.reader.from("schools").select("current_name").eq("urn", c.urn).maybeSingle<{ current_name: string }>(),
  ]);
  let catchmentKm: number | null = null;
  if (accountId) {
    const { data, error } = await c.reader.from("school_catchment").select("km").eq("school_account_id", accountId).maybeSingle<{ km: number }>();
    if (!error) catchmentKm = data?.km ?? null;
  }
  return NextResponse.json({ urn: c.urn, name: school.data?.current_name ?? c.urn, accountId: accountId ?? "", catchmentKm, roles: c.roles, access: c.access, readOnly: c.readOnly });
}
