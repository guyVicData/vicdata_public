// VicData 0.8 SMT round 4 (R3): the school's saved catchment, read and written with the caller's own
// token (smtCaller's client), so the app DB's RLS decides: the school's approved members read it, its
// School-Admin (or account holder) writes it, nobody else does (20261113090000_v08_smt_r4_catchment.sql).
// Server-only. Head office reading a member school's SMT isn't a member, so RLS shows it no row: once
// smtCaller has checked its access, the server reads the school's saved catchment for it with the
// service key, read-only (0.8 audit fixes, 9; catchmentRights). It never saves one.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "../supabase";
import { CATCHMENT_CAP_WIDE_KM, CATCHMENT_MIN_KM, catchmentRights } from "./catchment";

async function accountId(supabase: SupabaseClient, urn: string): Promise<string | null> {
  const { data } = await supabase.from("school_accounts").select("id").eq("school_urn", urn).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/** The school's saved catchment in km, or null (none saved, or the caller can't read it). Head office
 * (an smtCaller already checked) reads it through the server. */
export async function savedCatchmentKm(caller: { supabase: SupabaseClient; headOffice: unknown | null }, urn: string): Promise<number | null> {
  const supabase = catchmentRights(caller).read === "server" ? createServiceRoleSupabaseClient() : caller.supabase;
  const id = await accountId(supabase, urn);
  if (!id) return null;
  const { data, error } = await supabase.from("school_catchment").select("km").eq("school_account_id", id).maybeSingle<{ km: number }>();
  // Before the migration is applied the table doesn't exist: no saved catchment, the default draws.
  if (error) return null;
  return data?.km ?? null;
}

/** Whether the caller may save the school's catchment (its School-Admin or account holder). */
export async function canSaveCatchment(supabase: SupabaseClient, urn: string): Promise<boolean> {
  const id = await accountId(supabase, urn);
  if (!id) return false;
  const { data } = await supabase.rpc("is_school_admin_or_holder", { p_school_account_id: id });
  return data === true;
}

/** Save (km) or clear (null) the school's catchment. RLS refuses anyone but its School-Admin. */
export async function saveCatchment(supabase: SupabaseClient, urn: string, km: number | null, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = await accountId(supabase, urn);
  if (!id) return { ok: false, error: "No school account." };
  if (km === null) {
    const { error } = await supabase.from("school_catchment").delete().eq("school_account_id", id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  if (!Number.isInteger(km) || km < CATCHMENT_MIN_KM || km > CATCHMENT_CAP_WIDE_KM) return { ok: false, error: "The catchment must be a whole number of km from 2 to 30." };
  const { error } = await supabase.from("school_catchment").upsert({ school_account_id: id, km, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "school_account_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
}
