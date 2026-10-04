// VicData 0.6 snagging round 2, item A: "Try VicData as…" -- a platform admin (Guy) trying
// VicData as one role at one school, exactly as a new single-role member would, without
// becoming a member. A trial is a MODE of the 0.6 look-as (src/lib/look-as.ts), not a
// second impersonation path: the URL pair ?lookAs={urn}&as={role} on a Teacher page
// starts or continues one, and it is honoured only after confirmLookAs (is_platform_admin)
// says yes, so a hand-typed URL does nothing for anyone else.
//
// Unlike the old read-only look-as, a trial WRITES -- ticked subjects, preferences, notes,
// walkthrough progress, personal dashboards, meetings, recruitment jobs -- but every one
// of those writes is Guy's own row keyed by the trial's STATE KEY, never his own state and
// never the school's shared data:
//   * teacher_view_preferences / _notes / _onboarding and dashboard_user_state key on a
//     school_urn TEXT column with no FK: in a trial they get `stateUrn(urn)`, the state key
//     (teacher-view-data.ts and dashboards-store.ts apply it, so callers don't).
//   * personal dashboards/meetings and recruitment jobs carry `trial_key` (migration
//     20261105090000_v06_snag2_trials.sql): null normally, the state key in a trial.
// Nothing creates a membership, so the trial never appears in People, Teams, join
// requests, member counts or caps; NavBar records no sign-in event while one is active.
//
// The active trial lives in sessionStorage (this tab only), and only once confirmed.
//
// Contract for item B (the footer/banner Edit switch): `useTrial()` gives the confirmed
// trial (school, role, name) for the live preview; edits made from a trial are Guy's own
// (platform-admin identity) and must not go through stateUrn/trial_key -- VicData
// dashboards are never trial state (a CHECK keeps trial_key on personal rows only).
// Client-only (sessionStorage, hooks): import it from client components.
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmLookAs, readLookAs, type LookAs } from "./look-as";

export type TrialRole = "teacher" | "smt" | "admissions" | "school_admin";
export type Trial = { urn: string; role: TrialRole; schoolName: string; stateKey: string };

export const TRIAL_ROLES: TrialRole[] = ["teacher", "smt", "admissions", "school_admin"];

export const trialStateKey = (urn: string, role: string) => `${urn}~trial~${role}`;

const STORAGE_KEY = "vicdata.trial";
// Fired on window whenever the active trial changes in this tab (start, exit).
export const TRIAL_EVENT = "vicdata:trial";

type Stored = { urn: string; role: TrialRole; schoolName: string; confirmed: boolean };

function readStored(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stored>;
    if (!s || typeof s.urn !== "string" || !(TRIAL_ROLES as string[]).includes(s.role ?? "")) return null;
    return { urn: s.urn, role: s.role as TrialRole, schoolName: typeof s.schoolName === "string" ? s.schoolName : s.urn, confirmed: s.confirmed === true };
  } catch {
    return null;
  }
}

function writeStored(s: Stored | null) {
  try {
    if (s) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the trial still runs on pages that carry the URL pair.
  }
  try {
    window.dispatchEvent(new Event(TRIAL_EVENT));
  } catch {
    // Not in a browser.
  }
}

const toTrial = (s: { urn: string; role: TrialRole; schoolName: string }): Trial => ({ urn: s.urn, role: s.role, schoolName: s.schoolName, stateKey: trialStateKey(s.urn, s.role) });

// The confirmed trial active in this tab, or null. Synchronous, for the persistence
// helpers; pages decide with resolveTrial()/useTrial(), which re-confirm.
export function getActiveTrial(): Trial | null {
  if (typeof window === "undefined") return null;
  const s = readStored();
  return s?.confirmed ? toTrial(s) : null;
}

// The school_urn to write per-user state under: the trial's state key when a confirmed
// trial is active for this school, else the school's own URN.
export function stateUrn(urn: string): string {
  const t = getActiveTrial();
  return t && t.urn === urn ? t.stateKey : urn;
}

// Postgres "undefined_column" / PostgREST's wording for it: the trial migration isn't
// applied yet.
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .*trial_key.* does not exist|trial_key/i.test(error.message ?? "");
}

// What a trial says when it can't save something without the migration.
export const TRIAL_NEEDS_UPDATE = "Saving this in a trial needs the database update (20261105090000_v06_snag2_trials).";

