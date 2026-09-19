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
export async function fetchOnboardedPhases(supabase: Supa): Promise<TeacherPhase[]> {
  const { data, error } = await supabase.from("teacher_view_onboarding").select("phase");
  if (error || !data) return [];
  return data.map((r: { phase: string }) => r.phase as TeacherPhase);
}

export async function completeOnboarding(supabase: Supa, phase: TeacherPhase): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { error } = await supabase
    .from("teacher_view_onboarding")
    .upsert({ profile_id: userData.user.id, phase }, { onConflict: "profile_id,phase" });
  return !error;
}

// ------------------------------------------------- personal preferences (§3, §7)
// §3: a person's subject selection is personal to them, never owned by someone senior
// and inherited. §7: saved state is a hard requirement, not optional.
export type ColumnState = Record<string, string[]>; // column id -> pinned view ids

export type TeacherPreferences = { subjects: string[]; columns: ColumnState };

const EMPTY_PREFERENCES: TeacherPreferences = { subjects: [], columns: {} };

export async function fetchPreferences(
  supabase: Supa,
  schoolUrn: string,
  phase: TeacherPhase,
): Promise<TeacherPreferences> {
  const { data, error } = await supabase
    .from("teacher_view_preferences")
    .select("subjects, columns")
    .eq("school_urn", schoolUrn)
    .eq("phase", phase)
    .maybeSingle();
  if (error || !data) return EMPTY_PREFERENCES;
  return {
    subjects: Array.isArray(data.subjects) ? (data.subjects as string[]) : [],
    columns: (data.columns as ColumnState) ?? {},
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
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,school_urn,phase" },
  );
  return !error;
}

// §7: "A reset button per column wipes it back to the single default view." Modelled as
// removing the column's key entirely rather than storing an empty array, so "never
// customised" and "reset to default" are the same state and cannot drift apart.
export function resetColumn(columns: ColumnState, columnId: string): ColumnState {
  const next = { ...columns };
  delete next[columnId];
  return next;
}

// --------------------------------------------------------------- notes (§12)
export async function fetchNote(supabase: Supa, chartKey: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("teacher_view_notes")
    .select("body")
    .eq("chart_key", chartKey)
    .maybeSingle();
  if (error || !data) return null;
  return data.body as string;
}

export async function saveNote(supabase: Supa, chartKey: string, body: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  // An emptied note is a deleted note: leaving a blank row would show an empty note
  // indicator on a chart the person has deliberately cleared.
  if (body.trim() === "") {
    const { error } = await supabase.from("teacher_view_notes").delete().eq("chart_key", chartKey);
    return !error;
  }
  const { error } = await supabase.from("teacher_view_notes").upsert(
    { profile_id: userData.user.id, chart_key: chartKey, body, updated_at: new Date().toISOString() },
    { onConflict: "profile_id,chart_key" },
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
