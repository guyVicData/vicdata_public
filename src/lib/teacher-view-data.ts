// Teacher view persistence layer (design brief v2 §§5, 7, 10, 11, 12).
//
// Everything here is creator-only by RLS (profile_id = auth.uid()), so these helpers
// never take an owner argument -- the database decides, not the caller. That is
// deliberate: §10's candidate names and §12's private notes must not be able to leak by a
// caller passing the wrong id.
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { TeacherPhase } from "./teacher-view-phases";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

// ---------------------------------------------------------------- onboarding (§5)
// Presence of a row IS the unlock. There is no boolean to flip and no "show again"
// setting, because §5 resolves repeatability through the mechanism itself.
//
// Scoped by school as well as by person, exactly as fetchPreferences/savePreferences
// below already were. Completing the KS4 walkthrough is a fact about this person AT THIS
// SCHOOL, not about the person: the walkthrough's own subject picker is built from one
// school's taxonomy, so carrying its completion across schools skipped the only step that
// asks which subjects you teach -- leaving the new school's dashboard with the previous
// school's subject list.
export async function fetchOnboardedPhases(supabase: Supa, schoolUrn: string): Promise<TeacherPhase[]> {
  const { data, error } = await supabase
    .from("teacher_view_onboarding")
    .select("phase")
    .eq("school_urn", schoolUrn);
  if (error || !data) return [];
  return data.map((r: { phase: string }) => r.phase as TeacherPhase);
}

export async function completeOnboarding(supabase: Supa, schoolUrn: string, phase: TeacherPhase): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { error } = await supabase
    .from("teacher_view_onboarding")
    .upsert(
      { profile_id: userData.user.id, school_urn: schoolUrn, phase },
      { onConflict: "profile_id,school_urn,phase" },
    );
  return !error;
}

// ------------------------------------------------- personal preferences (§3, §7)
// §3: a person's subject selection is personal to them, never owned by someone senior
// and inherited. §7: saved state is a hard requirement, not optional.
export type ColumnState = Record<string, string[]>; // column id -> pinned view ids

export type TeacherPreferences = { subjects: string[]; columns: ColumnState; lastSeenPeriod: number | null };

const EMPTY_PREFERENCES: TeacherPreferences = { subjects: [], columns: {}, lastSeenPeriod: null };

export async function fetchPreferences(
  supabase: Supa,
  schoolUrn: string,
  phase: TeacherPhase,
): Promise<TeacherPreferences> {
  const { data, error } = await supabase
    .from("teacher_view_preferences")
    .select("subjects, columns, last_seen_period")
    .eq("school_urn", schoolUrn)
    .eq("phase", phase)
    .maybeSingle();
  if (error || !data) return EMPTY_PREFERENCES;
  return {
    subjects: Array.isArray(data.subjects) ? (data.subjects as string[]) : [],
    columns: (data.columns as ColumnState) ?? {},
    lastSeenPeriod: (data.last_seen_period as number | null) ?? null,
  };
}

export async function savePreferences(
  supabase: Supa,
  schoolUrn: string,
  phase: TeacherPhase,
  prefs: TeacherPreferences,
): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { error } = await supabase.from("teacher_view_preferences").upsert(
    {
      profile_id: userData.user.id,
      school_urn: schoolUrn,
      phase,
      subjects: prefs.subjects,
      columns: prefs.columns,
      last_seen_period: prefs.lastSeenPeriod,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,school_urn,phase" },
  );
  return !error;
}

// Round 6: a column's settings live in the SAME `columns` JSON as its panel list, under
// prefixes that can never collide with a column id -- so the whole round needs no schema
// change and round-trips through the one existing save. Values are string arrays because
// that is the column shape already; a scalar is simply a one-element array.
//
// What is saved here is deliberately "which data", not "which shape": the measure, the
// comparison group, the chosen subject set, the comparator set. Coming back to a card
// showing a DIFFERENT NUMBER from the one you left is disorienting in a way that coming
// back to the same number drawn as bars rather than a table is not -- so the view
// toggles, sort order, focus chip and From:/Since: span stay component state and reset on
// reload. Flagged as a judgement call in the round-6 build report.
export const CHOSEN_PREFIX = "chosen:";
export const MEASURE_PREFIX = "measure:";
export const AGAINST_PREFIX = "against:";
export const SET_PREFIX = "set:";

export const chosenKey = (columnId: string) => `${CHOSEN_PREFIX}${columnId}`;
export const measureKey = (columnId: string) => `${MEASURE_PREFIX}${columnId}`;
export const againstKey = (columnId: string) => `${AGAINST_PREFIX}${columnId}`;
export const setKey = (columnId: string) => `${SET_PREFIX}${columnId}`;

