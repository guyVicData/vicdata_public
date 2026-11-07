// VicData 0.8 sets round 1 (A1-A4): one model for every set of schools on the site -- the school's
// curated sets, personal sets, and default (recipe) sets -- chosen from one menu and managed in one
// library. Client-safe and pure: the shapes, who may curate what, and which sets fit a page.
// Storage: public.sets / set_members / set_user_state (20261121090000_v08_sets_r1.sql); reads and
// writes: ./store.ts; default sets, computed when shown and never stored: ./recipes.ts.

export type SetKind = "compared_against" | "feeders";
export type OwnerScope = "school" | "personal";
/** Who made a set. Default, group and Victoria Consultancy sets are computed when shown and never
 * stored; a stored set is admissions, smt or school_admin (a school set) or me (a personal one). */
export type CreatorKind = "default" | "admissions" | "smt" | "school_admin" | "group" | "victoria_consultancy" | "me";
export type StoredCreatorKind = "admissions" | "smt" | "school_admin" | "me";
export type Tier = "main" | "regular" | "occasional";
export type Phase = "ks4" | "ks5";
/** The menu's three blocks, always in this order. */
export type SetBlock = "default" | "school" | "mine";
export const SET_BLOCKS: readonly SetBlock[] = ["default", "school", "mine"];

/** Up to 8 ACTIVE personal sets per person; archiving frees a slot (the database's trigger is the
 * backstop: enforce_personal_set_cap). Saved rankings keep their own table and their own cap. */
export const PERSONAL_SET_CAP = 8;

export type SetMember = { urn: string; position: number; tier: Tier | null };

export type StoredSet = {
  id: string;
  name: string;
  description: string | null;
  kind: SetKind;
  entryPoint: string | null;
  phase: Phase | null;
  focusUrn: string | null;
  ownerScope: OwnerScope;
  schoolAccountId: string | null;
  ownerProfileId: string | null;
  creatorKind: StoredCreatorKind;
  audience: "day" | "boarding" | null;
  rungAge: number | null;
  isDefault: boolean;
  pinned: boolean;
  folder: string | null;
  tags: string[];
  archived: boolean;
  rule: Record<string, unknown> | null;
  sourceRecipe: string | null;
  laBlend: Record<string, number> | null;
  config: Record<string, unknown>;
  members: SetMember[];
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

/** The page a set is chosen on: its kind, and the Admissions entry point or the Teacher phase. */
export type SetPage = { kind: SetKind; entryPoint?: string | null; phase?: Phase | null };

/** Admissions' entry points line up with Teacher's phases: 11+ compared-against sets appear on GCSE
 * pages, 16+ on Post-16 pages (B9). Other entry points have no Teacher phase. */
export const phaseOfEntry = (entryPoint: string | null | undefined): Phase | null => (entryPoint === "11+" ? "ks4" : entryPoint === "16+" ? "ks5" : null);
export const entryOfPhase = (phase: Phase | null | undefined): string | null => (phase === "ks4" ? "11+" : phase === "ks5" ? "16+" : null);

/** Does a set fit the page (B7: "the menu shows only the sets that fit the page")? The kind must
 * match. A set with neither an entry point nor a phase is whole-school and fits any page of its
 * kind. Otherwise its entry point or phase must be the page's, where 11+ and GCSE (16+ and
 * Post-16) are the same page for compared-against sets; feeder sets never reach Teacher. */
export function setFitsPage(set: Pick<StoredSet, "kind" | "entryPoint" | "phase">, page: SetPage): boolean {
  if (set.kind !== page.kind) return false;
  if (!set.entryPoint && !set.phase) return true;
  const pageEntry = page.entryPoint ?? (page.kind === "compared_against" ? entryOfPhase(page.phase) : null);
  const pagePhase = page.phase ?? (page.kind === "compared_against" ? phaseOfEntry(page.entryPoint) : null);
  if (set.entryPoint) return set.entryPoint === pageEntry;
  return set.phase === pagePhase;
}

/** The member's standing at a school, as the curate rules read it. */
export type Curator = { roles: readonly string[]; isAdmin: boolean; isAccountHolder?: boolean };

/** Who curates school sets (A2), mirroring the database's can_curate_sets: compared-against by SMT,
 * Admissions and the School-Admin (or the account holder); feeders by Admissions. Teachers use
 * school sets and never build them. */
export function canCurate(m: Curator | null | undefined, kind: SetKind): boolean {
  if (!m) return false;
  if (kind === "feeders") return m.roles.includes("admissions");
  return m.roles.includes("smt") || m.roles.includes("admissions") || m.isAdmin || !!m.isAccountHolder;
}

/** The creator a curator's school set is saved under: a role they hold, Admissions first on
 * Admissions pages, else SMT, else the School-Admin. Null if they can't curate this kind. */
export function creatorFor(m: Curator | null | undefined, kind: SetKind, prefer?: "admissions" | "smt"): Exclude<StoredCreatorKind, "me"> | null {
  if (!m || !canCurate(m, kind)) return null;
  const order: Exclude<StoredCreatorKind, "me">[] = prefer === "smt" ? ["smt", "admissions"] : ["admissions", "smt"];
  for (const r of order) if (m.roles.includes(r) && (kind === "compared_against" || r === "admissions")) return r;
  return "school_admin";
}

export const blockOf = (s: Pick<StoredSet, "ownerScope">): SetBlock => (s.ownerScope === "personal" ? "mine" : "school");

/** Untiered feeders count as Regular (E22). */
export const tierOf = (t: Tier | null | undefined): Tier => t ?? "regular";
export const TIER_ORDER: Record<Tier, number> = { main: 0, regular: 1, occasional: 2 };

/** Active personal sets count against the cap; archived ones don't. */
export const activePersonalCount = (sets: Pick<StoredSet, "ownerScope" | "archived" | "ownerProfileId">[], profileId: string | null) =>
  sets.filter((s) => s.ownerScope === "personal" && !s.archived && (!profileId || s.ownerProfileId === profileId)).length;
