"use client";

// VicData 0.8 groups r1 (G4): the Access page (docs/wireframes/groups/Access.dc.html), at
// /teacher/group/access. Which member schools' SMT get the group dashboards: a switch per current member
// with its own VicData membership, "Give all schools access" and "Remove all" (each confirmed), likely
// members labelled, and schools that left the group as read-only history. Head office's own members at
// the foot. The head-office admin changes it; a platform admin in View as reads it; plain head office
// sees only the home's count ("not found" here). Every change goes through /api/group/access, which
// checks membership in production before the service role writes.
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { TeacherNav, useNavLabels } from "@/components/teacher/TeacherNav";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { TeacherModal } from "@/components/shell/TeacherModal";
import { GROUP_NOTES, groupNote } from "@/catalogue/notes";
import { shortDate } from "@/lib/meeting-ops";
import type { AccessRow, HeadOffice, LeftRow } from "@/lib/groups/access-rules";
import { groupVars } from "./ui";
import { GroupViewAsBanner } from "./GroupViewAsBanner";
import { useGroupOffices } from "./useGroupOffices";

type AccessData = {
  office: HeadOffice;
  viewAs: boolean;
  canManage: boolean;
  total: number;
  current: AccessRow[];
  likely: AccessRow[];
  left: LeftRow[];
  headOffice: { id: string; name: string; email: string | null; role: string; self: boolean }[];
  invitations: { id: string; email: string; role: string; invited_at: string }[];
};

const BTN = "rounded-[8px] border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-[7px] text-[12px] font-bold text-[var(--fg)] hover:border-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--panel-border2)]";
const TH = "bg-[var(--panel-bg2,var(--box-bg))] px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted2)]";
const TD = "flex items-center border-t border-[var(--panel-border)] px-3 py-2.5 text-[12.5px] text-[var(--fg)]";
const GRID = "grid grid-cols-[2.4fr_1fr_1fr_1.3fr_1.3fr]";
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative inline-block h-5 w-[34px] shrink-0 rounded-full border-0 p-0 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: on ? "var(--group-switch-on)" : "var(--switch-off, #3f3f46)" }}
    >
      <span className="absolute top-[2px] h-4 w-4 rounded-full" style={{ left: on ? 16 : 2, background: on ? "var(--group-switch-knob-on)" : "#e5e5e5" }} />
    </button>
  );
}

const Likely = () => (
  <span title={GROUP_NOTES.likelyWhy} className="rounded-[6px] bg-[var(--group-likely-bg)] px-[7px] py-px text-[10.5px] font-bold text-[var(--group-likely-fg)]">
    {GROUP_NOTES.likely}
  </span>
);

function Rows({ rows, busy, can, onSwitch }: { rows: AccessRow[]; busy: string | null; can: boolean; onSwitch: (r: AccessRow, on: boolean) => void }) {
  return (
    <>
      {rows.map((r) => (
        <div key={r.urn} className="contents" data-access-row={r.urn}>
          <div className={`${TD} gap-[6px] font-semibold`}>
            <span className="min-w-0 truncate">{r.name}</span>
            {r.likely && <Likely />}
          </div>
          <div className={`${TD} ${r.member ? "tabular-nums" : "text-[var(--muted2)]"}`}>{r.member ? r.smtMembers : GROUP_NOTES.notMember}</div>
          <div className={TD}>{r.member ? <Switch on={r.on} label={`Group view for ${r.name}`} disabled={!can || busy !== null} onChange={(on) => onSwitch(r, on)} /> : <span className="text-[var(--muted2)]">&mdash;</span>}</div>
          <div className={`${TD} text-[var(--muted2)]`}>{r.on ? date(r.since) : "—"}</div>
          <div className={`${TD} ${r.member && r.opened !== "—" ? "" : "text-[var(--muted2)]"}`}>{r.member ? r.opened : GROUP_NOTES.invite}</div>
        </div>
      ))}
    </>
  );
}

/** The phone's rows: name and switch, then the figures in a line. */
function PhoneRows({ rows, busy, can, onSwitch }: { rows: AccessRow[]; busy: string | null; can: boolean; onSwitch: (r: AccessRow, on: boolean) => void }) {
  return (
    <>
      {rows.map((r) => (
        <div key={r.urn} className="border-t border-[var(--panel-border)] px-3 py-2.5 first:border-0" data-access-row={r.urn}>
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="min-w-0 flex-grow">{r.name}</span>
            {r.likely && <Likely />}
            {r.member && <Switch on={r.on} label={`Group view for ${r.name}`} disabled={!can || busy !== null} onChange={(on) => onSwitch(r, on)} />}
          </div>
          <div className="mt-1 text-[11.5px] text-[var(--muted2)]">
            {r.member ? `SMT members ${r.smtMembers} · ${r.on ? `since ${date(r.since)}` : "no group view"} · ${r.opened === "—" ? "not opened" : r.opened}` : `${GROUP_NOTES.notMember} · ${GROUP_NOTES.invite}`}
          </div>
        </div>
      ))}
    </>
  );
}