async function schoolNameOf(supabase: SupabaseClient, urn: string): Promise<string> {
  const { data } = await supabase.from("schools").select("current_name").eq("urn", urn).maybeSingle<{ current_name: string }>();
  return data?.current_name ?? urn;
}

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42883" || /does not exist|schema cache|could not find the function/i.test(error.message ?? "");
}

// Clears the trial's walkthrough and saved state (Start fresh). reset_trial does it in one
// call; before the migration is applied, the same deletes go straight to the tables (RLS
// limits them to the caller's own rows, and the state key limits them to this trial).
export async function resetTrialState(supabase: SupabaseClient, urn: string, role: TrialRole): Promise<void> {
  const { error } = await supabase.rpc("reset_trial", { p_urn: urn, p_role: role });
  if (!error) return;
  if (!isMissingRelation(error)) throw error;
  const key = trialStateKey(urn, role);
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return;
  for (const table of ["teacher_view_preferences", "teacher_view_notes", "teacher_view_onboarding", "dashboard_user_state"]) {
    const { error: e } = await supabase.from(table).delete().eq("profile_id", uid).eq("school_urn", key);
    if (e && !isMissingRelation(e)) throw e;
  }
}

async function touchContext(supabase: SupabaseClient, urn: string, role: TrialRole) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("trial_contexts").upsert({ profile_id: uid, school_urn: urn, role, last_used_at: now }, { onConflict: "profile_id,school_urn,role" });
  if (error && !isMissingRelation(error)) console.error("trial_contexts:", error.message);
  rememberLocally(urn, role);
}

// Start (or restart) a trial: confirm platform admin, log try_as, optionally Start fresh,
// record it in trial_contexts, and make it this tab's active trial. Logged on every start.
export async function startTrial(
  supabase: SupabaseClient,
  input: { urn: string; role: TrialRole; fresh: boolean; schoolName?: string; via?: string },
): Promise<{ ok: true; trial: Trial } | { ok: false; error: string }> {
  if (!(await confirmLookAs(supabase, { urn: input.urn, role: input.role }))) return { ok: false, error: "Only platform admins can try VicData as a member." };
  const { error: logError } = await supabase.rpc("log_platform_action", {
    p_action: "try_as",
    p_school_urn: input.urn,
    p_detail: { role: input.role, fresh: input.fresh, ...(input.via ? { via: input.via } : {}) },
  });
  if (logError) return { ok: false, error: `Could not start the trial: ${logError.message}` };
  try {
    if (input.fresh) await resetTrialState(supabase, input.urn, input.role);
  } catch (e) {
    return { ok: false, error: `Could not start fresh: ${(e as Error).message}` };
  }
  await touchContext(supabase, input.urn, input.role);
  const schoolName = input.schoolName ?? (await schoolNameOf(supabase, input.urn));
  writeStored({ urn: input.urn, role: input.role, schoolName, confirmed: true });
  resolved = null;
  return { ok: true, trial: toTrial({ urn: input.urn, role: input.role, schoolName }) };
}

export function exitTrial(): void {
  writeStored(null);
  resolved = null;
}

// The Teacher-view URL for a trial: the role's home (or a path under /teacher) with the
// look-as pair, so the trial also holds where sessionStorage is blocked.
export function trialHref(t: { urn: string; role: string }, path = "/teacher"): string {
  return `${path}?lookAs=${encodeURIComponent(t.urn)}&as=${encodeURIComponent(t.role)}`;
}

// Which trial (if any) this page is in. The URL pair wins: a confirmed platform admin
// arriving with one starts that trial (logged) unless it is already the active one. With
// no pair, the stored trial holds -- re-confirmed, and dropped for anyone not an admin.
// `?peek=1` is Catalogue's side-by-side read-only look (no trial). Shared per page load.
let resolved: { search: string; promise: Promise<Trial | null> } | null = null;

export function resolveTrial(supabase: SupabaseClient): Promise<Trial | null> {
  const search = typeof window === "undefined" ? "" : window.location.search;
  if (resolved && resolved.search === search) return resolved.promise;
  const promise = (async (): Promise<Trial | null> => {
    const params = new URLSearchParams(search);
    if (params.get("peek") === "1") return null;
    const fromUrl: LookAs | null = readLookAs(params);
    const stored = readStored();
    if (fromUrl) {
      if (!(await confirmLookAs(supabase, fromUrl))) return null;
      if (stored?.confirmed && stored.urn === fromUrl.urn && stored.role === fromUrl.role) return toTrial(stored);
      const r = await startTrial(supabase, { urn: fromUrl.urn, role: fromUrl.role as TrialRole, fresh: false, via: "url" });
      return r.ok ? r.trial : null;
    }
    if (!stored) return null;
    if (!(await confirmLookAs(supabase, stored))) {
      writeStored(null);
      return null;
    }
    if (!stored.confirmed) writeStored({ ...stored, confirmed: true });
    return toTrial(stored);
  })();
  resolved = { search, promise };
  return promise;
}