// Read one saved scalar setting. Returns undefined rather than a default so each caller's
// own default stays in one place (its catalogue), not duplicated here.
export function readSetting(columns: ColumnState, key: string): string | undefined {
  const value = columns[key];
  return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
}

export function writeSetting(columns: ColumnState, key: string, value: string | null): ColumnState {
  const next = { ...columns };
  if (value === null) delete next[key];
  else next[key] = [value];
  return next;
}

export function readList(columns: ColumnState, key: string): string[] {
  const value = columns[key];
  return Array.isArray(value) ? value : [];
}

export function writeList(columns: ColumnState, key: string, values: string[]): ColumnState {
  const next = { ...columns };
  if (values.length === 0) delete next[key];
  else next[key] = values;
  return next;
}

// §7: "A reset button per column wipes it back to the single default view." Modelled as
// removing the column's key entirely rather than storing an empty array, so "never
// customised" and "reset to default" are the same state and cannot drift apart. Round 6
// keeps that convention exactly -- an absent key now means "Current alone", which is what
// panelsFrom() returns for it -- and extends it to the column's settings, so a reset
// clears the measure and comparison group with the panels rather than leaving a card
// pointed at a measure nobody can see they chose.
export function resetColumn(columns: ColumnState, columnId: string): ColumnState {
  const next = { ...columns };
  delete next[columnId];
  for (const key of [chosenKey(columnId), measureKey(columnId), againstKey(columnId), setKey(columnId)]) delete next[key];
  return next;
}

// --------------------------------------------------------------- notes (§12)
//
// Round 8 §6: a note is now per PANEL, not per card. `chart_key` is free text and always
// has been, so the finer grain is simply a longer key and needs no schema change --
// "ks4:candidates" becomes "ks4:candidates:trend".
//
// Worth recording, because round 8's brief said the opposite: this table is real and has
// been since the original Teacher-view persistence migration, with creator-only RLS. The
// brief's check was scoped to src/components/teacher, and the note UI lived in the phase
// page, so it read as absent. Round 8 relocates and re-keys it; it does not build it.
export const panelNoteKey = (phase: string, columnId: string, panelId: string) => `${phase}:${columnId}:${panelId}`;

// Scoped by school for the same reason onboarding is: chart_key is only a phase and a
// card ("ks5:results"), so it does not identify a school on its own. Without the scope a
// note written about one school's dip appeared against a different school's figures --
// which is worse than losing the note, because it reads as a claim about the new school.
// Every note this person has for this school, keyed by chart_key. RLS already restricts
// the rows to their author, so this asks for "my notes here" and gets exactly that.
export async function fetchNotes(supabase: Supa, schoolUrn: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("teacher_view_notes")
    .select("chart_key, body")
    .eq("school_urn", schoolUrn);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data as { chart_key: string; body: string }[]) out[row.chart_key] = row.body;
  return out;
}

export async function saveNote(supabase: Supa, schoolUrn: string, chartKey: string, body: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  // An emptied note is a deleted note: leaving a blank row would show an empty note
  // indicator on a chart the person has deliberately cleared. Scoped too -- an unscoped
  // delete would clear the same card's note at every school this person has ever used.
  if (body.trim() === "") {
    const { error } = await supabase
      .from("teacher_view_notes")
      .delete()
      .eq("school_urn", schoolUrn)
      .eq("chart_key", chartKey);
    return !error;
  }
  const { error } = await supabase.from("teacher_view_notes").upsert(
    { profile_id: userData.user.id, school_urn: schoolUrn, chart_key: chartKey, body, updated_at: new Date().toISOString() },
    { onConflict: "profile_id,school_urn,chart_key" },
  );
  return !error;
}

// ---------------------------------------------------------- recruitment (§10)
export type RecruitmentJob = {
  id: string;
  title: string;
  subject: string | null;
  ks_stage: "ks4" | "ks5" | null;
  delete_by: string;
  created_at: string;
};

export type RecruitmentCandidate = {
  id: string;
  job_id: string;
  candidate_name: string;
  school_urn: string | null;
  interviewed: boolean;
  interview_at: string | null;
};

export async function fetchJobs(supabase: Supa): Promise<RecruitmentJob[]> {
  const { data, error } = await supabase
    .from("recruitment_jobs")
    .select("id, title, subject, ks_stage, delete_by, created_at")
    .order("created_at", { ascending: false });
  return error || !data ? [] : (data as RecruitmentJob[]);
}

