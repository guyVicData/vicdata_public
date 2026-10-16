// The time of the last school sync: scripts/sync-schools.js stamps every row of `schools` with
// synced_at, so the latest synced_at changes whenever the school list is synced (the GIAS refresh's
// A1). The ranking population and the answers built on it are keyed on it (chooser-sets.ts,
// /api/teacher/subject-ranking, SMT's subject ranks, Admissions' subject places), so a sync clears
// them instead of their TTLs: after the 16 Oct 2026 refresh a running server still ranked Leighton
// Park's GCSE Biology against the pre-sync population (docs/gias_refresh_2026-10-16_followups.md in
// the ingest repo).
//
// Read at most once a minute per process. If the read fails, the last stamp read stands (or "" before
// the first), so the caches fall back to their own TTLs rather than failing a page.
import { createServerAnonSupabaseClient } from "./supabase";

export const SYNC_CHECK_MS = 60_000;

export type SyncStampLoader = () => Promise<string>;

/** A stamp source that asks `load` at most once every `checkMs`. */
export function makeSchoolSyncStamp(load: SyncStampLoader, now: () => number = Date.now, checkMs = SYNC_CHECK_MS): () => Promise<string> {
  let last = "";
  let checked: { at: number; promise: Promise<string> } | null = null;
  return () => {
    const t = now();
    if (checked && t - checked.at < checkMs) return checked.promise;
    const promise = load().then(
      (s) => (last = s),
      (e) => {
        console.warn("[school-sync-stamp] could not read the last school sync; keeping", last || "none", e instanceof Error ? e.message : e);
        return last;
      },
    );
    checked = { at: t, promise };
    return promise;
  };
}

async function loadSchoolSyncStamp(): Promise<string> {
  const { data, error } = await createServerAnonSupabaseClient().from("schools").select("synced_at").order("synced_at", { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0] as { synced_at: string } | undefined)?.synced_at ?? "";
}

export const schoolSyncStamp = makeSchoolSyncStamp(loadSchoolSyncStamp);
