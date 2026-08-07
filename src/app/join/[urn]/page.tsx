"use client";

import { use, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

const ROLES = [
  { value: "head_governor", label: "Head / Governor" },
  { value: "admissions", label: "Admissions" },
  { value: "finance", label: "Finance" },
  { value: "director_of_studies", label: "Director of Studies" },
  { value: "head_of_department", label: "Head of Department" },
];

type JoinResult = {
  branch: "first_member" | "request_to_join";
  membership_status: "approved" | "pending_verification" | "pending_approval";
  upsell: boolean;
};

export default function JoinSchoolPage({
  params,
}: {
  params: Promise<{ urn: string }>;
}) {
  const { urn } = use(params);
  const supabase = createBrowserSupabaseClient();

  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [hasApprovedMember, setHasApprovedMember] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(ROLES[0].value);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: school }, { data: hasMember }] = await Promise.all([
        supabase.from("schools").select("current_name").eq("urn", urn).maybeSingle(),
        supabase.rpc("check_school_has_member", { p_urn: urn }),
      ]);
      if (cancelled) return;
      setSchoolName(school?.current_name ?? null);
      setHasApprovedMember(Boolean(hasMember));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError || !signUpData.user) {
      setErrorMsg(signUpError?.message ?? "Sign up failed.");
      setSubmitting(false);
      return;
    }

    if (fullName) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", signUpData.user.id);
    }

    const { data: joinData, error: joinError } = await supabase.rpc("join_school", {
      p_urn: urn,
      p_role: role,
    });
    setSubmitting(false);

    if (joinError || !joinData || joinData.length === 0) {
      setErrorMsg(joinError?.message ?? "Joining failed.");
      return;
    }

    setResult(joinData[0] as JoinResult);
  }

  if (result) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24">
        <ResultMessage result={result} schoolName={schoolName} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-semibold">
        Join {schoolName ?? "your school"}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        {hasApprovedMember === null
          ? " "
          : hasApprovedMember
            ? "Someone from this school has already joined — your request will go to them for approval."
            : "No one from this school has joined yet — you'll be the first member."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "Joining…" : "Join"}
        </button>
      </form>
    </main>
  );
}

function ResultMessage({
  result,
  schoolName,
}: {
  result: JoinResult;
  schoolName: string | null;
}) {
  const messages: Record<JoinResult["membership_status"], { title: string; body: string }> = {
    approved: {
      title: `You're verified and set as ${schoolName ?? "your school"}'s account holder`,
      body: "Your work email matched the school's official website domain, so you're verified immediately.",
    },
    pending_verification: {
      title: "You're the first member — pending verification",
      body: "We couldn't automatically match your email to the school's records. We'll follow up to verify your affiliation.",
    },
    pending_approval: {
      title: "Request sent",
      body: `Someone at ${schoolName ?? "this school"} is already the account holder — your request has been sent to them for approval.`,
    },
  };

  const msg = messages[result.membership_status];

  return (
    <div>
      <h1 className="text-xl font-semibold">{msg.title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{msg.body}</p>

      {result.upsell && (
        <div className="mt-6 rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          This school now has two individual members. Two individual subscriptions
          (~£4-6/mo each) already meet or exceed the £10/month school-wide plan, which
          covers unlimited roles — worth considering switching. This is just informal
          information, not a requirement — you can carry on as individuals if that suits
          you better.
        </div>
      )}
    </div>
  );
}
