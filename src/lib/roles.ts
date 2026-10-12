// Teacher view role model (design brief v2 §3).
//
// Role -- not the free-text job title -- is what view and dataset access gate on. Before
// this build, `role` was written at join and rendered on the account page, and nothing
// read it to decide what anyone saw; `is_admin` was the only real gate. So "role drives
// the view" is something this build establishes rather than something it confirms.
//
// 0.6 S1 (supabase/migrations/20261103090000_v06_s1_roles_teams_platform.sql, applied
// live): roles are a SET per membership, `school_memberships.roles text[]`, constrained to
// the vocabulary below. The single `role` column is kept and synced by trigger to the most
// senior role in the set, for old readers. School-Admin is NOT a member of `roles`: it is
// the existing `is_admin` boolean (plus the account holder, who is always School-Admin),
// and only the account holder can change it (enforced by trigger). `normaliseRole` still
// bridges the pre-vocabulary values ('head_governor', 'director_of_studies',
// 'head_of_department') wherever an old row or the single `role` column is read.

export const TEACHER_VIEW_ROLES = ["teacher", "hod", "smt", "finance", "admissions"] as const;
export type TeacherViewRole = (typeof TEACHER_VIEW_ROLES)[number];

// §3: Teacher is self-selected and the default for an individual joining alone. HOD is
// admin-grantable but carries no capability difference until 1.1. SMT, Finance and
// Admissions are admin-granted only, because all three plausibly carry more sensitive
// material than the base Teacher view.
export const ADMIN_GRANTED_ROLES: TeacherViewRole[] = ["hod", "smt", "finance", "admissions"];
export const DEFAULT_ROLE: TeacherViewRole = "teacher";

export function isAdminGranted(role: TeacherViewRole): boolean {
  return ADMIN_GRANTED_ROLES.includes(role);
}

// §3's folding rules, applied to values written before the vocabulary changed:
//   head_governor       -> smt  ("SMT absorbs what earlier drafts called head/governors")
//   director_of_studies -> smt  (an independent-school title, not a distinct role --
//                                state schools have year-group leaders instead)
//   head_of_department  -> hod
// A null role is a Teacher: that is the baseline every admin-granted role upgrades from.
const LEGACY_ROLE_MAP: Record<string, TeacherViewRole> = {
  head_governor: "smt",
  director_of_studies: "smt",
  head_of_department: "hod",
};

export function normaliseRole(raw: string | null | undefined): TeacherViewRole {
  if (!raw) return DEFAULT_ROLE;
  if ((TEACHER_VIEW_ROLES as readonly string[]).includes(raw)) return raw as TeacherViewRole;
  return LEGACY_ROLE_MAP[raw] ?? DEFAULT_ROLE;
}

// §3: "Role display labels should come from a language file keyed by role + sector, since
// sector is known at signup". The mechanism is here; it is populated only where a real
// sector difference exists, rather than inventing sector-specific wording nobody asked
// for. Director of Studies is the case §3 actually names: the independent sector's own
// word for part of what SMT covers.
export type RoleSector = "independent" | "state";

const SECTOR_ROLE_LABELS: Partial<Record<RoleSector, Partial<Record<TeacherViewRole, string>>>> = {
  independent: { smt: "SMT / Director of Studies" },
};

const ROLE_LABELS: Record<TeacherViewRole, string> = {
  teacher: "Teacher",
  hod: "Head of Department",
  smt: "SMT",
  finance: "Finance",
  admissions: "Admissions",
};

export function roleLabel(role: TeacherViewRole, sector?: RoleSector | null): string {
  return (sector && SECTOR_ROLE_LABELS[sector]?.[role]) ?? ROLE_LABELS[role];
}

// 0.6's visible roles, in the order People.dc.html draws its chips (SMT, Teacher,
// Admissions, School-Admin). HOD and Finance stay in the vocabulary and the database but
// are hidden in the 0.6 UI. "school_admin" is a UI id only: it reads and writes
// `is_admin`, never `roles`.
export type VisibleRoleId = "smt" | "teacher" | "admissions" | "school_admin";
export const VISIBLE_ROLES: VisibleRoleId[] = ["smt", "teacher", "admissions", "school_admin"];
// The order a list of roles reads in prose (Platform's "Roles in use": "Teacher, SMT,
// Admissions, School-Admin") -- the base role first, then the granted ones.
export const VISIBLE_ROLES_PROSE_ORDER: VisibleRoleId[] = ["teacher", "smt", "admissions", "school_admin"];
export const HIDDEN_ROLES: TeacherViewRole[] = ["hod", "finance"];

export const VISIBLE_ROLE_LABELS: Record<VisibleRoleId, string> = {
  smt: "SMT",
  teacher: "Teacher",
  admissions: "Admissions",
  school_admin: "School-Admin",
};

// A membership's roles as the set the UI shows: the `roles` array (legacy values folded
// through normaliseRole, hidden roles dropped) plus School-Admin when is_admin or the
// account holder. Falls back to the single `role` column for a row read without `roles`.
export function visibleRolesOf(m: {
  roles?: string[] | null;
  role?: string | null;
  is_admin?: boolean | null;
  isAccountHolder?: boolean;
}): VisibleRoleId[] {
  const raw = m.roles && m.roles.length ? m.roles : m.role ? [m.role] : [];
  const set = new Set<VisibleRoleId>();
  for (const r of raw) {
    const n = normaliseRole(r);
    if (n === "teacher" || n === "smt" || n === "admissions") set.add(n);
  }
  if (m.is_admin || m.isAccountHolder) set.add("school_admin");
  return VISIBLE_ROLES.filter((r) => set.has(r));
}

// One resolver the rest of the build gates on, rather than role checks scattered across
// components. Teacher view is the standard view every role currently sees; SMT, Finance
// and Admissions get their own views in a later round (§17), so today they fall back to
// Teacher view rather than to nothing.
export function seesTeacherView(role: TeacherViewRole): boolean {
  return TEACHER_VIEW_ROLES.includes(role);
}

// HOD's distinguishing capability is the department dropdown and roster, which is 1.1 and
// explicitly NOT this build (§4). Exposed as a named predicate anyway so 1.1 has one
// place to switch on, and so nothing in this build accidentally gates on the role itself.
// The parameter is the whole point: 1.1 switches on it here, and keeping it now means
// callers written in this build do not change when it starts returning true for hod.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasDepartmentCapability(role: TeacherViewRole): boolean {
  return false;
}

// 0.7 admissions r1 (A3): the Admissions lead is a FLAG on the admissions membership
// (school_memberships.admissions_lead), not a new role value, so a lead is still
// `admissions` everywhere roles are read (the automatic Admissions team, shares, dashboard
// assignments). Only the School-Admin can set it (database trigger). The lead builds and
// edits the school's entry points and admissions lists, and can grant or remove
// `admissions` only, for approved members of the same school (admissions_set_member).
export const ADMISSIONS_LEAD_LABEL = "Admissions lead";

/** "Admissions lead" for a lead, "Admissions" for other admissions staff, else null. */
export function admissionsLabel(m: { roles: readonly string[]; admissions_lead?: boolean | null }): string | null {
  if (!m.roles.includes("admissions")) return null;
  return m.admissions_lead ? ADMISSIONS_LEAD_LABEL : ROLE_LABELS.admissions;
}
