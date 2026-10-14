"use client";

// VicData 0.8 groups r1 (G5): the Platform page's "Group accounts". Platform admins create a group
// account by searching production's groups (by name or id: type, source, school count), invite the first
// head-office admin by email (taken up when that person signs in with that address; no email is sent),
// see each account's members and grants, suspend or reactivate it, and View as its head office
// (read-only, never in the usage log). Every power is a SECURITY DEFINER function that re-checks
// platform admin and writes the audit log.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { GROUP_NOTES, GROUP_SOURCE_LABELS } from "@/catalogue/notes";
import { InviteLink, inviteLink } from "@/components/groups/InviteLink";
import { startViewAsGroup } from "@/lib/groups/view-as-group";
import { SearchBox, Switch } from "./AdminChrome";

type Account = { id: string; group_id: string; display_name: string; status: "active" | "suspended"; created_at: string; admins: number; members: number; open_invitations: number; open_grants: number };
type Hit = { groupId: string; name: string; type: string; source: string; schools: number; likely: number };

const EBTN = "inline-flex items-center rounded-lg border border-[var(--edge-strong)] bg-[var(--panel-bg)] px-3 py-[7px] text-[12px] font-semibold text-[var(--chip-fg)] hover:border-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50";
const HEADING = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted3)]";
const TH = `${HEADING} whitespace-nowrap border-b border-[var(--panel-border)] px-2.5 py-2 text-left`;
const TD = "border-b border-[var(--border)] p-2.5 text-[13px]";
const TYPE: Record<string, string> = { mat: "MAT", sat: "Single-academy trust", secure_sat: "Secure SAT", federation: "Federation", sponsor: "Sponsor", umbrella_trust: "Umbrella trust", foundation_trust: "Foundation trust", independent_company: "Independent (company)", independent_charity: "Independent (charity)", independent_other: "Independent" };
const MIGRATION = "Group accounts need the database update (20261110090000_v08_groups_r1_accounts).";

