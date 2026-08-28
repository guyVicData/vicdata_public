"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import RollTrendChart from "./RollTrendChart";
import type { RollSnapshot } from "@/lib/roll-data";
import type { MarketShareEstimate } from "@/lib/market-share";
import { Card, Eyebrow, Caption } from "./dashboard/Card";

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
    // "Locked" treatment (design reference) -- a blurred placeholder + lock icon,
    // not just plain text, so the grid visibly shows "there's real content here,
    // sign in to see it" rather than reading as an empty stub.
    return (
      <Card size="small" className="relative overflow-hidden">
        <Eyebrow>Roll history &amp; market share</Eyebrow>
        <div
          className="my-2 h-14 rounded-md opacity-50 blur-[5px]"
          style={{
            background:
              "repeating-linear-gradient(100deg, #cfc8b7 0 3px, transparent 3px 14px)",
          }}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="text-stone-500 dark:text-stone-400">
            <rect x="5" y="11" width="14" height="9" rx="1.5" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <Caption>Available to verified school staff</Caption>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card size="medium">
      <Eyebrow>Roll history &amp; market share</Eyebrow>
      <RollTrendChart trend={data.trend} />
      <div className="mt-4 space-y-1">
        <MarketShareLine label="Year 7" ms={data.marketShareY7} />
        <MarketShareLine label="6th Form" ms={data.marketShareSixthForm} />
      </div>
    </Card>
  );
}
