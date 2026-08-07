"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";

const ENTRY_POINTS = [
  { value: "y7", label: "Year 7" },
  { value: "sixth_form", label: "6th Form" },
];

type Candidate = {
  urn: string;
  current_name: string;
  town: string | null;
  establishment_type_group: string | null;
  distance_metres: number;
};

function FeederSetBuilder() {
  const params = useSearchParams();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const schoolAccountId = params.get("school_account_id")!;
  const receivingUrn = params.get("receiving_urn")!;

  const [entryPoint, setEntryPoint] = useState(ENTRY_POINTS[0].value);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [targetCountInfo, setTargetCountInfo] = useState<{
    targetCount: number;
    estimate: { rangeLow: number; rangeHigh: number; mostRecent: number | null };
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: myMembership } = await supabase
        .from("school_memberships")
        .select("id")
        .eq("school_account_id", schoolAccountId)
        .eq("profile_id", userData.user.id)
        .maybeSingle();
      setMembershipId(myMembership?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolAccountId]);

  async function search() {
    setSearching(true);
    // Target count scaled from the cohort-progression intake estimate (rolls spec §5
    // scaling §7's estimator) rather than a flat default -- see
    // docs/OPEN_QUESTIONS.md for the reasoning, including which part of this is a
    // real judgment call vs. a validated figure.
    let targetCount = 15;
    try {
      const res = await fetch(
        `/api/feeder-target-count?urn=${receivingUrn}&entryPoint=${entryPoint}`,
      );
      if (res.ok) {
        const body = await res.json();
        targetCount = body.targetCount;
        setTargetCountInfo({ targetCount: body.targetCount, estimate: body.estimate });
      }
    } catch {
      // Fall through to the flat default -- a failed estimate shouldn't block search.
    }

    const { data, error } = await supabase.rpc("feeder_candidates", {
      p_receiving_urn: receivingUrn,
      p_target_count_per_sector: targetCount,
    });
    setSearching(false);
    if (!error && data) {
      setCandidates(data as Candidate[]);
      setConfirmed(new Set());
    }
  }

  function toggle(urn: string) {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(urn)) next.delete(urn);
      else next.add(urn);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const { data: set, error: insertError } = await supabase
      .from("saved_sets")
      .insert({
        school_account_id: schoolAccountId,
        set_type: "feeder",
        name: `${ENTRY_POINTS.find((e) => e.value === entryPoint)?.label} feeders`,
        entry_point: entryPoint,
        owner_membership_id: membershipId,
      })
      .select("id")
      .single();

    if (insertError || !set) {
      setError(insertError?.message ?? "Could not save set.");
      setSaving(false);
      return;
    }

    const rows = candidates.map((c) => ({
      saved_set_id: set.id,
      school_urn: c.urn,
      member_status: confirmed.has(c.urn) ? "confirmed" : "excluded",
    }));
    if (rows.length > 0) await supabase.from("saved_set_members").insert(rows);

    setSaving(false);
    setSaved(true);
  }

  if (saved) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-lg font-medium">
          Feeder set saved — {confirmed.size} confirmed feeder{confirmed.size === 1 ? "" : "s"}.
        </p>
        <button type="button" className="mt-4 text-sm underline" onClick={() => router.push("/sets")}>
          Back to sets
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-xl font-semibold">Build a Feeder Set</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Confirm which nearby schools genuinely feed into you at this entry point.
      </p>

      <div className="flex gap-2">
        <select
          value={entryPoint}
          onChange={(e) => setEntryPoint(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {ENTRY_POINTS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="rounded-md bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {searching ? "Searching…" : "Find candidates"}
        </button>
      </div>

      {targetCountInfo && (
        <p className="mt-2 text-xs text-neutral-500">
          Searching for ~{targetCountInfo.targetCount} candidates per sector, based on
          an estimated intake of{" "}
          {targetCountInfo.estimate.mostRecent !== null
            ? `${targetCountInfo.estimate.rangeLow}–${targetCountInfo.estimate.rangeHigh} pupils/year (estimate, not a published figure)`
            : "no reliable estimate — using the default net"}
          .
        </p>
      )}

      <ul className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
        {candidates.map((c) => (
          <li key={c.urn} className="flex items-center justify-between py-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirmed.has(c.urn)} onChange={() => toggle(c.urn)} />
              <span>
                {c.current_name} — {c.town} ({Math.round(c.distance_metres / 1000)}km)
              </span>
            </label>
          </li>
        ))}
      </ul>

      {candidates.length > 0 && (
        <div className="mt-6 space-y-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {saving ? "Saving…" : `Confirm ${confirmed.size} feeder${confirmed.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </main>
  );
}

export default function FeederSetPage() {
  return (
    <Suspense>
      <FeederSetBuilder />
    </Suspense>
  );
}
