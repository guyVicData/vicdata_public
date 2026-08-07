"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";

const ROLE_LABELS: Record<string, string> = {
  head_governor: "Head / Governor",
  admissions: "Admissions",
  finance: "Finance",
  director_of_studies: "Director of Studies",
  head_of_department: "Head of Department",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending_verification: "Pending verification",
  pending_approval: "Pending approval",
  rejected: "Rejected",
};

type Membership = {
  id: string;
  status: string;
  role: string | null;
  is_admin: boolean;
  individual_tier_active: boolean;
  school_account_id: string;
  school_accounts: {
    id: string;
    school_urn: string;
    tier: string;
    account_holder_membership_id: string | null;
    pending_account_holder_membership_id: string | null;
    schools: { current_name: string } | null;
  };
};

type Colleague = {
  id: string;
  status: string;
  role: string | null;
  is_admin: boolean;
  profiles: { email: string; full_name: string | null } | null;
};

export default function AccountPage() {
  const supabase = createBrowserSupabaseClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("school_memberships")
      .select(
        "id, status, role, is_admin, individual_tier_active, school_account_id, school_accounts(id, school_urn, tier, account_holder_membership_id, pending_account_holder_membership_id, schools(current_name))",
      )
      .eq("profile_id", uid);
    setMemberships((data as unknown as Membership[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <main className="px-6 py-24 text-center text-sm text-neutral-500">Loading…</main>;

  if (!userId) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-sm text-neutral-500">
          You&rsquo;re not logged in.{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          or{" "}
          <Link href="/join" className="underline">
            join your school
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-xl font-semibold">Your account</h1>
      {memberships.length === 0 && (
        <p className="text-sm text-neutral-500">
          No memberships yet.{" "}
          <Link href="/join" className="underline">
            Join your school
          </Link>
          .
        </p>
      )}
      {memberships.map((m) => (
        <MembershipCard key={m.id} membership={m} userId={userId} onChange={load} />
      ))}
    </main>
  );
}

function MembershipCard({
  membership,
  userId,
  onChange,
}: {
  membership: Membership;
  userId: string;
  onChange: () => void;
}) {
  const supabase = createBrowserSupabaseClient();
  const account = membership.school_accounts;
  const isAccountHolder = account.account_holder_membership_id === membership.id;
  const isPendingRecipient = account.pending_account_holder_membership_id === membership.id;
  const canManage = membership.is_admin || isAccountHolder;

  async function acceptHandoff() {
    await supabase.rpc("accept_account_holder_handoff", { p_school_account_id: account.id });
    onChange();
  }

  return (
    <section className="mb-8 rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{account.schools?.current_name ?? account.school_urn}</h2>
        <span className="text-xs text-neutral-500">{STATUS_LABELS[membership.status]}</span>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {membership.role ? ROLE_LABELS[membership.role] : "No role set"}
        {membership.is_admin && " · Admin"}
        {isAccountHolder && " · Account holder"}
      </p>

      {isPendingRecipient && (
        <div className="mt-3 rounded-md border border-neutral-300 p-3 text-sm dark:border-neutral-700">
          You&rsquo;ve been nominated as the new account holder.{" "}
          <button type="button" className="underline" onClick={acceptHandoff}>
            Accept
          </button>
        </div>
      )}

      {canManage && (
        <ManagementPanel
          schoolAccountId={account.id}
          tier={account.tier}
          isAccountHolder={isAccountHolder}
          currentMembershipId={membership.id}
          userId={userId}
          onChange={onChange}
        />
      )}
    </section>
  );
}

function ManagementPanel({
  schoolAccountId,
  tier,
  isAccountHolder,
  currentMembershipId,
  onChange,
}: {
  schoolAccountId: string;
  tier: string;
  isAccountHolder: boolean;
  currentMembershipId: string;
  userId: string;
  onChange: () => void;
}) {
  const supabase = createBrowserSupabaseClient();
  const [colleagues, setColleagues] = useState<Colleague[]>([]);

  const loadColleagues = useCallback(async () => {
    const { data } = await supabase
      .from("school_memberships")
      .select("id, status, role, is_admin, profiles(email, full_name)")
      .eq("school_account_id", schoolAccountId);
    setColleagues((data as unknown as Colleague[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolAccountId]);

  useEffect(() => {
    loadColleagues();
  }, [loadColleagues]);

  async function approve(membershipId: string) {
    await supabase
      .from("school_memberships")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: currentMembershipId })
      .eq("id", membershipId);
    loadColleagues();
  }

  async function remove(membershipId: string) {
    await supabase.from("school_memberships").delete().eq("id", membershipId);
    loadColleagues();
  }

  async function toggleAdmin(membershipId: string, next: boolean) {
    await supabase.from("school_memberships").update({ is_admin: next }).eq("id", membershipId);
    loadColleagues();
  }

  async function setTier(next: string) {
    await supabase.from("school_accounts").update({ tier: next }).eq("id", schoolAccountId);
    onChange();
  }

  async function initiateHandoff(recipientMembershipId: string) {
    await supabase.rpc("initiate_account_holder_handoff", {
      p_school_account_id: schoolAccountId,
      p_recipient_membership_id: recipientMembershipId,
    });
    onChange();
  }

  return (
    <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Members
      </h3>
      <ul className="space-y-2">
        {colleagues.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span>
              {c.profiles?.full_name || c.profiles?.email || "Member"}
              {c.role && ` — ${ROLE_LABELS[c.role]}`}
              {c.status !== "approved" && (
                <span className="ml-2 text-xs text-neutral-500">({STATUS_LABELS[c.status]})</span>
              )}
              {c.is_admin && <span className="ml-2 text-xs text-neutral-500">Admin</span>}
            </span>
            <span className="flex gap-2">
              {c.status !== "approved" && (
                <button type="button" className="text-xs underline" onClick={() => approve(c.id)}>
                  Approve
                </button>
              )}
              {isAccountHolder && c.id !== currentMembershipId && (
                <>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => toggleAdmin(c.id, !c.is_admin)}
                  >
                    {c.is_admin ? "Remove admin" : "Make admin"}
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => initiateHandoff(c.id)}
                  >
                    Make account holder
                  </button>
                </>
              )}
              {c.id !== currentMembershipId && (
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() => remove(c.id)}
                >
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {isAccountHolder && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Tier:</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="individual">Individual</option>
            <option value="school">School-wide</option>
          </select>
          <span className="text-xs text-neutral-400">(directly settable — no Stripe yet)</span>
        </div>
      )}
    </div>
  );
}
