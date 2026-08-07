"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import RollTrendChart from "./RollTrendChart";
import type { RollSnapshot } from "@/lib/roll-data";
import type { MarketShareEstimate } from "@/lib/market-share";

type PaidTrendsResponse = {
  trend: RollSnapshot[];
  marketShareY7: MarketShareEstimate;
  marketShareSixthForm: MarketShareEstimate;
};

function MarketShareLine({ label, ms }: { label: string; ms: MarketShareEstimate }) {
  if (ms.shareLow === null || ms.shareHigh === null) {
    return (
      <p className="text-sm text-neutral-500">
        {label}: not enough data to estimate market share.
      </p>
    );
  }
  // A negative range means net attrition at this entry point, not external
  // recruitment -- a raw "-0.8% to 0.4%" reads as a broken percentage to a viewer,
  // so this is framed in words rather than shown as a bare negative figure.
  if (ms.shareLow < 0) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {label}: not a meaningful external-recruitment point for this school — more
        pupils leave than join at this stage, based on recent years&rsquo; data.
      </p>
    );
  }
  return (
    <p className="text-sm text-neutral-600 dark:text-neutral-400">
      {label}: an estimated {ms.shareLow.toFixed(1)}–{ms.shareHigh.toFixed(1)}% of{" "}
      {ms.laName ?? "the local"} births
      {ms.birthYear ? ` (born ~${ms.birthYear})` : ""} — an estimate from public data,
      not a published figure.
    </p>
  );
}

export default function PaidTrendsSection({ urn }: { urn: string }) {
  const supabase = createBrowserSupabaseClient();
  const [state, setState] = useState<"loading" | "unauthorized" | "loaded">("loading");
  const [data, setData] = useState<PaidTrendsResponse | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setState("unauthorized");
        return;
      }
      const res = await fetch(`/api/paid-trends?urn=${urn}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setState("unauthorized");
        return;
      }
      setData(await res.json());
      setState("loaded");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn]);

  if (state === "loading") return null;

  if (state === "unauthorized") {
    return (
      <section className="mb-10 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Roll history &amp; market share
        </h2>
        <p className="text-sm text-neutral-500">
          Detailed roll history is available to verified school staff.
        </p>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Roll history &amp; market share
      </h2>
      <RollTrendChart trend={data.trend} />
      <div className="mt-4 space-y-1">
        <MarketShareLine label="Year 7" ms={data.marketShareY7} />
        <MarketShareLine label="6th Form" ms={data.marketShareSixthForm} />
      </div>
    </section>
  );
}
