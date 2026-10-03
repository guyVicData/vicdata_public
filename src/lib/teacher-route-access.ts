// 0.6 S1: the one exception to the Teacher view routes' "approved staff of this school
// only" gate -- a platform admin, for the Platform screen's read-only "Look at it as…"
// and the Catalogue page's parity frames. Only routes serving school-level public data
// use it; nothing personal or school-owned (saved sets, notes, preferences) is opened.
// Checked AFTER the membership query, so a member's path is unchanged.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function isPlatformAdmin(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_platform_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}
