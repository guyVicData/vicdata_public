// VicData 0.8 SMT round 1 (spec §2.4): who may see SMT. Pure, shared by the routes (auth.ts) and the page.
// SMT (governors are given the SMT role: roles.ts maps head_governor to smt) and the School-Admin
// (is_admin, or the account holder). Platform admins through View as, read-only, are checked apart.
export const SMT_ONLY_MESSAGE = "The SMT dashboards are for the school's SMT, its governors and its School-Admin.";

export function canSeeSmt(m: { roles: string[]; isAdmin: boolean; isAccountHolder: boolean }): boolean {
  return m.roles.includes("smt") || m.isAdmin || m.isAccountHolder;
}
