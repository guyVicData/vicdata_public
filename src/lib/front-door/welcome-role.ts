// VicData 0.8 beta (Guy, 21 Nov): the first-visit welcome is coloured by the person's role, so it reads as
// "your" product from the first screen. Which role, decided here (pure; the page reads the inputs the way
// the homes do: pickMembership, visibleRolesOf, the peek and View as helpers, /api/group/me):
//   1. A platform admin's peek or View as: the viewed role (head office's included).
//   2. A school membership: its primary role. School-Admin first -- every School-Admin also holds Teacher
//      (memberships default to it: viewAsMembership), so it would otherwise never show -- then the homes'
//      own order for the rest (SMT, Teacher, Admissions: VISIBLE_ROLES, as initialLens opens a home on).
//   3. No school but a head office: head office (the home sends them to the group's, too).
//   4. Anything else: Teacher, the base role.
// The colours themselves are the homes' (globals.css, "the welcome, in the person's role colour").
import { VISIBLE_ROLES, visibleRolesOf, type VisibleRoleId } from "@/lib/roles";
import type { MidField } from "@/lib/front-door/contrast";
import type { ViewAsRole } from "@/lib/view-as";

export type WelcomeRole = VisibleRoleId | "head_office";

/** School-Admin, then the homes' order (VISIBLE_ROLES without it: SMT, Teacher, Admissions). */
export const WELCOME_ROLE_ORDER: VisibleRoleId[] = ["school_admin", ...VISIBLE_ROLES.filter((r) => r !== "school_admin")];

export type WelcomeMembership = Parameters<typeof visibleRolesOf>[0];

/** A membership's primary role for the welcome (WELCOME_ROLE_ORDER); Teacher when it holds none. */
export function primaryRole(m: WelcomeMembership): VisibleRoleId {
  const held = visibleRolesOf(m);
  return WELCOME_ROLE_ORDER.find((r) => held.includes(r)) ?? "teacher";
}

export function welcomeRole(input: {
  /** The role a confirmed platform admin is looking as (peek first, then View as), or null. */
  viewed: ViewAsRole | "head_office" | null;
  /** The person's own school membership (pickMembership's), or null. */
  membership: WelcomeMembership | null;
  /** Whether the person is head office of a group (/api/group/me has an office). */
  headOffice: boolean;
}): WelcomeRole {
  if (input.viewed) return input.viewed;
  if (input.membership) return primaryRole(input.membership);
  if (input.headOffice) return "head_office";
  return "teacher";
}

/**
 * Each role on the welcome: its Mid field (the homes' own: Teacher's GCSE green, SMT's top-level orange,
 * Admissions' sky, head office's orange with the bronze accent; School-Admin's amber field is the welcome's
 * own, as no home draws one), the chip's name, and the words in the heading ("Welcome to VicData for SMT").
 */
export type WelcomeField = MidField | "school_admin";
export const WELCOME_ROLES: Record<WelcomeRole, { field: WelcomeField; chip: string; forWhom: string; line: string }> = {
  teacher: {
    field: "gcse",
    chip: "Teacher",
    forWhom: "teachers",
    line: "Who takes your subjects, how well they do, and how you compare with schools nearby, from the published figures, in plain questions.",
  },
  smt: {
    field: "top",
    chip: "SMT",
    forWhom: "SMT",
    line: "The whole school first, then down to subjects: how your pupils do and how you compare with schools nearby, from the published figures, in plain questions.",
  },
  admissions: {
    field: "admissions",
    chip: "Admissions",
    forWhom: "Admissions",
    line: "The pool of children who could join you, and the share you win, from the published figures, in plain questions.",
  },
  school_admin: {
    field: "school_admin",
    chip: "School-Admin",
    forWhom: "School-Admins",
    line: "Who uses VicData at your school and what each person sees, alongside the school's own figures, from the published data, in plain questions.",
  },
  head_office: {
    field: "group",
    chip: "Head office",
    forWhom: "head office",
    line: "The group as a whole, then each of its schools: how they do and how they compare, from the published figures, in plain questions.",
  },
};
