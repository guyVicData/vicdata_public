// 0.8 front door part 3 (F27): what the School-Admin's Sign-ins and devices page reads. Server-only. The reader is
// the caller's own client for a School-Admin (RLS: account_devices and account_sign_ins show only the school's
// approved staff, R-SIGNINS-RLS), or the service role for a platform admin's View as, after the route's check.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLACES_ALERT } from "../devices/config";
import { signinsView, type DeviceLite, type EventLite, type SigninsView, type StaffRow } from "./signins";

const missing = (msg: string | undefined) => /does not exist|schema cache|account_devices|account_sign_ins/i.test(msg ?? "");

type Member = { id: string; profile_id: string; profiles: { email: string | null; full_name: string | null } | null };

export async function readSchoolSignins(reader: SupabaseClient, o: { schoolAccountId: string; now: Date }): Promise<{ view: SigninsView | null; notSetUp: boolean }> {
  const { data: members, error } = await reader.from("school_memberships").select("id, profile_id, profiles(email, full_name)").eq("school_account_id", o.schoolAccountId).eq("status", "approved");
  if (error) throw new Error(error.message);
  const staff: StaffRow[] = ((members ?? []) as unknown as Member[]).map((m) => ({ profileId: m.profile_id, membershipId: m.id, name: m.profiles?.full_name || m.profiles?.email || "A member", email: m.profiles?.email ?? null }));
  if (!staff.length) return { view: signinsView([], [], [], o.now), notSetUp: false };
  const ids = staff.map((s) => s.profileId);
  const since = new Date(o.now.getTime() - PLACES_ALERT.hours * 3_600_000).toISOString();
  const [devices, events] = await Promise.all([
    reader.from("account_devices").select("profile_id, label, form, place, signed_in_at, signed_out_at, last_active_at").in("profile_id", ids).is("signed_out_at", null),
    reader.from("account_sign_ins").select("profile_id, place, at").in("profile_id", ids).gte("at", since).limit(5000),
  ]);
  if (devices.error || events.error) {
    const msg = devices.error?.message ?? events.error?.message;
    if (missing(msg)) return { view: null, notSetUp: true };
    throw new Error(msg);
  }
  return { view: signinsView(staff, (devices.data ?? []) as DeviceLite[], (events.data ?? []) as EventLite[], o.now), notSetUp: false };
}

/** Just the counts, for the account page's row and the menu's badge. */
export async function readSigninsCounts(reader: SupabaseClient, o: { schoolAccountId: string; now: Date }): Promise<{ devices: number; flags: number } | null> {
  try {
    const r = await readSchoolSignins(reader, o);
    return r.view ? { devices: r.view.devices, flags: r.view.flags } : null;
  } catch (e) {
    console.error("[school-admin/sign-ins] counts failed:", (e as Error).message);
    return null;
  }
}
