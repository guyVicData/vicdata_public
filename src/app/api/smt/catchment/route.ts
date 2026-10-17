import { NextRequest, NextResponse } from "next/server";
import { smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";
import { catchmentCapKm, catchmentRights, catchmentDefaultKm, catchmentPresets, clampKm } from "@/lib/smt/catchment";
import { canSaveCatchment, saveCatchment, savedCatchmentKm } from "@/lib/smt/catchment-server";
import { VIEW_AS_READ_ONLY } from "@/lib/view-as";

// VicData 0.8 SMT r4 (R3): the school's usual catchment. GET ?urn -> { savedKm, defaultKm, capKm,
// presets, canSave }. PUT ?urn { km: number | null } saves or clears it (the School-Admin only; the
// app DB's RLS refuses anyone else, and so does this route). A km over the school's cap is refused.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await smtCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const school = await smtSchool(caller.urn);
  if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
  const [savedKm, canSave] = await Promise.all([savedCatchmentKm(caller, caller.urn), !catchmentRights(caller).mayTrySave ? Promise.resolve(false) : canSaveCatchment(caller.supabase, caller.urn)]);
  return NextResponse.json({ savedKm, defaultKm: catchmentDefaultKm(school), capKm: catchmentCapKm(school), presets: catchmentPresets(school), canSave });
}

export async function PUT(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await smtCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  if (caller.readOnly && !caller.headOffice) return NextResponse.json({ error: VIEW_AS_READ_ONLY }, { status: 403 });
  if (!catchmentRights(caller).mayTrySave) return NextResponse.json({ error: "Head office reads this school's dashboards; its School-Admin sets the catchment." }, { status: 403 });
  const school = await smtSchool(caller.urn);
  if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
  if (!(await canSaveCatchment(caller.supabase, caller.urn))) return NextResponse.json({ error: "Only the school's School-Admin can save its catchment." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { km?: unknown } | null;
  const raw = body?.km;
  let km: number | null = null;
  if (raw !== null && raw !== undefined) {
    km = clampKm(raw, school);
    if (km === null || km !== raw) return NextResponse.json({ error: `The catchment must be a whole number of km from 2 to ${catchmentCapKm(school)} for this school.` }, { status: 400 });
  }
  const r = await saveCatchment(caller.supabase, caller.urn, km, caller.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
  return NextResponse.json({ savedKm: km });
}
