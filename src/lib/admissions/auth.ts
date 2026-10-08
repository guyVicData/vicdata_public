// VicData 0.7 admissions (A5): who may call /api/admissions/*. Server-only.
// The member's own token (anon key + Authorization), as the Teacher routes. Admissions comes with
// the whole-school package (Guy): access is by role only -- an approved member of the school
// with the Admissions or SMT role, its School-Admin, or a platform admin (View as). Teams or roles
// a list is shared with read the lists through RLS (admissions_lists); the computed views stay
// with the roles above until round 2 decides otherwise (logged).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isPlatformAdmin } from "../view-as";

export type AdmissionsCaller = { supabase: SupabaseClient; userId: string; urn: string; lead: boolean; roles: string[] };

export async function admissionsCaller(request: NextRequest, urn: string | null): Promise<AdmissionsCaller | NextResponse> {
  const auth = request.headers.get("authorization");
  if (!auth || !urn || !/^\d{5,7}$/.test(urn)) return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: user } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const userId = user.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  // admissions_lead exists once the 0.7 r1 migration is applied; read it only if it does.
  let { data, error } = await supabase
    .from("school_memberships")
    .select("roles, is_admin, admissions_lead, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("profile_id", userId)
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .limit(1)
    .maybeSingle();
  if (error && /admissions_lead/.test(error.message)) {
    ({ data, error } = await supabase
      .from("school_memberships")
      .select("roles, is_admin, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
      .eq("profile_id", userId)
      .eq("status", "approved")
      .eq("school_accounts.school_urn", urn)
      .limit(1)
      .maybeSingle());
  }
  if (error) return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  const m = data as { roles?: string[] | null; is_admin?: boolean; admissions_lead?: boolean } | null;
  const roles = m?.roles ?? [];
  const allowed = !!m && (m.is_admin || roles.includes("admissions") || roles.includes("smt"));
  if (!allowed && !(await isPlatformAdmin(supabase))) return NextResponse.json({ error: "Admissions is available to the school's Admissions and SMT staff." }, { status: 403 });
  return { supabase, userId, urn, lead: !!m?.admissions_lead, roles };
}

/** The school's saved lists for an entry point (RLS decides what the caller sees); [] before the
 * migration is applied or when nothing is saved -- the views then use the nearby defaults. */
export async function savedLists(supabase: SupabaseClient, urn: string, entryPoint: string): Promise<{ kind: string; rung: string | null; members: string[] | null; la_blend: Record<string, number> | null; confirmed: boolean }[]> {
  const { data, error } = await supabase
    .from("admissions_lists")
    .select("kind, rung, members, la_blend, confirmed, school_accounts!inner(school_urn)")
    .eq("school_accounts.school_urn", urn)
    .eq("entry_point", entryPoint);
  if (error) return [];
  return (data ?? []) as never;
}