async function token(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export function GroupAccountsSection() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [invite, setInvite] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("platform_group_accounts_overview");
    if (e) {
      setMissing(/does not exist|schema cache|could not find/i.test(e.message));
      setAccounts([]);
      return;
    }
    setAccounts((data as Account[] | null) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let live = true;
    const t = window.setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/platform/groups?q=${encodeURIComponent(term)}`, { headers: { Authorization: `Bearer ${(await token()) ?? ""}` } }).catch(() => null);
      if (!live) return;
      setHits(res?.ok ? ((await res.json()) as { groups: Hit[] }).groups : []);
      setSearching(false);
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [q]);

  async function act(fn: () => Promise<{ error?: string | null } | void>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    if (r && r.error) setError(r.error);
    await load();
    setBusy(false);
  }
  const create = (h: Hit) =>
    act(async () => {
      const res = await fetch("/api/platform/groups", { method: "POST", headers: { Authorization: `Bearer ${(await token()) ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ groupId: h.groupId }) }).catch(() => null);
      if (!res || !res.ok) return { error: ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not create the account." };
      setQ("");
      setHits(null);
    });
  const sendInvite = (a: Account) =>
    act(async () => {
      const email = invite[a.id] ?? "";
      const { data, error: e } = await supabase.rpc("group_invite_member", { p_account: a.id, p_email: email, p_role: "head_office_admin" });
      if (!e) {
        setInvite((x) => ({ ...x, [a.id]: "" }));
        if (typeof data === "string") setLink({ email, url: inviteLink(data) });
      }
      return { error: e?.message ?? null };
    });
  const setStatus = (a: Account, active: boolean) =>
    act(async () => {
      const { error: e } = await supabase.rpc("platform_set_group_account_status", { p_account: a.id, p_status: active ? "active" : "suspended" });
      return { error: e?.message ?? null };
    });
  async function viewAs(a: Account) {
    setError(null);
    const { error: e } = await supabase.rpc("log_platform_action", { p_action: "view_as_group", p_school_urn: null, p_detail: { group_account_id: a.id, group_id: a.group_id } });
    if (e) return setError(`Could not start View as: ${e.message}`);
    startViewAsGroup({ accountId: a.id, name: a.display_name });
    router.push("/teacher/group");
  }
  const existing = new Set((accounts ?? []).map((a) => a.group_id));

  return (
    <section className="flex flex-col gap-3" aria-label="Group accounts">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[16px] font-bold">Group accounts</h2>
        <span className="flex-grow" />
        <SearchBox value={q} onChange={(v) => { setQ(v); if (v.trim().length < 2) setHits(null); }} placeholder="Find a group by name or id" className="w-[282px] max-w-full rounded-lg px-2.5 py-[7px]" />
      </div>
      {missing && <p className="text-[12px] text-[var(--muted2)]">{MIGRATION}</p>}
      {error && <p role="alert" className="text-[12px] text-[var(--muted2)]">{error}</p>}
      {link && <InviteLink email={link.email} url={link.url} />}

      {q.trim().length >= 2 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]" data-group-search="">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Group</th>
                <th className={TH}>Type</th>
                <th className={TH}>Source</th>
                <th className={TH}>Schools</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {(searching || hits === null) && <tr><td colSpan={5} className={`${TD} text-[var(--muted2)]`}>Searching…</td></tr>}
              {!searching && hits?.length === 0 && <tr><td colSpan={5} className={`${TD} text-[var(--muted2)]`}>No group matches that search.</td></tr>}
              {!searching && hits?.map((h) => (
                <tr key={h.groupId}>
                  <td className={`${TD} font-bold`}>{h.name} <span className="font-normal text-[var(--muted2)]">{h.groupId}</span></td>
                  <td className={TD}>{TYPE[h.type] ?? h.type}</td>
                  <td className={TD}>{GROUP_SOURCE_LABELS[h.source] ?? h.source}</td>
                  <td className={`${TD} tabular-nums`}>{h.schools}{h.likely ? ` (${h.likely} likely)` : ""}</td>
                  <td className={`${TD} text-right`}>
                    {existing.has(h.groupId) ? <span className="text-[12px] text-[var(--muted2)]">Has an account</span> : <button type="button" className={EBTN} disabled={busy || missing} onClick={() => create(h)}>Create account</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>Group</th>
              <th className={TH}>Head office</th>
              <th className={TH}>Group view</th>
              <th className={TH}>Active</th>
              <th className={TH}>First admin</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {accounts === null && <tr><td colSpan={6} className={`${TD} text-[var(--muted2)]`}>Loading…</td></tr>}
            {accounts !== null && accounts.length === 0 && <tr><td colSpan={6} className={`${TD} text-[var(--muted2)]`}>No group accounts yet.</td></tr>}
            {accounts?.map((a) => (
              <tr key={a.id} data-group-account={a.group_id}>
                <td className={`${TD} font-bold`}>{a.display_name} <span className="font-normal text-[var(--muted2)]">{a.group_id}</span></td>
                <td className={`${TD} text-[var(--muted2)]`}>
                  {a.members} {a.members === 1 ? "member" : "members"} ({a.admins} admin{a.admins === 1 ? "" : "s"}){a.open_invitations ? ` · ${a.open_invitations} invited` : ""}
                </td>
                <td className={`${TD} tabular-nums`}>{a.open_grants} {a.open_grants === 1 ? "school" : "schools"}</td>
                <td className={TD}>
                  <Switch on={a.status === "active"} disabled={busy} label={`${a.display_name} active`} onChange={(on) => setStatus(a, on)} />
                </td>
                <td className={TD}>
                  {a.admins === 0 ? (
                    <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void sendInvite(a); }}>
                      <input type="email" required value={invite[a.id] ?? ""} onChange={(e) => setInvite((x) => ({ ...x, [a.id]: e.target.value }))} placeholder="admin@group.org" aria-label={`First head-office admin for ${a.display_name}`} className="w-[190px] rounded-lg border border-[var(--edge-strong)] bg-[var(--panel-bg)] px-2 py-[5px] text-[12px]" />
                      <button type="submit" className={EBTN} disabled={busy || a.status !== "active"}>Invite</button>
                    </form>
                  ) : (
                    <span className="text-[12px] text-[var(--muted2)]">set</span>
                  )}
                </td>
                <td className={`${TD} text-right`}>
                  <button type="button" className={EBTN} onClick={() => viewAs(a)}>View as head office</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] leading-[1.45] text-[var(--muted2)]">{GROUP_NOTES.inviteHow} View as opens the head-office home and Access page read-only, and is never counted in the usage log.</p>
    </section>
  );
}
