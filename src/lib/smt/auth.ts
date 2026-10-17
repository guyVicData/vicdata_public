// VicData 0.8 SMT round 1 (spec §2.4): who may call /api/smt/*. Server-only.
// The member's own token (anon key + Authorization), as Admissions' and Teacher's routes. SMT
// (governors hold the SMT role: roles.ts maps head_governor to smt), the School-Admin (is_admin or
// the account holder), and platform admins through View as. Teachers don't. No new RLS: every
// figure is public data, or the school's own Admissions lists, which SMT can already read.
//
// 0.8 View as: resolved through the one caller helper (view-as-server.ts, resolveCaller). A platform
// admin's View as of this school is the viewed role (SMT or the School-Admin; a Teacher's View as is
// refused, as a Teacher is), read-only, at any school: the school's Admissions lists are read with the
// service role once that is confirmed, as head office's shared ones are.
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleSupabaseClient } from "../supabase";
import { resolveCaller, type ResolvedCaller } from "../view-as-server";
import { groupCaller, headOfficeAccess } from "../groups/server";
import { groupNote } from "@/catalogue/notes";
import { canSeeSmt, SMT_ONLY_MESSAGE, type SmtAdmissionsReader } from "./auth-rules";

export type SmtCaller = { supabase: SupabaseClient; userId: string; urn: string; roles: string[]; admissions: SmtAdmissionsReader; headOffice: { groupName: string } | null; access: ResolvedCaller["access"]; readOnly: boolean };

export { canSeeSmt, SMT_ONLY_MESSAGE, type SmtAdmissionsReader } from "./auth-rules";

type Office = { groupName: string; admissions: SmtAdmissionsReader };

export async function smtCaller(request: NextRequest, urn: string | null): Promise<SmtCaller | NextResponse> {
  if (!request.headers.get("authorization") || !urn || !/^\d{5,7}$/.test(urn)) return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  const c = await resolveCaller<Office>(request, urn, {
    allowed: canSeeSmt,
    refusal: SMT_ONLY_MESSAGE,
    // Groups r1 (G2): head office reads a current member school's SMT, read-only, where the school holds
    // its own VicData membership (checked in production and here, on every request). A platform admin in
    // head-office View as sees exactly what that head office sees.
    headOffice: async (supabase, userId, viewingAsGroup) => {
      const viewed = viewingAsGroup ? await groupCaller(request).catch(() => null) : null;
      if (viewingAsGroup && (!viewed || viewed instanceof NextResponse)) return null;
      const offices = viewed && !(viewed instanceof NextResponse) ? viewed.offices : undefined;
      const office = await headOfficeAccess(supabase, userId, urn, offices).catch(() => null);
      if (!office?.ok) return null;
      const admissions: SmtAdmissionsReader = office.shared ? { supabase: createServiceRoleSupabaseClient() } : { supabase: null, privateNote: groupNote("admissionsPrivate", { school: office.schoolName }) };
      return { groupName: office.office.name, admissions };
    },
  });
  if (c instanceof NextResponse) return c;
  const base = { supabase: c.supabase, userId: c.userId, urn, roles: c.roles, access: c.access, readOnly: c.readOnly };
  if (c.access === "headOffice" && c.headOffice) return { ...base, roles: [], admissions: c.headOffice.admissions, headOffice: { groupName: c.headOffice.groupName } };
  // A member reads the school's lists under their own RLS; View as and peek through the server.
  return { ...base, admissions: { supabase: c.reader }, headOffice: null };
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
