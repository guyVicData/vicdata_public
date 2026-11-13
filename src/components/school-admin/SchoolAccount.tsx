"use client";

// VicData 0.8 front door, part 2 (F26, F28; G): the School-Admin's plain account page and membership page
// (docs/v0.8/front_door_design/png/admin_account.png, membership.png). Dark and Light only: under Mid they
// draw Dark (useTeacherTheme, R-THEME-MID-SCOPE). Opened from the account menu; the admin's home stays the
// home of their other role.
//   Account     Join requests, People and roles, Teams, School sets, Head office sharing, Membership: a
//               one-line summary each and a badge when something is waiting ("3 new", "Add a card"). Each
//               row opens today's page. Sign-ins and devices (F27) is Part 3's: no row yet.
//   Membership  Your plan, Renewal, Who uses it, Billing, Invoices -- or the pilot's, a covered school's or a
//               lapsed record's words. Payment actions are disabled: "Coming before the pilot ends".
// On a phone: one column of cards, every control 44 px.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { loadAdminSchool } from "@/components/admin/AdminChrome";
import { ThemeToggle, useTeacherTheme } from "@/components/shell/TeacherChrome";
import { AccountMenu } from "@/components/shell/TeacherNav";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { useWidth } from "@/components/admissions/views/charts";
import { readPeek } from "@/lib/view-as";
import type { AccountRow, MembershipView } from "@/lib/school-admin/membership";

export const ADMIN_PHONE = 600;
const ADMIN_TEXT = "var(--admin-text)";

export type AccountAnswer = {
  school: { urn: string; name: string };
  readOnly: boolean;
  rows: AccountRow[];
  waiting: number;
  who: { people: number; activeThisMonth: number | null; roles: number };
  membership: MembershipView | null;
  membershipNotSetUp: boolean;
};

/** The school this page is for: a peek's (?lookAs=&as=school_admin&peek=1), else the admin's own (or View as). */
async function schoolUrn(): Promise<string | null> {
  const peek = typeof window === "undefined" ? null : readPeek(new URLSearchParams(window.location.search));
  if (peek) return peek.urn;
  const s = await loadAdminSchool();
  return s.status === "ready" ? s.school.schoolUrn : null;
}

