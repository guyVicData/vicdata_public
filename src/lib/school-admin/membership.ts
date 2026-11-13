// VicData 0.8 front door, part 2 (F26, F28-F29; R-MEMBERSHIP, R-ADMIN-BADGE): the School-Admin's account
// page and membership page, pure. What each state of the membership record says, what is "waiting" on the
// account page (and so whether the account menu shows its badge), and the prices' words. No payments are
// built: "Update card", "Cancel renewal" and invoice PDFs are shown disabled, saying why.
// The record: public.account_memberships (20261124090000_v08_front_door_r2_membership.sql).

export type MembershipStatus = "pilot" | "active" | "covered_by_group" | "lapsed";

export type Plan = { code: string; name: string; appliesTo: "secondary" | "primary" | "group"; priceMonthPence: number | null; priceYearPence: number | null; perSchoolMonthPence: number | null; pilotMonths: number };

export type MembershipRecord = {
  status: MembershipStatus;
  plan: Plan;
  joinedOn: string;
  pilotEndsOn: string | null;
  renewsOn: string | null;
  autoRenew: boolean;
  coveredBy: { name: string; billingContactName: string | null; billingContactEmail: string | null } | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  purchaseOrder: string | null;
  invoiceAddress: string | null;
  card: { brand: string; last4: string; expMonth: number | null; expYear: number | null } | null;
  invoices: { periodStart: string; periodEnd: string; amountPence: number; status: "free" | "due" | "paid" | "void"; pdf: boolean }[];
};

/** Why the payment actions are disabled (F29: payments aren't set up). */
export const PAYMENTS_LATER = "Coming before the pilot ends";
/** The reminder emails before a renewal, in days. */
export const REMINDER_DAYS = [14, 3] as const;
/** From this month of a pilot (4 of 6), a pilot without a card is asked to add one. */
export const ADD_CARD_FROM_MONTH = 4;

