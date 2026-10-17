// VicData 0.7 admissions (A5): who may call /api/admissions/*. Server-only.
// The member's own token (anon key + Authorization), as the Teacher routes. Admissions comes with
// the whole-school package (Guy): access is by role only -- an approved member of the school
// with the Admissions or SMT role, its School-Admin, or a platform admin (View as). Teams or roles
// a list is shared with read the lists through RLS (admissions_lists); the computed views stay
// with the roles above until round 2 decides otherwise (logged).
//
// 0.8 View as: resolved through the one caller helper (view-as-server.ts, resolveCaller). A platform
// admin's View as of this school is the viewed role (Admissions, SMT or the School-Admin), read-only,
// at any school: `reader` reads the school's lists with the service role once that is confirmed (a
// member's reader is their own client, RLS as before). Writes go through `supabase` and are refused
// for a read-only caller before they are tried.
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { resolveCaller, type ResolvedCaller } from "../view-as-server";

export type AdmissionsCaller = { supabase: SupabaseClient; reader: SupabaseClient; userId: string; urn: string; lead: boolean; roles: string[]; access: ResolvedCaller["access"]; readOnly: boolean };

export const ADMISSIONS_ONLY_MESSAGE = "Admissions is available to the school's Admissions and SMT staff.";

export const canSeeAdmissions = (m: { roles: string[]; isAdmin: boolean }) => m.isAdmin || m.roles.includes("admissions") || m.roles.includes("smt");

export async function admissionsCaller(request: NextRequest, urn: string | null): Promise<AdmissionsCaller | NextResponse> {
  if (!request.headers.get("authorization") || !urn || !/^\d{5,7}$/.test(urn)) return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  const c = await resolveCaller(request, urn, { allowed: canSeeAdmissions, refusal: ADMISSIONS_ONLY_MESSAGE });
  if (c instanceof NextResponse) return c;
  return { supabase: c.supabase, reader: c.reader, userId: c.userId, urn, lead: c.lead, roles: c.roles, access: c.access, readOnly: c.readOnly };
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