export function useAccountAnswer(): { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: AccountAnswer } {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: AccountAnswer }>({ status: "loading" });
  useEffect(() => {
    (async () => {
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      if (!data.session) return setState({ status: "error", message: "Sign in to see your school's account." });
      const urn = await schoolUrn();
      if (!urn) return setState({ status: "error", message: "The school account page is for your School-Admin." });
      const r = await fetch(`/api/school-admin/account?urn=${urn}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } }).catch(() => null);
      if (!r || !r.ok) return setState({ status: "error", message: r?.status === 403 ? "The school account page is for your School-Admin." : "Could not read the school's account. Try again." });
      setState({ status: "ready", data: (await r.json()) as AccountAnswer });
    })();
  }, []);
  return state;
}

/** The plain page's frame: VicData, the school, "School admin", the theme switch and the account menu. */
export function AdminShell({ school, children }: { school: string | null; children: (phone: boolean) => ReactNode }) {
  const [theme] = useTeacherTheme();
  const [ref, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < ADMIN_PHONE;
  return (
    <main id="teacher-root" data-theme={theme} ref={ref} className="min-h-screen w-full bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--panel-border)]">
        <div className={`mx-auto flex max-w-[1200px] items-center gap-3 ${phone ? "px-4 py-2" : "px-10 py-4"}`}>
          <Link href="/teacher" className="flex min-h-[44px] items-center gap-2.5">
            <span aria-hidden="true" className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[var(--fg)] text-[15px] font-extrabold text-[var(--bg)]">V</span>
            <span className="text-[16px] font-bold">VicData</span>
          </Link>
          {!phone && school && <span className="truncate text-[14px] text-[var(--muted2)]">{school}</span>}
          <span className="flex-grow" />
          <ThemeToggle theme={theme} />
          <AccountMenu />
        </div>
      </header>
      <ViewAsBanner className={phone ? "mx-4 mt-3" : "mx-auto mt-3 max-w-[760px]"} />
      {width > 0 ? children(phone) : null}
    </main>
  );
}

const ICONS: Record<string, ReactNode> = {
  join: <path d="M5 12l5 5L20 7" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2" />
      <path d="M16 4.6a3.2 3.2 0 010 6.4M18 14.9c1.7.7 2.8 2.4 3.1 5.1" />
    </>
  ),
  teams: (
    <>
      <rect x="6" y="3.5" width="12" height="5" rx="1.4" />
      <rect x="4" y="10" width="16" height="4" rx="1.4" />
      <path d="M4 17.5h16" />
    </>
  ),
  sets: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  head_office: (
    <>
      <path d="M3 10.5L12 4l9 6.5V20H3z" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  membership: <path d="M7 17L17 7M9 7h8v8" />,
};

/** The account page (F26). */
export function SchoolAccountPage() {
  const s = useAccountAnswer();
  return (
    <AdminShell school={s.status === "ready" ? s.data.school.name : null}>
      {(phone) => (
        <div data-admin-account={phone ? "phone" : "desktop"} className={`mx-auto flex max-w-[760px] flex-col gap-2 ${phone ? "px-4 py-5" : "px-6 py-12"}`}>
          <div className="text-[13px] font-semibold" style={{ color: ADMIN_TEXT }}>School admin</div>
          <h1 className={`font-bold tracking-[-0.01em] ${phone ? "text-[24px]" : "text-[32px]"}`}>{s.status === "ready" ? `${s.data.school.name}’s account` : "Your school’s account"}</h1>
          <p className={`text-[var(--muted2)] ${phone ? "text-[14px]" : "text-[16px]"}`}>Opened from the account menu. Your home page stays the home of your other role.</p>
          {s.status !== "ready" ? (
            <p className="py-8 text-[13.5px] text-[var(--muted2)]">{s.status === "loading" ? "Loading…" : s.message}</p>
          ) : (
            <nav aria-label="School account" className="mt-4 flex flex-col overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)]">
              {s.data.rows.map((r) => (
                <AccountRowLink key={r.id} r={r} phone={phone} />
              ))}
            </nav>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function AccountRowLink({ r, phone }: { r: AccountRow; phone: boolean }) {
  const inner = (
    <>
      <span aria-hidden="true" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: "var(--admin-tint)", color: ADMIN_TEXT }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[r.id]}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{r.title}</span>
        <span className="block text-[13px] text-[var(--muted2)]">{r.summary}</span>
      </span>
      {r.badge && (
        <span data-admin-badge={r.id} className="shrink-0 rounded-full bg-[var(--admin-badge-bg)] px-2.5 text-[12px] font-bold leading-[22px] text-[var(--admin-badge-fg)]">
          {r.badge}
        </span>
      )}
      <span aria-hidden="true" className="shrink-0 text-[var(--muted2)]">
        &rarr;
      </span>
    </>
  );
  const cls = `flex items-center gap-3 border-b border-[var(--panel-border)] last:border-b-0 ${phone ? "min-h-[64px] px-4 py-3" : "min-h-[64px] px-5 py-3"}`;
  return r.href ? (
    <Link href={r.href} data-admin-row={r.id} className={`${cls} hover:bg-[var(--box-bg)]`}>
      {inner}
    </Link>
  ) : (
    <div data-admin-row={r.id} className={cls}>
      {inner}
    </div>
  );
}

const Card = ({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) => (
  <section className={`rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 ${className}`}>
    <h2 className="pb-3 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted2)]">{title}</h2>
    {children}
  </section>
);

const Disabled = ({ label, why }: { label: string; why: string }) => (
  <span className="inline-flex flex-col items-start gap-0.5">
    <button type="button" disabled aria-disabled="true" title={why} data-payment-action={label} className="min-h-[44px] cursor-not-allowed rounded-[10px] border border-[var(--panel-border2)] px-4 text-[13.5px] font-semibold text-[var(--muted2)] opacity-80">
      {label}
    </button>
    <span className="text-[11.5px] text-[var(--muted2)]">{why}</span>
  </span>
);

/** The membership page (F28), from the record alone (membershipView). */
export function MembershipBody({ data, phone }: { data: AccountAnswer; phone: boolean }) {
  const m = data.membership;
  if (!m)
    return (
      <Card title="Your plan">
        <p className="text-[14px] text-[var(--muted2)]">{data.membershipNotSetUp ? "Membership isn't set up on VicData yet." : "There is no membership record for your school yet. VicData will add it."}</p>
      </Card>
    );
  const grid = phone ? "flex flex-col gap-3" : "grid grid-cols-2 gap-4";
  return (
    <div data-membership={m.status} className="flex flex-col gap-4">
      {m.banner && (
        <section data-membership-banner={m.banner.tone} className="rounded-[14px] border p-5" style={{ borderColor: "rgba(251,191,36,0.45)", background: "rgba(251,191,36,0.09)" }}>
          <div className="text-[17px] font-bold">{m.banner.title}</div>
          <p className="pt-1 text-[13.5px] text-[var(--muted2)]">{m.banner.body}</p>
          {m.addCard && (
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <span data-add-card="" className="text-[14px] font-semibold" style={{ color: ADMIN_TEXT }}>
                {m.addCard}
              </span>
              <Disabled label="Add a card" why="Coming before the pilot ends" />
            </div>
          )}
        </section>
      )}
      <Card title="Your plan">
        <div className={`flex gap-3 ${phone ? "flex-col" : "items-start justify-between"}`}>
          <div>
            <div className="text-[22px] font-bold">{m.planName}</div>
            <div className="text-[14px] text-[var(--muted2)]">{m.planLine}</div>
          </div>
          {m.price.month && (
            <div className={phone ? "" : "text-right"}>
              <div>
                <b className="text-[28px] font-bold">{m.price.month.replace(" a month", "")}</b> <span className="text-[14px] text-[var(--muted2)]">a month</span>
              </div>
              {m.price.year && <div className="text-[13px] text-[var(--muted2)]">{m.price.year}</div>}
            </div>
          )}
        </div>
        <ul className="flex flex-wrap gap-2 pt-4">
          {m.included.map((x) => (
            <li key={x} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-[var(--panel-border2)] px-3 text-[13px]">
              <span aria-hidden="true" style={{ color: ADMIN_TEXT }}>
                ✓
              </span>
              {x}
            </li>
          ))}
        </ul>
      </Card>
      <div className={grid}>
        {m.renewal ? (
          <Card title="Renewal">
            <div>
              <b className="text-[24px] font-bold">{m.renewal.date}</b> <span className="text-[14px] text-[var(--muted2)]">{m.renewal.auto}</span>
            </div>
            <p className="pt-2 text-[13px] text-[var(--muted2)]">
              {m.renewal.charge} {m.renewal.reminders}
            </p>
            <div className="flex flex-wrap gap-3 pt-3">
              {m.actions.filter((a) => a.label !== "Invoice PDFs").map((a) => (
                <Disabled key={a.label} label={a.label} why={a.why} />
              ))}
            </div>
          </Card>
        ) : (
          <Card title="Billing">
            <p className="text-[14px]">No billing here: renewal, invoices and payment sit with your head office.</p>
            <p className="pt-2 text-[13px] text-[var(--muted2)]">Billing contact: {m.coveredContact}</p>
          </Card>
        )}
        <Card title="Who uses it">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {[
              [data.who.people, data.who.people === 1 ? "person" : "people"],
              [data.who.activeThisMonth ?? "—", "active this month"],
              [data.who.roles, data.who.roles === 1 ? "role" : "roles"],
            ].map(([n, w]) => (
              <div key={String(w)}>
                <div className="text-[24px] font-bold tabular-nums">{n}</div>
                <div className="text-[13px] text-[var(--muted2)]">{w}</div>
              </div>
            ))}
          </div>
          <Link href="/teacher/people" className="mt-2 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold" style={{ color: ADMIN_TEXT }}>
            See people and roles &rarr;
          </Link>
        </Card>
      </div>
      {m.billing && (
        <Card title="Billing">
          <dl className={`grid gap-y-2 text-[14px] ${phone ? "grid-cols-1" : "grid-cols-[170px_1fr]"}`}>
            {[
              ["Billing contact", m.billing.contact],
              ["Card on file", m.billing.card],
              ["Purchase order", m.billing.purchaseOrder],
              ["Invoice address", m.billing.invoiceAddress],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--muted2)]">{k}</dt>
                <dd className={phone ? "pb-1" : ""}>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      {m.status !== "covered_by_group" && (
        <Card title="Invoices">
          {m.invoices.length ? (
            <table className="w-full text-[14px]">
              <tbody>
                {m.invoices.map((i) => (
                  <tr key={i.period} className="border-t border-[var(--panel-border)]">
                    <td className="py-2.5">{i.period}</td>
                    <td className="py-2.5 text-right tabular-nums">{i.amount}</td>
                    <td className="py-2.5 pl-4 text-[12.5px] font-semibold text-[var(--muted2)]">{i.status}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" disabled title="Coming before the pilot ends" className="min-h-[44px] cursor-not-allowed px-2 text-[12.5px] text-[var(--muted2)]">
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13.5px] text-[var(--muted2)]">No invoices yet: nothing is charged during the pilot.</p>
          )}
          <p className="pt-2 text-[12px] text-[var(--muted2)]">Invoice PDFs: coming before the pilot ends. Card details are entered on the payment provider&rsquo;s own secure page; VicData only ever keeps &ldquo;Visa ending 4417&rdquo;.</p>
        </Card>
      )}
    </div>
  );
}

export function MembershipPage() {
  const s = useAccountAnswer();
  return (
    <AdminShell school={s.status === "ready" ? s.data.school.name : null}>
      {(phone) => (
        <div data-admin-membership={phone ? "phone" : "desktop"} className={`mx-auto flex max-w-[880px] flex-col gap-2 ${phone ? "px-4 py-4" : "px-6 py-10"}`}>
          <Link href={`/teacher/school-account${typeof window !== "undefined" ? window.location.search : ""}`} className="inline-flex min-h-[44px] items-center self-start text-[13.5px] text-[var(--muted2)] hover:text-[var(--fg)]">
            ‹ {s.status === "ready" ? `${s.data.school.name}’s account` : "Your school’s account"}
          </Link>
          <div className="text-[13px] font-semibold" style={{ color: ADMIN_TEXT }}>School admin</div>
          <h1 className={`pb-3 font-bold tracking-[-0.01em] ${phone ? "text-[24px]" : "text-[32px]"}`}>Membership</h1>
          {s.status !== "ready" ? <p className="py-8 text-[13.5px] text-[var(--muted2)]">{s.status === "loading" ? "Loading…" : s.message}</p> : <MembershipBody data={s.data} phone={phone} />}
        </div>
      )}
    </AdminShell>
  );
}
