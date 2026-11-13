// VicData 0.8 front door, part 2 (F26, F28): what the School-Admin's account page and membership page read,
// for a caller the route has already confirmed is the school's School-Admin or account holder (or a platform
// admin's View as / peek of one: read-only). Server-only.
//   - The school's people, join requests, teams and school sets: the caller's own reader (their RLS; the
//     service role only once View as has been confirmed, as every product route does).
//   - The membership record and its invoices: the same reader, so RLS (can_read_membership) decides.
//   - "Active this month" and head office's sharing: counts and switches read with the service role after the
//     check -- usage_events and the group tables aren't readable by a School-Admin's own session -- and never
//     anything else from them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "../supabase";
import type { AccountSummary, MembershipRecord, MembershipStatus, Plan } from "./membership";

const missing = (msg: string | undefined) => /does not exist|schema cache|account_memberships|membership_plans/i.test(msg ?? "");

type PlanRow = { code: string; name: string; applies_to: Plan["appliesTo"]; price_month_pence: number | null; price_year_pence: number | null; per_school_month_pence: number | null; pilot_months: number };
type RecordRow = {
  id: string;
  status: MembershipStatus;
  joined_on: string;
  pilot_ends_on: string | null;
  renews_on: string | null;
  auto_renew: boolean;
  covered_by_group_account_id: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  purchase_order: string | null;
  invoice_address: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  membership_plans: PlanRow | null;
  membership_invoices: { period_start: string; period_end: string; amount_pence: number; status: "free" | "due" | "paid" | "void"; pdf_path: string | null }[] | null;
};

export const planOf = (p: PlanRow): Plan => ({ code: p.code, name: p.name, appliesTo: p.applies_to, priceMonthPence: p.price_month_pence, priceYearPence: p.price_year_pence, perSchoolMonthPence: p.per_school_month_pence, pilotMonths: p.pilot_months });

/** The school's membership record (RLS decides who reads it), or notSetUp before the migration. */
export async function readMembership(reader: SupabaseClient, schoolAccountId: string): Promise<{ record: MembershipRecord | null; notSetUp: boolean }> {
  const { data, error } = await reader
    .from("account_memberships")
    .select("id, status, joined_on, pilot_ends_on, renews_on, auto_renew, covered_by_group_account_id, billing_contact_name, billing_contact_email, purchase_order, invoice_address, card_brand, card_last4, card_exp_month, card_exp_year, membership_plans(code, name, applies_to, price_month_pence, price_year_pence, per_school_month_pence, pilot_months), membership_invoices(period_start, period_end, amount_pence, status, pdf_path)")
    .eq("school_account_id", schoolAccountId)
    .maybeSingle<RecordRow>();
  if (error) return { record: null, notSetUp: missing(error.message) };
  if (!data || !data.membership_plans) return { record: null, notSetUp: false };
  let coveredBy: MembershipRecord["coveredBy"] = null;
  if (data.covered_by_group_account_id) {
    // The group's name and its own billing contact (the group's record), read after the check.
    const sb = createServiceRoleSupabaseClient();
    const [{ data: g }, { data: gm }] = await Promise.all([
      sb.from("group_accounts").select("display_name").eq("id", data.covered_by_group_account_id).maybeSingle<{ display_name: string }>(),
      sb.from("account_memberships").select("billing_contact_name, billing_contact_email").eq("group_account_id", data.covered_by_group_account_id).maybeSingle<{ billing_contact_name: string | null; billing_contact_email: string | null }>(),
    ]);
    coveredBy = { name: g?.display_name ?? "your group", billingContactName: gm?.billing_contact_name ?? null, billingContactEmail: gm?.billing_contact_email ?? null };
  }
  return {
    notSetUp: false,
    record: {
      status: data.status,
      plan: planOf(data.membership_plans),
      joinedOn: data.joined_on,
      pilotEndsOn: data.pilot_ends_on,
      renewsOn: data.renews_on,
      autoRenew: data.auto_renew,
      coveredBy,
      billingContactName: data.billing_contact_name,
      billingContactEmail: data.billing_contact_email,
      purchaseOrder: data.purchase_order,
      invoiceAddress: data.invoice_address,
      card: data.card_brand && data.card_last4 ? { brand: data.card_brand, last4: data.card_last4, expMonth: data.card_exp_month, expYear: data.card_exp_year } : null,
      invoices: [...(data.membership_invoices ?? [])].sort((a, b) => b.period_start.localeCompare(a.period_start)).map((i) => ({ periodStart: i.period_start, periodEnd: i.period_end, amountPence: i.amount_pence, status: i.status, pdf: !!i.pdf_path })),
    },
  };
}

