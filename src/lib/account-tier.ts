// Review pack 22 Nov, issue 4 (R-TIER-ADMIN-ONLY): a school's plan (school_accounts.tier) on /account.
// Setting it directly is a platform admin's tool (there is no billing yet), so only a platform admin
// gets the dropdown; anyone else sees the plan in words, or nothing when no plan is set.
export const TIER_LABELS: Record<string, string> = { individual: "Individual", school: "School-wide" };

export type TierRow = { kind: "edit" } | { kind: "read"; label: string } | { kind: "none" };

export function tierRowFor(input: { platformAdmin: boolean; isAccountHolder: boolean; tier: string | null | undefined }): TierRow {
  if (input.platformAdmin && input.isAccountHolder) return { kind: "edit" };
  const label = input.tier ? TIER_LABELS[input.tier] : undefined;
  return label ? { kind: "read", label } : { kind: "none" };
}
