import type { SupabaseClient } from "@supabase/supabase-js";

// VicData 0.8 groups r1 (G6): test group accounts for the demos, behind the preview-session testing
// route only (never a production data path). Harris Federation (GIAS MAT 3320) and Dukes Education (its
// Club ISS group), each with its own preview head-office user as head-office admin. Made directly with
// the service role: no invitation is ever created, so nothing could be sent or taken up by anyone else.
export const PREVIEW_GROUPS = {
  harris: { groupId: "3320", name: "Harris Federation" },
  dukes: { groupId: "club_iss:dukes-education", name: "Dukes Education" },
} as const;
export type PreviewGroupKey = keyof typeof PREVIEW_GROUPS;

export const isPreviewGroup = (k: string | null): k is PreviewGroupKey => !!k && k in PREVIEW_GROUPS;

/** The preview head-office user's address for a group: the preview address, plus-tagged. */
export function previewGroupEmail(previewEmail: string, key: PreviewGroupKey): string {
  const [local, domain] = previewEmail.split("@");
  return `${local}+group-${key}@${domain}`;
}

export async function seedPreviewGroup(admin: SupabaseClient, profileId: string, key: PreviewGroupKey): Promise<{ ok: true; accountId: string } | { ok: false; error: string }> {
  const g = PREVIEW_GROUPS[key];
  let { data: acc } = await admin.from("group_accounts").select("id").eq("group_id", g.groupId).maybeSingle<{ id: string }>();
  if (!acc) {
    const { data, error } = await admin.from("group_accounts").insert({ group_id: g.groupId, display_name: g.name }).select("id").single<{ id: string }>();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not create the group account" };
    acc = data;
  }
  const { error } = await admin.from("group_memberships").upsert({ group_account_id: acc.id, profile_id: profileId, role: "head_office_admin" }, { onConflict: "group_account_id,profile_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, accountId: acc.id };
}