/** Everything the account page summarises, for one school. */
export async function readAccountSummary(reader: SupabaseClient, o: { urn: string; today: string }): Promise<AccountSummary & { schoolAccountId: string | null; ages: { low: number | null; high: number | null } }> {
  const [{ data: acc }, { data: school }] = await Promise.all([
    reader.from("school_accounts").select("id").eq("school_urn", o.urn).maybeSingle<{ id: string }>(),
    reader.from("schools").select("current_name, statutory_low_age, statutory_high_age").eq("urn", o.urn).maybeSingle<{ current_name: string; statutory_low_age: number | null; statutory_high_age: number | null }>(),
  ]);
  const base = { school: { urn: o.urn, name: school?.current_name ?? o.urn }, ages: { low: school?.statutory_low_age ?? null, high: school?.statutory_high_age ?? null } };
  if (!acc) return { ...base, schoolAccountId: null, joinRequests: 0, people: 0, roles: 0, activeThisMonth: null, teams: 0, schoolSets: 0, headOffice: null, membership: null, membershipNotSetUp: false };
  const sb = createServiceRoleSupabaseClient();
  const monthStart = `${o.today.slice(0, 7)}-01T00:00:00Z`;
  const [members, teams, sets, membership] = await Promise.all([
    reader.from("school_memberships").select("id, status, roles, is_admin").eq("school_account_id", acc.id),
    reader.from("teams").select("id", { count: "exact", head: true }).eq("school_account_id", acc.id),
    reader.from("sets").select("id", { count: "exact", head: true }).eq("school_account_id", acc.id).eq("owner_scope", "school").eq("archived", false),
    readMembership(reader, acc.id),
  ]);
  const rows = (members.data ?? []) as { id: string; status: string; roles: string[] | null; is_admin: boolean }[];
  const approved = rows.filter((r) => r.status === "approved");
  const roles = new Set<string>();
  for (const r of approved) {
    for (const x of r.roles ?? []) roles.add(x);
    if (r.is_admin) roles.add("school_admin");
  }
  // Active this month: approved members with a logged page view since the 1st (counts only).
  let activeThisMonth: number | null = null;
  if (approved.length) {
    const { data: ev, error } = await sb.from("usage_events").select("membership_id").in("membership_id", approved.map((r) => r.id)).gte("occurred_at", monthStart).limit(20000);
    if (!error) activeThisMonth = new Set(((ev ?? []) as { membership_id: string }[]).map((e) => e.membership_id)).size;
  }
  // Head office: a group with a VicData account that has this school in view, or that it shares Admissions with.
  let headOffice: AccountSummary["headOffice"] = null;
  const [{ data: grants }, { data: shares }] = await Promise.all([
    sb.from("group_view_grants").select("group_account_id").eq("school_urn", o.urn).is("revoked_at", null),
    sb.from("group_admissions_shares").select("group_account_id, shared").eq("school_account_id", acc.id),
  ]);
  const groupIds = Array.from(new Set([...((grants ?? []) as { group_account_id: string }[]).map((g) => g.group_account_id), ...((shares ?? []) as { group_account_id: string }[]).map((s) => s.group_account_id)]));
  if (groupIds.length) {
    const { data: gas } = await sb.from("group_accounts").select("id, display_name").in("id", groupIds).eq("preview", false).limit(1);
    const g = ((gas ?? []) as { id: string; display_name: string }[])[0];
    if (g)
      headOffice = {
        name: g.display_name,
        groupView: ((grants ?? []) as { group_account_id: string }[]).some((x) => x.group_account_id === g.id),
        admissionsShared: ((shares ?? []) as { group_account_id: string; shared: boolean }[]).some((x) => x.group_account_id === g.id && x.shared),
      };
  }
  return {
    ...base,
    schoolAccountId: acc.id,
    joinRequests: rows.filter((r) => r.status === "pending_approval").length,
    people: approved.length,
    roles: roles.size,
    activeThisMonth,
    teams: teams.count ?? 0,
    schoolSets: sets.count ?? 0,
    headOffice,
    membership: membership.record,
    membershipNotSetUp: membership.notSetUp,
  };
}
