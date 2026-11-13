// VicData 0.8 front door (A5, A7): the first visit and "New since your last visit". The decisions are pure
// (R-WELCOME-ONCE, R-WHATS-NEW test them); the reads and writes go through the person's own RLS
// (front_door_state, changelog_for_me: 20261123090000_v08_front_door_r1.sql). Until Guy applies that
// migration the table isn't there: the state reads as "unavailable", so nobody is sent to the welcome
// over and over and no strip shows -- the homes work exactly as before it.
import type { SupabaseClient } from "@supabase/supabase-js";

export type FrontDoorState = { welcomeSeenAt: string | null; lastVisitAt: string | null; whatsNewSeenAt: string | null };
export type StateLoad = { status: "ready"; state: FrontDoorState | null } | { status: "unavailable" };
export type ChangelogEntry = { id: string; published_at: string; title: string; body: string | null; credit_text: string | null; link: string | null };

/** The welcome shows once per person: never in View as or a peek (read-only), never when the state can't be read. */
export function shouldShowWelcome(load: StateLoad, ctx: { viewingAs: boolean }): boolean {
  if (ctx.viewingAs || load.status !== "ready") return false;
  return !load.state?.welcomeSeenAt;
}

/** Where the welcome leads: setup for a teacher with subjects to choose, else home (A6). */
export function afterWelcome(ctx: { needsSetup: boolean }): string {
  return ctx.needsSetup ? "/teacher/setup?from=welcome" : "/teacher";
}

/**
 * The strip's entries (A7): published entries newer than the last time the person saw the strip (or, before
 * that, the welcome). Nothing for someone with no state yet (they're on their first visit: the welcome),
 * and nothing in View as.
 */
export function whatsNew(entries: ChangelogEntry[], load: StateLoad, ctx: { viewingAs: boolean; now?: Date }): ChangelogEntry[] {
  if (ctx.viewingAs || load.status !== "ready" || !load.state) return [];
  const since = load.state.whatsNewSeenAt ?? load.state.welcomeSeenAt;
  if (!since) return [];
  const t = Date.parse(since);
  const now = (ctx.now ?? new Date()).getTime();
  return entries.filter((e) => Date.parse(e.published_at) > t && Date.parse(e.published_at) <= now).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

const MISSING = /does not exist|schema cache|PGRST20[25]|42P01|42883/i;

export async function loadFrontDoorState(supabase: SupabaseClient, profileId: string): Promise<StateLoad> {
  const { data, error } = await supabase.from("front_door_state").select("welcome_seen_at, last_visit_at, whats_new_seen_at").eq("profile_id", profileId).maybeSingle<{ welcome_seen_at: string | null; last_visit_at: string | null; whats_new_seen_at: string | null }>();
  if (error) return { status: "unavailable" };
  return { status: "ready", state: data ? { welcomeSeenAt: data.welcome_seen_at, lastVisitAt: data.last_visit_at, whatsNewSeenAt: data.whats_new_seen_at } : null };
}

export async function markWelcomeSeen(supabase: SupabaseClient, profileId: string): Promise<boolean> {
  const now = new Date().toISOString();
  // Seeing the welcome counts as seeing what's new: the strip starts from here.
  const { error } = await supabase.from("front_door_state").upsert({ profile_id: profileId, welcome_seen_at: now, whats_new_seen_at: now, last_visit_at: now, updated_at: now }, { onConflict: "profile_id" });
  return !error;
}

/** A home visit: the strip, once shown, is seen; the visit is the last one. */
export async function recordVisit(supabase: SupabaseClient, profileId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("front_door_state").update({ last_visit_at: now, whats_new_seen_at: now, updated_at: now }).eq("profile_id", profileId);
}

export async function changelogForMe(supabase: SupabaseClient): Promise<ChangelogEntry[]> {
  const { data, error } = await supabase.rpc("changelog_for_me", { max_entries: 30 });
  if (error && MISSING.test(`${error.code} ${error.message}`)) return [];
  return (data ?? []) as ChangelogEntry[];
}