function Table({ rows, busy, can, onSwitch }: { rows: AccessRow[]; busy: string | null; can: boolean; onSwitch: (r: AccessRow, on: boolean) => void }) {
  return (
    <>
      <div className={`hidden overflow-hidden rounded-[10px] border border-[var(--panel-border)] sm:grid ${GRID}`}>
        <div className={TH}>School</div>
        <div className={TH}>SMT members</div>
        <div className={TH}>Group view</div>
        <div className={TH}>Since</div>
        <div className={TH}>Opened, last 30 days</div>
        <Rows rows={rows} busy={busy} can={can} onSwitch={onSwitch} />
      </div>
      <div className="overflow-hidden rounded-[10px] border border-[var(--panel-border)] sm:hidden">
        <PhoneRows rows={rows} busy={busy} can={can} onSwitch={onSwitch} />
      </div>
    </>
  );
}

const SectionHead = ({ children, note }: { children: ReactNode; note?: string }) => (
  <div className="mt-2">
    <div className="text-[13px] font-bold">{children}</div>
    {note && <div className="mt-0.5 text-[11.5px] text-[var(--muted2)]">{note}</div>}
  </div>
);

export function GroupAccess() {
  const [theme, setTheme] = useTeacherTheme();
  const [labelsOn, setLabelsOn] = useNavLabels(null, []);
  const offices = useGroupOffices();
  const [data, setData] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: AccessData }>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"give" | "remove" | null>(null);
  const office = offices.status === "ready" ? offices.office : null;
  const token = offices.status === "ready" ? offices.token : null;

  const load = useCallback(async () => {
    if (!office || !token) return;
    const res = await fetch(`/api/group/access?account=${office.id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res || !res.ok) setData({ status: "error", message: res?.status === 404 ? "Not found." : "Could not load access. Try again." });
    else setData({ status: "ready", data: (await res.json()) as AccessData });
  }, [office, token]);
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function change(body: { urn?: string; all?: true; on: boolean }, key: string) {
    if (!office || !token) return;
    setBusy(key);
    setError(null);
    const res = await fetch("/api/group/access", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ account: office.id, ...body }) }).catch(() => null);
    if (!res || !res.ok) setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not change access. Try again.");
    await load();
    setBusy(null);
  }

  const d = data.status === "ready" ? data.data : null;
  const can = !!d?.canManage;
  const onSwitch = (r: AccessRow, on: boolean) => change({ urn: r.urn, on }, r.urn);
  const giveable = d ? d.current.filter((r) => r.member).length : 0;
  const seeing = d ? [...d.current, ...d.likely].filter((r) => r.on).length : 0;

  return (
    <main id="teacher-root" data-theme={theme} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={groupVars(theme)}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-[14px] px-4 py-4 sm:px-[26px] sm:py-[22px]">
        <GroupViewAsBanner className="" />
        <TeacherNav phase={null} phases={[]} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={setTheme} />
        {offices.status === "loading" || (office && data.status === "loading") ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : !office || data.status === "error" ? (
          <p className="text-[13px] text-[var(--muted2)]">{data.status === "error" ? data.message : "Not found."}</p>
        ) : (
          d && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-[20px] font-bold">{GROUP_NOTES.accessTitle}</h1>
                  <div className="mt-[3px] text-[13px] text-[var(--muted2)]">
                    {d.office.name} &middot; {GROUP_NOTES.accessLead}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={BTN} disabled={!can || busy !== null || giveable === 0} onClick={() => setConfirm("give")}>
                    Give all schools access
                  </button>
                  <button type="button" className={BTN} disabled={!can || busy !== null || seeing === 0} onClick={() => setConfirm("remove")}>
                    Remove all
                  </button>
                </div>
              </div>

              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-2.5 text-[12px] leading-[1.45] text-[var(--chip-fg)]">
                {(() => {
                  const [a, rest] = GROUP_NOTES.comparisonSet.split("{set}");
                  const [b, c] = rest.split("{dashboards}");
                  return (
                    <>
                      {a}
                      <b className="text-[var(--group-strong)]">{groupNote("allSchools", { group: d.office.name.replace(/ (Education|Federation|Trust|Group)$/i, (m) => (/Federation|Trust/i.test(m) ? m : "")) })}</b>
                      {b}
                      <b className="text-[var(--group-strong)]">{GROUP_NOTES.groupDashboards}</b>
                      {c}
                    </>
                  );
                })()}
              </div>

              {error && <p role="alert" className="text-[12px] text-[var(--muted2)]">{error}</p>}
              {d.viewAs && <p className="text-[12px] text-[var(--muted2)]">View as: read-only. Nothing here can be changed, and nothing is logged.</p>}

              <Table rows={d.current} busy={busy} can={can} onSwitch={onSwitch} />

              {d.likely.length > 0 && (
                <>
                  <SectionHead note={GROUP_NOTES.likelyWhy}>Likely members</SectionHead>
                  <Table rows={d.likely} busy={busy} can={can} onSwitch={onSwitch} />
                </>
              )}

              {d.left.length > 0 && (
                <>
                  <SectionHead note={groupNote("leftWhy", { source: "the group's source" })}>{GROUP_NOTES.left}</SectionHead>
                  <div className="overflow-hidden rounded-[10px] border border-[var(--panel-border)]">
                    {d.left.map((r) => (
                      <div key={r.urn} className="flex flex-wrap gap-x-4 border-t border-[var(--panel-border)] px-3 py-2.5 text-[12.5px] first:border-0" data-left-row={r.urn}>
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-[var(--muted2)]">
                          group view from {date(r.grantedAt)}
                          {r.revokedAt ? `, removed ${date(r.revokedAt)}` : ", ended when the school left"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="text-[11.5px] leading-[1.5] text-[var(--muted2)]">
                Showing {d.current.length + d.likely.length} of {d.total}. {GROUP_NOTES.membership} {GROUP_NOTES.usage}
              </div>

              <HeadOfficeMembers d={d} can={can} reload={load} />
              <Link href="/teacher/group" className="self-start text-[12px] font-bold text-[var(--group-accent-text)]">
                &larr; The group&rsquo;s home
              </Link>
            </>
          )
        )}
      </div>
      {confirm && d && (
        <TeacherModal label={confirm === "give" ? "Give all schools access" : "Remove all"} backdropLabel="Cancel" onClose={() => setConfirm(null)} size="compact">
          <div className="flex flex-col gap-4 p-5 text-[13px]">
            <p>{confirm === "give" ? groupNote("giveAllConfirm", { n: d.current.filter((r) => r.member).length }) : groupNote("removeAllConfirm", { n: seeing })}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${BTN} border-[var(--group-switch-on)]`}
                onClick={() => {
                  const on = confirm === "give";
                  setConfirm(null);
                  void change({ all: true, on }, "all");
                }}
              >
                {confirm === "give" ? "Give all schools access" : "Remove all"}
              </button>
            </div>
          </div>
        </TeacherModal>
      )}
    </main>
  );
}

