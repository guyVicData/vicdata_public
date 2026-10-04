// 0.6 S1: Platform's "Look at it as…" -- a read-only preview of one school's Teacher view
// as one role, for platform admins only. The Platform screen logs the action
// (log_platform_action('look_as', urn, {role})) and then navigates to
// /teacher?lookAs={urn}&as={role}; the Teacher pages read the pair with readLookAs and
// must call confirmLookAs before honouring it, so a hand-typed URL does nothing for
// anyone who is not a platform admin.
//
// 0.6 snag 2: the pair now starts or continues a "Try VicData as…" TRIAL (src/lib/trial.ts)
// -- the same URL and the same confirmLookAs, now writing to the trial's own state rather
// than read-only. Platform's buttons start one (log_platform_action('try_as', …) replaces
// 'look_as'). `&peek=1` keeps the old read-only look for the Catalogue's side-by-side
// frames, which must not become a trial (they compare the two renderers).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VisibleRoleId } from "./roles";

export type LookAs = { urn: string; role: string };

export const LOOK_AS_ROLES: VisibleRoleId[] = ["teacher", "smt", "admissions", "school_admin"];

export function lookAsHref(lookAs: LookAs): string {
  return `/teacher?lookAs=${encodeURIComponent(lookAs.urn)}&as=${encodeURIComponent(lookAs.role)}`;
}

export function readLookAs(params: URLSearchParams): LookAs | null {
  const urn = params.get("lookAs")?.trim();
  const role = params.get("as")?.trim();
  if (!urn || !role) return null;
  if (!/^[A-Za-z0-9-]{1,20}$/.test(urn)) return null;
  if (!(LOOK_AS_ROLES as string[]).includes(role)) return null;
  return { urn, role };
}

// True only when the signed-in caller is a platform admin. The URL is never trusted on
// its own; any error reads as "no".
export async function confirmLookAs(supabase: SupabaseClient, lookAs: LookAs | null): Promise<boolean> {
  if (!lookAs) return false;
  try {
    const { data, error } = await supabase.rpc("is_platform_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}