// The page's trial: null until known (`confirmed` false), then the confirmed trial or null.
export function useTrial(supabase: SupabaseClient): { trial: Trial | null; confirmed: boolean } {
  const [state, setState] = useState<{ trial: Trial | null; confirmed: boolean }>({ trial: null, confirmed: false });
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      resolveTrial(supabase).then(
        (trial) => { if (!cancelled) setState({ trial, confirmed: true }); },
        () => { if (!cancelled) setState({ trial: null, confirmed: true }); },
      );
    };
    run();
    const onChange = () => { resolved = null; run(); };
    window.addEventListener(TRIAL_EVENT, onChange);
    return () => { cancelled = true; window.removeEventListener(TRIAL_EVENT, onChange); };
  }, [supabase]);
  return state;
}

// ------------------------------------------------------------------ the /account card

export type RecentTrial = { urn: string; role: TrialRole; schoolName: string; lastUsedAt: string };

const LOCAL_RECENT = "vicdata.trial.recent";

// Before the migration is applied, "Recently tried" and the Start-fresh default fall back
// to this browser's own list.
function rememberLocally(urn: string, role: TrialRole) {
  try {
    const list = JSON.parse(window.localStorage.getItem(LOCAL_RECENT) ?? "[]") as { urn: string; role: TrialRole; at: string }[];
    const next = [{ urn, role, at: new Date().toISOString() }, ...list.filter((x) => !(x.urn === urn && x.role === role))].slice(0, 20);
    window.localStorage.setItem(LOCAL_RECENT, JSON.stringify(next));
  } catch {
    // A convenience only.
  }
}

function localRecent(): { urn: string; role: TrialRole; at: string }[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(LOCAL_RECENT) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x.urn === "string" && (TRIAL_ROLES as string[]).includes(x.role)) : [];
  } catch {
    return [];
  }
}

export async function listRecentTrials(supabase: SupabaseClient, limit = 5): Promise<RecentTrial[]> {
  const { data, error } = await supabase
    .from("trial_contexts")
    .select("school_urn, role, last_used_at")
    .order("last_used_at", { ascending: false })
    .limit(limit);
  const rows: { urn: string; role: TrialRole; at: string }[] = error
    ? localRecent().slice(0, limit)
    : ((data ?? []) as { school_urn: string; role: TrialRole; last_used_at: string }[]).map((r) => ({ urn: r.school_urn, role: r.role, at: r.last_used_at }));
  if (!rows.length) return [];
  const { data: schools } = await supabase.from("schools").select("urn, current_name").in("urn", [...new Set(rows.map((r) => r.urn))]);
  const names = new Map(((schools ?? []) as { urn: string; current_name: string }[]).map((s) => [s.urn, s.current_name]));
  return rows.map((r) => ({ urn: r.urn, role: r.role, schoolName: names.get(r.urn) ?? r.urn, lastUsedAt: r.at }));
}

// Has Guy tried this school + role before? (Start fresh is ticked by default when not.)
export async function hasTried(supabase: SupabaseClient, urn: string, role: TrialRole): Promise<boolean> {
  const { data, error } = await supabase.from("trial_contexts").select("role").eq("school_urn", urn).eq("role", role).maybeSingle();
  if (error) return localRecent().some((x) => x.urn === urn && x.role === role);
  return !!data;
}

// The trial's school as the member pages need it (name, and its school account if it has
// one -- read only, for which school dashboards a member of it would see).
export async function trialSchool(supabase: SupabaseClient, trial: Trial): Promise<{ urn: string; name: string; accountId: string }> {
  const { data } = await supabase.from("school_accounts").select("id").eq("school_urn", trial.urn).maybeSingle<{ id: string }>();
  return { urn: trial.urn, name: trial.schoolName, accountId: data?.id ?? "" };
}

// The roles whose VicData dashboards a single-role member of the trial's role is offered.
// A School-Admin-only member still holds Teacher (memberships default to it), so a
// School-Admin trial sees Teacher's too.
export function trialVisibleRoles(trial: Trial): TrialRole[] {
  return trial.role === "school_admin" ? ["teacher", "school_admin"] : [trial.role];
}