/** Head office's own people: the admin invites by email (taken up when that person signs in with that
 * address), changes a member's role and removes members; never their own. */
function HeadOfficeMembers({ d, can, reload }: { d: AccessData; can: boolean; reload: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"head_office" | "head_office_admin">("head_office");
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: string, args: Record<string, unknown>) => {
    setError(null);
    const { error: e } = await createBrowserSupabaseClient().rpc(fn, args);
    if (e) setError(e.message);
    await reload();
  };
  const roleWord = (r: string) => (r === "head_office_admin" ? "Head-office admin" : "Head office");
  return (
    <section className="mt-2 flex flex-col gap-2 rounded-[10px] border border-[var(--panel-border)] p-3" aria-label="Head office">
      <div className="text-[13px] font-bold">Head office</div>
      <ul className="flex flex-col gap-1 text-[12.5px]">
        {d.headOffice.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{m.name}</span>
            {m.email && m.email !== m.name && <span className="text-[var(--muted2)]">{m.email}</span>}
            <span className="text-[var(--muted2)]">&middot; {roleWord(m.role)}</span>
            <span className="flex-grow" />
            {can && !m.self && (
              <>
                <button type="button" className="text-[12px] font-bold text-[var(--group-accent-text)]" onClick={() => run("group_set_member_role", { p_membership: m.id, p_role: m.role === "head_office_admin" ? "head_office" : "head_office_admin" })}>
                  {m.role === "head_office_admin" ? "Make head office" : "Make admin"}
                </button>
                <button type="button" className="text-[12px] font-bold text-[var(--muted2)] hover:text-[var(--fg)]" onClick={() => run("group_remove_member", { p_membership: m.id })}>
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
        {d.invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 text-[var(--muted2)]">
            <span>{i.email}</span>
            <span>&middot; {roleWord(i.role)}, invited {shortDate(i.invited_at.slice(0, 10))}</span>
            <span className="flex-grow" />
            {can && (
              <button type="button" className="text-[12px] font-bold hover:text-[var(--fg)]" onClick={() => run("group_cancel_invitation", { p_invitation: i.id })}>
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>
      {can && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) void run("group_invite_member", { p_account: d.office.id, p_email: email.trim(), p_role: role }).then(() => setEmail(""));
          }}
        >
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@group.org" aria-label="Email address to invite" className="w-[240px] max-w-full rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2.5 py-[6px] text-[12.5px]" />
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Role" className="rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 py-[6px] text-[12.5px]">
            <option value="head_office">Head office</option>
            <option value="head_office_admin">Head-office admin</option>
          </select>
          <button type="submit" className={BTN}>
            Invite
          </button>
          <span className="basis-full text-[11.5px] text-[var(--muted2)]">The invitation is taken up when that person signs in to VicData with this address. No email is sent.</span>
        </form>
      )}
      {error && <p role="alert" className="text-[12px] text-[var(--muted2)]">{error}</p>}
    </section>
  );
}
