"use client";

import { use, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import PeerTrendChart, { type PeerSchool } from "@/components/PeerTrendChart";

type PeersResponse = {
  setName: string;
  schools: PeerSchool[] & { currentRoll: number | null; urn: string }[];
};

export default function ComparatorSetViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createBrowserSupabaseClient();
  const [data, setData] = useState<
    (PeersResponse & { schools: (PeerSchool & { currentRoll: number | null })[] }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Log in to view this set.");
        return;
      }
      const res = await fetch(`/api/comparator-set-peers?setId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Could not load this set.");
        return;
      }
      setData(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <main className="mx-auto max-w-2xl px-6 py-24 text-sm text-neutral-500">{error}</main>;
  if (!data) return <main className="px-6 py-24 text-center text-sm text-neutral-500">Loading…</main>;

  // Roll-size ranks (rolls spec §6: Comparator Set consumer) -- self-directed, not a
  // public leaderboard: this ranking only exists within the member's own curated set.
  const ranked = [...data.schools]
    .filter((s) => s.currentRoll !== null)
    .sort((a, b) => (b.currentRoll ?? 0) - (a.currentRoll ?? 0));
  const anchor = data.schools.find((s) => s.isAnchor);
  const anchorRank = anchor ? ranked.findIndex((s) => s.urn === anchor.urn) + 1 : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-xl font-semibold">{data.setName}</h1>

      <section className="mb-10">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Roll-size rank
        </h2>
        {anchorRank && (
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            {anchor?.name} ranks <strong>{anchorRank}</strong> of {ranked.length} by current
            roll within this set.
          </p>
        )}
        <table className="w-full text-sm">
          <tbody>
            {ranked.map((s, i) => (
              <tr key={s.urn} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-1.5 text-neutral-500">{i + 1}</td>
                <td className="py-1.5">
                  {s.name}
                  {s.isAnchor && " (this school)"}
                </td>
                <td className="py-1.5 text-right font-medium">{s.currentRoll?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Peer group trend
        </h2>
        <PeerTrendChart schools={data.schools} />
      </section>
    </main>
  );
}
