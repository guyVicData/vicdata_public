// VicData 0.8 SMT round 1 (spec §2.4): who may see SMT. Pure, shared by the routes (auth.ts) and the page.
// SMT (governors are given the SMT role: roles.ts maps head_governor to smt) and the School-Admin
// (is_admin, or the account holder). Platform admins through View as, read-only, are checked apart.
import type { SupabaseClient } from "@supabase/supabase-js";

// What SMT's Admissions-sourced panels read with (entry points, saved rivals): the member's own client
// (RLS: the school's own lists). Groups r1 (G2): for head office, the school's lists only where its
// School-Admin shares them, else no client and the note the panel shows ("Private to {school}").
export type SmtAdmissionsReader = { supabase: SupabaseClient | null; privateNote?: string };

export const SMT_ONLY_MESSAGE = "The SMT dashboards are for the school's SMT, its governors and its School-Admin.";

export function canSeeSmt(m: { roles: string[]; isAdmin: boolean; isAccountHolder: boolean }): boolean {
  return m.roles.includes("smt") || m.isAdmin || m.isAccountHolder;
}