export const pounds = (pence: number) => `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`;
export const poundsExact = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** "30 Jun 2027". Dates are yyyy-mm-dd (UTC), shown as written. */
export function dateWords(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
const monthYear = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/** Is this a pilot that should add a card now (from month 4, no card on file)? */
export function needsCard(r: Pick<MembershipRecord, "status" | "joinedOn" | "card" | "plan">, today: string): boolean {
  if (r.status !== "pilot" || r.card) return false;
  return today >= addMonths(r.joinedOn, ADD_CARD_FROM_MONTH - 1);
}

/** The plan's price words: "£10 a month", "£120 a year, billed annually". A group's own rate may be unset. */
export function priceWords(p: Plan): { month: string | null; year: string | null } {
  return { month: p.priceMonthPence === null ? null : `${pounds(p.priceMonthPence)} a month`, year: p.priceYearPence === null ? null : `${pounds(p.priceYearPence)} a year, billed annually` };
}

export type MembershipView = {
  status: MembershipStatus;
  /** The plan card's heading and its line. */
  planName: string;
  planLine: string;
  price: { month: string | null; year: string | null };
  /** The ticked chips: what's included. */
  included: string[];
  /** The banner at the top for a pilot, covered or lapsed record (null for an active one). */
  banner: { title: string; body: string; tone: "pilot" | "covered" | "lapsed" } | null;
  /** "Add a card to keep VicData after 30 Jun 2027", from month 4 of a pilot without a card. */
  addCard: string | null;
  /** The renewal card (null when covered by a group: no billing here). */
  renewal: { date: string; auto: string; charge: string; reminders: string } | null;
  billing: { contact: string; card: string; purchaseOrder: string; invoiceAddress: string } | null;
  coveredContact: string | null;
  invoices: { period: string; amount: string; status: string }[];
  /** Every payment action, disabled with its reason (F29). */
  actions: { label: string; disabled: true; why: string }[];
};

/** What the membership page says for a record (each state from the record alone). */
export function membershipView(r: MembershipRecord, o: { phases: string; today: string }): MembershipView {
  const price = priceWords(r.plan);
  const primary = r.plan.appliesTo === "primary";
  const included = ["Unlimited staff", o.phases, "SMT, Admissions and Teacher dashboards", "Walkthroughs, sets and meetings"];
  const card = r.card ? `${r.card.brand} ending ${r.card.last4}${r.card.expMonth && r.card.expYear ? ` · expires ${String(r.card.expMonth).padStart(2, "0")}/${String(r.card.expYear).slice(-2)}` : ""}` : "No card yet";
  const contact = r.billingContactName || r.billingContactEmail ? [r.billingContactName, r.billingContactEmail].filter(Boolean).join(" · ") : "Not set";
  const yearly = r.plan.priceYearPence;
  const banner: MembershipView["banner"] =
    r.status === "pilot"
      ? { title: `Pilot · free for ${r.plan.pilotMonths} months, until ${dateWords(r.pilotEndsOn)}`, body: yearly !== null ? `Nothing is charged until then. After it, ${r.plan.name.toLowerCase()} is ${price.month}${price.year ? ` (${pounds(yearly)} a year)` : ""}${r.card ? `, charged to ${card.split(" · ")[0]}` : ""}.` : "Nothing is charged until then. After it, the group rate applies.", tone: "pilot" }
      : r.status === "covered_by_group"
        ? { title: `Covered by ${r.coveredBy?.name ?? "your group"}`, body: "No billing here: renewal, invoices and payment sit with your head office.", tone: "covered" }
        : r.status === "lapsed"
          ? { title: `Lapsed on ${dateWords(r.renewsOn)}`, body: "The membership wasn't renewed. Contact VicData to start it again.", tone: "lapsed" }
          : null;
  const renewal: MembershipView["renewal"] =
    r.status === "covered_by_group"
      ? null
      : {
          date: dateWords(r.status === "pilot" ? (r.pilotEndsOn ?? r.renewsOn) : r.renewsOn),
          auto: r.status === "lapsed" ? "lapsed" : r.autoRenew ? "renews automatically" : "won't renew",
          charge: yearly === null ? "The group rate will be charged." : r.card ? `${pounds(yearly)} will be charged to ${r.card.brand} ending ${r.card.last4}.` : `${pounds(yearly)} will be charged to the card you add.`,
          reminders: `We'll email the billing contact ${REMINDER_DAYS[0]} days and ${REMINDER_DAYS[1]} days before.`,
        };
  return {
    status: r.status,
    planName: r.plan.name,
    planLine: `${primary ? "Primary school" : r.plan.appliesTo === "group" ? "Group" : "Secondary school"} · everyone at the school, every role`,
    price,
    included,
    banner,
    addCard: needsCard(r, o.today) ? `Add a card to keep VicData after ${dateWords(r.pilotEndsOn)}` : null,
    renewal,
    billing: r.status === "covered_by_group" ? null : { contact, card, purchaseOrder: r.purchaseOrder ?? "Optional, printed on the invoice", invoiceAddress: r.invoiceAddress ?? "Not set" },
    coveredContact: r.status === "covered_by_group" ? [r.coveredBy?.billingContactName, r.coveredBy?.billingContactEmail].filter(Boolean).join(" · ") || "Your head office's billing contact" : null,
    invoices: r.invoices.map((i) => ({ period: `${r.status === "pilot" && i.status === "free" ? "Pilot, " : ""}${monthYear(i.periodStart)} – ${monthYear(i.periodEnd)}`, amount: poundsExact(i.amountPence), status: i.status === "free" ? "Free" : i.status === "paid" ? "Paid" : i.status === "due" ? "Due" : "Void" })),
    actions: r.status === "covered_by_group" ? [] : [
      { label: r.card ? "Update card" : "Add a card", disabled: true, why: PAYMENTS_LATER },
      { label: "Cancel renewal", disabled: true, why: PAYMENTS_LATER },
      { label: "Invoice PDFs", disabled: true, why: PAYMENTS_LATER },
    ],
  };
}

// ------------------------------------------------------------------------------------------- the account page

export type AccountSummary = {
  school: { urn: string; name: string };
  joinRequests: number;
  people: number;
  roles: number;
  activeThisMonth: number | null;
  teams: number;
  schoolSets: number;
  /** The school's group with a VicData group account, if any: head office's view and the Admissions share. */
  headOffice: { name: string; groupView: boolean; admissionsShared: boolean } | null;
  membership: MembershipRecord | null;
  /** The membership tables aren't there yet (before the migration). */
  membershipNotSetUp: boolean;
};

export type AccountRow = { id: string; title: string; summary: string; href: string | null; badge: string | null };

/** The account page's rows, in the design's order. Sign-ins and devices (F27) is Part 3's: no row here. */
export function accountRows(s: AccountSummary, today: string): AccountRow[] {
  const m = s.membership;
  const rows: AccountRow[] = [
    { id: "join", title: "Join requests", summary: s.joinRequests ? `${s.joinRequests} waiting` : "None waiting", href: "/teacher/people", badge: s.joinRequests ? `${s.joinRequests} new` : null },
    { id: "people", title: "People and roles", summary: `${s.people} ${s.people === 1 ? "person" : "people"} · ${s.roles} ${s.roles === 1 ? "role" : "roles"}`, href: "/teacher/people", badge: null },
    { id: "teams", title: "Teams", summary: `${s.teams} ${s.teams === 1 ? "team" : "teams"}`, href: "/teacher/teams", badge: null },
    { id: "sets", title: "School sets", summary: `${s.schoolSets} shared ${s.schoolSets === 1 ? "set" : "sets"} of feeders, rivals and comparison schools`, href: `/sets?urn=${s.school.urn}`, badge: null },
  ];
  if (s.headOffice)
    rows.push({ id: "head_office", title: "Head office sharing", summary: `${s.headOffice.name}: ${s.headOffice.groupView ? "your SMT sees the group dashboards" : "no group dashboards yet"} · Admissions panels ${s.headOffice.admissionsShared ? "shared" : "not shared"}`, href: "/teacher/school-account/head-office", badge: null });
  rows.push({
    id: "membership",
    title: "Membership",
    summary: s.membershipNotSetUp || !m ? "Not set up yet" : m.status === "pilot" ? `Pilot · free until ${dateWords(m.pilotEndsOn)}` : m.status === "covered_by_group" ? `Covered by ${m.coveredBy?.name ?? "your group"}` : m.status === "lapsed" ? `Lapsed on ${dateWords(m.renewsOn)}` : `Renews ${dateWords(m.renewsOn)} · ${s.people} people`,
    href: "/teacher/school-account/membership",
    badge: m && needsCard(m, today) ? "Add a card" : null,
  });
  return rows;
}

/** How many things wait on the account page: the badge's number (0: no badge). */
export const waitingCount = (rows: AccountRow[]) => rows.filter((r) => r.badge).reduce((n, r) => n + (r.id === "join" ? Number(/^\d+/.exec(r.badge!)?.[0] ?? 1) : 1), 0);

/** R-ADMIN-BADGE: the account menu shows the badge exactly when the account page has something waiting, and
 * only to a School-Admin (or the account holder). */
export const showAdminBadge = (o: { isSchoolAdmin: boolean; waiting: number }) => o.isSchoolAdmin && o.waiting > 0;

/** "GCSE and Post-16" from the school's age range (the chip on the plan). */
export function phasesWords(low: number | null, high: number | null): string {
  const out: string[] = [];
  if ((low ?? 99) <= 10 && (high ?? 0) >= 7) out.push("Key stage 2");
  if ((low ?? 99) <= 15 && (high ?? 0) >= 16) out.push("GCSE");
  if ((high ?? 0) >= 17) out.push("Post-16");
  return out.length ? out.join(" and ").replace(/ and (?=.* and )/, ", ") : "Every phase";
}
