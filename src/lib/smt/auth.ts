// VicData 0.8 SMT round 1 (spec §2.4): who may call /api/smt/*. Server-only.
// The member's own token (anon key + Authorization), as Admissions' and Teacher's routes. SMT
// (governors hold the SMT role: roles.ts maps head_governor to smt), the School-Admin (is_admin or
// the account holder), and platform admins through View as. Teachers don't. No new RLS: every
// figure is public data, or the school's own Admissions lists, which SMT can already read.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isPlatformAdmin } from "../view-as";
import { createServiceRoleSupabaseClient } from "../supabase";
import { groupCaller, headOfficeAccess } from "../groups/server";
import { parseViewAsGroupCookie } from "../groups/view-as-group";
import { groupNote } from "@/catalogue/notes";
import { canSeeSmt, SMT_ONLY_MESSAGE, type SmtAdmissionsReader } from "./auth-rules";

export type SmtCaller = { supabase: SupabaseClient; userId: string; urn: string; roles: string[]; admissions: SmtAdmissionsReader; headOffice: { groupName: string } | null };

export { canSeeSmt, SMT_ONLY_MESSAGE, type SmtAdmissionsReader } from "./auth-rules";

export async function smtCaller(request: NextRequest, urn: string | null): Promise<SmtCaller | NextResponse> {
  const auth = request.headers.get("authorization");
  if (!auth || !urn || !/^\d{5,7}$/.test(urn)) return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: user } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const userId = user.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { data, error } = await supabase
    .from("school_memberships")
    .select("id, roles, is_admin, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id)")
    .eq("profile_id", userId)
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .limit(1)
    .maybeSingle<{ id: string; roles: string[] | null; is_admin: boolean | null; school_accounts: { account_holder_membership_id: string | null } | null }>();
  if (error) return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  const roles = data?.roles ?? [];
  const allowed = !!data && canSeeSmt({ roles, isAdmin: !!data.is_admin, isAccountHolder: data.school_accounts?.account_holder_membership_id === data.id });
  if (allowed) return { supabase, userId, urn, roles, admissions: { supabase }, headOffice: null };
  const platform = await isPlatformAdmin(supabase);
  // Groups r1 (G2): head office reads a current member school's SMT, read-only, where the school holds
  // its own VicData membership (checked in production and here, on every request). A platform admin in
  // head-office View as sees exactly what that head office sees.
  const asGroup = platform ? parseViewAsGroupCookie(request.headers.get("cookie")) : null;
  if (platform && !asGroup) return { supabase, userId, urn, roles, admissions: { supabase }, headOffice: null };
  const viewed = asGroup ? await groupCaller(request).catch(() => null) : null;
  const offices = viewed && !(viewed instanceof NextResponse) ? viewed.offices : undefined;
  const office = await headOfficeAccess(supabase, userId, urn, offices).catch(() => null);
  // In head-office View as the platform admin sees exactly what head office sees: no fallback.
  if (office?.ok) {
    const admissions: SmtAdmissionsReader = office.shared ? { supabase: createServiceRoleSupabaseClient() } : { supabase: null, privateNote: groupNote("admissionsPrivate", { school: office.schoolName }) };
    return { supabase, userId, urn, roles: [], admissions, headOffice: { groupName: office.office.name } };
  }
  return NextResponse.json({ error: SMT_ONLY_MESSAGE }, { status: 403 });
}

const URN = /^\d{5,7}$/;
export const MAX_SET = 600;

/** The comparison set in a request body: what Teacher's chooser resolved, as URNs. */
export function setFrom(body: unknown): { kind: string; label: string; urns: string[] } | null {
  const s = (body as { set?: { kind?: unknown; label?: unknown; urns?: unknown } } | null)?.set;
  if (!s || !Array.isArray(s.urns)) return null;
  const urns = Array.from(new Set(s.urns.filter((u): u is string => typeof u === "string" && URN.test(u)))).slice(0, MAX_SET);
  const kind = typeof s.kind === "string" && /^[a-z]{1,20}$/.test(s.kind) ? s.kind : "urns";
  const label = typeof s.label === "string" && s.label.trim() ? s.label.trim().slice(0, 80) : "the comparison set";
  return { kind, label, urns };
}