export async function createJob(
  supabase: Supa,
  job: { title: string; subject: string | null; ksStage: "ks4" | "ks5" | null; deleteBy: string },
): Promise<RecruitmentJob | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("recruitment_jobs")
    .insert({
      profile_id: userData.user.id,
      title: job.title,
      subject: job.subject,
      ks_stage: job.ksStage,
      delete_by: job.deleteBy,
    })
    .select("id, title, subject, ks_stage, delete_by, created_at")
    .single();
  return error || !data ? null : (data as RecruitmentJob);
}

// §10: delete-by is the whole retention model, and it is extendable "if the process runs
// long (second rounds, etc.)".
export async function extendJobRetention(supabase: Supa, jobId: string, deleteBy: string): Promise<boolean> {
  const { error } = await supabase.from("recruitment_jobs").update({ delete_by: deleteBy }).eq("id", jobId);
  return !error;
}

export async function fetchCandidates(supabase: Supa, jobId: string): Promise<RecruitmentCandidate[]> {
  const { data, error } = await supabase
    .from("recruitment_candidates")
    .select("id, job_id, candidate_name, school_urn, interviewed, interview_at")
    .eq("job_id", jobId)
    .order("interview_at", { ascending: true, nullsFirst: false });
  return error || !data ? [] : (data as RecruitmentCandidate[]);
}

export async function addCandidate(
  supabase: Supa,
  jobId: string,
  c: { name: string; schoolUrn: string | null; interviewAt: string | null },
): Promise<RecruitmentCandidate | null> {
  const { data, error } = await supabase
    .from("recruitment_candidates")
    .insert({ job_id: jobId, candidate_name: c.name, school_urn: c.schoolUrn, interview_at: c.interviewAt })
    .select("id, job_id, candidate_name, school_urn, interviewed, interview_at")
    .single();
  return error || !data ? null : (data as RecruitmentCandidate);
}

export async function setCandidateInterviewed(supabase: Supa, id: string, interviewed: boolean): Promise<boolean> {
  const { error } = await supabase.from("recruitment_candidates").update({ interviewed }).eq("id", id);
  return !error;
}

// ------------------------------------------------------------- meetings (§11)
export type Meeting = { id: string; name: string; meeting_date: string | null; delete_by: string };
export type MeetingSlide = { id: string; meeting_id: string; position: number; chart_key: string; caption: string | null };

export async function fetchMeetings(supabase: Supa): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("id, name, meeting_date, delete_by")
    .order("meeting_date", { ascending: true, nullsFirst: false });
  return error || !data ? [] : (data as Meeting[]);
}

export async function createMeeting(
  supabase: Supa,
  m: { name: string; meetingDate: string | null; deleteBy: string },
): Promise<Meeting | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("meetings")
    .insert({ profile_id: userData.user.id, name: m.name, meeting_date: m.meetingDate, delete_by: m.deleteBy })
    .select("id, name, meeting_date, delete_by")
    .single();
  return error || !data ? null : (data as Meeting);
}

export async function fetchSlides(supabase: Supa, meetingId: string): Promise<MeetingSlide[]> {
  const { data, error } = await supabase
    .from("meeting_slides")
    .select("id, meeting_id, position, chart_key, caption")
    .eq("meeting_id", meetingId)
    .order("position", { ascending: true });
  return error || !data ? [] : (data as MeetingSlide[]);
}

export async function addSlide(
  supabase: Supa,
  meetingId: string,
  chartKey: string,
  position: number,
  caption: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from("meeting_slides")
    .insert({ meeting_id: meetingId, chart_key: chartKey, position, caption });
  return !error;
}

// --------------------------------------------------------- notifications (§13)
//
// §13's v1 channel is deliberately light: "a banner on the dashboard, a notice on login,
// and a 'NEW' pill wherever something's actually changed. No email/push infrastructure
// needed for this build."
//
// So "new" is derived, not pushed: the newest period the data holds, against the newest
// period this person has seen. That means it cannot go stale, cannot double-fire, and
// needs no read/unread bookkeeping -- and a first-ever visitor is never told that
// perfectly ordinary data is new, because their stored value is NULL rather than 0.
export function hasNewData(latestPeriod: number | null, lastSeenPeriod: number | null): boolean {
  if (latestPeriod === null || lastSeenPeriod === null) return false;
  return latestPeriod > lastSeenPeriod;
}

export async function markPeriodSeen(
  supabase: Supa,
  schoolUrn: string,
  phase: TeacherPhase,
  period: number | null,
): Promise<boolean> {
  if (period === null) return false;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { error } = await supabase.from("teacher_view_preferences").upsert(
    { profile_id: userData.user.id, school_urn: schoolUrn, phase, last_seen_period: period, updated_at: new Date().toISOString() },
    { onConflict: "profile_id,school_urn,phase" },
  );
  return !error;
}
