"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type Candidate = {
  urn: string;
  current_name: string;
  town: string | null;
  la_name: string | null;
  establishment_type_group: string | null;
  number_of_pupils: number | null;
  boarding_establishment: string | null;
  distance_metres?: number;
};

type Mode = "attributes" | "local_rivals";

function ComparatorSetBuilder() {
  const params = useSearchParams();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const schoolAccountId = params.get("school_account_id")!;
  const anchorUrn = params.get("anchor_urn")!;

  const [mode, setMode] = useState<Mode>("attributes");
  const [sector, setSector] = useState<string>("");
  const [boarding, setBoarding] = useState<string>("");
  const [sizeBand, setSizeBand] = useState<string>("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [personalSetCount, setPersonalSetCount] = useState<number | null>(null);
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      if (myMembership) {
        setMembershipId(myMembership.id);
        const { count } = await supabase
          .from("saved_sets")
          .select("id", { count: "exact", head: true })
          .eq("owner_membership_id", myMembership.id)
          .eq("set_type", "comparator");
        setPersonalSetCount(count ?? 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolAccountId]);

  async function search() {
    if (mode === "local_rivals") {
      // "Local rivals" (rolls spec §6): geography as the PRIMARY filter, the same
      // adaptive target-count-per-sector mechanism Feeder Set uses (deliberately
      // reused, not a second implementation) -- attribute filters apply as
      // secondary narrowing on top of the geography-primary result, not the other
      // way round.
      const { data, error } = await supabase.rpc("feeder_candidates", {
        p_receiving_urn: anchorUrn,
        p_target_count_per_sector: 15,
      });
      if (!error && data) {
        let rows = data as Candidate[];
        if (sector) {
          rows = rows.filter((r) =>
            sector === "independent"
              ? r.establishment_type_group === "Independent schools"
              : r.establishment_type_group !== "Independent schools",
          );
        }
        if (boarding) {
          rows = rows.filter((r) =>
            boarding === "boarding"
              ? r.boarding_establishment === "Has boarders"
              : r.boarding_establishment !== "Has boarders",
          );
        }
        if (sizeBand) {
          rows = rows.filter((r) => {
            const n = r.number_of_pupils ?? 0;
            if (sizeBand === "small") return n < 300;
            if (sizeBand === "medium") return n >= 300 && n <= 800;
            return n > 800;
          });
        }
        setCandidates(rows);
      }
      return;
    }

    const { data, error } = await supabase.rpc("comparator_candidates", {
      p_school_urn: anchorUrn,
      p_sector: sector || null,
      p_boarding: boarding || null,
      p_size_band: sizeBand || null,
      p_limit: 30,
    });
    if (!error && data) setCandidates(data as Candidate[]);
  }

  function toggle(urn: string) {
    setSelected((prev) => {
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
        set_type: "comparator",
        name: name || "Comparator set",
        owner_membership_id: membershipId,
      })
      .select("id")
      .single();

    if (insertError || !set) {
      setError(insertError?.message ?? "Could not save set.");
      setSaving(false);
      return;
    }

    if (selected.size > 0) {
      await supabase.from("saved_set_members").insert(
        Array.from(selected).map((urn) => ({
          saved_set_id: set.id,
          school_urn: urn,
          member_status: "confirmed",
        })),
      );
    }

    setSaving(false);
    setSaved(true);
  }

  if (saved) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-lg font-medium">Comparator set saved.</p>
        <button type="button" className="mt-4 text-sm underline" onClick={() => router.push("/sets")}>
          Back to sets
        </button>
      </main>
    );
  }

  const atCap = personalSetCount !== null && personalSetCount >= 3;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-xl font-semibold">Build a Comparator Set</h1>
      {personalSetCount !== null && (
        <p className="mb-4 text-sm text-neutral-500">
          {personalSetCount} / 3 personal sets used.
        </p>
      )}
      {atCap && (
        <p className="mb-4 rounded-md border border-neutral-300 p-3 text-sm dark:border-neutral-700">
          You&rsquo;ve reached your personal cap of 3 sets. Delete one from your account
          page, or save this as a shared set instead (not built in this view yet).
        </p>
      )}

      <div className="mb-3 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("attributes")}
          className={`rounded-md border px-3 py-1 ${mode === "attributes" ? "border-neutral-900 dark:border-white" : "border-neutral-300 dark:border-neutral-700"}`}
        >
          By attributes
        </button>
        <button
          type="button"
          onClick={() => setMode("local_rivals")}
          className={`rounded-md border px-3 py-1 ${mode === "local_rivals" ? "border-neutral-900 dark:border-white" : "border-neutral-300 dark:border-neutral-700"}`}
        >
          Local rivals
        </button>
      </div>
      {mode === "local_rivals" && (
        <p className="mb-3 text-xs text-neutral-500">
          Geography is the primary filter here — nearest schools per sector, same
          mechanism Feeder Set uses. Attribute filters below narrow within that.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">Any sector</option>
          <option value="independent">Independent</option>
          <option value="state">State</option>
        </select>
        <select
          value={boarding}
          onChange={(e) => setBoarding(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">Any boarding status</option>
          <option value="boarding">Boarding</option>
          <option value="day">Day</option>
        </select>
        <select
          value={sizeBand}
          onChange={(e) => setSizeBand(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">Any size</option>
          <option value="small">Small (&lt;300)</option>
          <option value="medium">Medium (300-800)</option>
          <option value="large">Large (800+)</option>
        </select>
        <button
          type="button"
          onClick={search}
          className="rounded-md bg-neutral-900 px-3 py-1 text-sm text-white dark:bg-white dark:text-neutral-900"
        >
          Search
        </button>
      </div>

      <ul className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
        {candidates.map((c) => (
          <li key={c.urn} className="flex items-center justify-between py-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(c.urn)}
                onChange={() => toggle(c.urn)}
              />
              <span>
                {c.current_name} — {c.town}, {c.number_of_pupils ?? "?"} pupils
                {mode === "local_rivals" && c.distance_metres !== undefined
                  ? ` (${Math.round(c.distance_metres / 1000)}km)`
                  : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {candidates.length > 0 && !atCap && (
        <div className="mt-6 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Set name"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={saving || selected.size === 0}
            onClick={save}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {saving ? "Saving…" : `Save set (${selected.size} schools)`}
          </button>
        </div>
      )}
    </main>
  );
}

export default function ComparatorSetPage() {
  return (
    <Suspense>
      <ComparatorSetBuilder />
    </Suspense>
  );
}
