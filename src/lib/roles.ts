// Teacher view role model (design brief v2 §3).
//
// Role -- not the free-text job title -- is what view and dataset access gate on. Before
// this build, `role` was written at join and rendered on the account page, and nothing
// read it to decide what anyone saw; `is_admin` was the only real gate. So "role drives
// the view" is something this build establishes rather than something it confirms.
//
// The live database constraint still carries the OLD vocabulary
// ('head_governor','admissions','finance','director_of_studies','head_of_department').
// The migration that moves it to the vocabulary below is written and committed at
// supabase/migrations/20261101090000_teacher_view_role_vocabulary.sql but has NOT been
// applied -- applying DDL was blocked during this build. Everything here is written
// against the post-migration vocabulary; `normaliseRole` below bridges the old values in
// the meantime so nothing breaks while the constraint is still the old one.

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
export function hasDepartmentCapability(_role: TeacherViewRole): boolean {
  return false;
}
