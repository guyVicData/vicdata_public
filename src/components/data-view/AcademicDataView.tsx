"use client";

// Academic Results Data View tab (frontend build brief, Part B). Sibling to
// DataViewShell's own existing Rolls-specific Map/Graphs/Rankings tree, not a
// modification of it -- MapView/GraphsView/RankingsView/DataViewSchoolProfile are all
// written against Rolls' own fields end to end (confirmed directly before writing any
// of this), so this is a parallel set of view components consuming a new
// AcademicSchoolProfile shape instead, per the brief's own "flag anything more
// Rolls-specific than expected rather than silently forking it" instruction.
//
// Reuses from DataViewShell: the comparator-set SELECTION state (tickedUrns/addedUrns/
// activeSetLabel -- just URNs and a label, genuinely topic-agnostic) and the shared
// ViewSwitcher/PdfExportButton chrome. Does NOT reuse profilesByUrn/ComparatorSidebar's
// own "compared with" roll-figures panel -- those stay Rolls-shaped and keep showing
// roll numbers even while this tab is active (a deliberate, flagged scope decision --
// building an academic-equivalent sidebar panel duplicates non-trivial existing logic
// for low value this round; the SELECTION UI, not the figures display, is what's
// genuinely shared).
//
// Headline level only this round (population circle / trend / grade-band map, Overview
// + Growth-decline + Context-over-time graphs, single-metric + rank-over-time
// rankings). Family-level (§3b/§4-section-4) and subject-level (§3c/§6) depth are NOT
// built this round -- a genuinely separate scope of work (a category/subject
// drill-down filter, per-family/per-subject data fetching and re-aggregation across
// the ticked set) flagged in the build report rather than half-built here.

import { useEffect, useMemo, useState } from "react";
import type { ViewKey } from "@/lib/data-view-types";
import {
  stagesPresent,
  deserializeAcademicProfile,
  type AcademicSchoolProfile,
  type WireAcademicSchoolProfile,
  type KsStage,
  STAGE_LABEL,
} from "@/lib/academic-data-view";
import ViewSwitcher from "./ViewSwitcher";
import PdfExportButton from "./PdfExportButton";
import LoadingSpinnerCard from "./LoadingSpinnerCard";
import DataViewErrorBoundary from "./DataViewErrorBoundary";
import AcademicMapView from "./AcademicMapView";
import AcademicGraphsView from "./AcademicGraphsView";
import AcademicRankingsView from "./AcademicRankingsView";

function KsStageSwitcher({ stages, active, onChange }: { stages: KsStage[]; active: KsStage; onChange: (s: KsStage) => void }) {
  if (stages.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-200 p-1 text-sm dark:border-neutral-800">
      {stages.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={
            active === s
              ? "rounded px-3 py-1 font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }
        >
          {STAGE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export default function AcademicDataView({
  urn,
  authToken,
  tickedUrns,
  addedUrns,
  activeSetLabel,
  startPeriod,
  activeView,
  onChangeView,
}: {
  urn: string;
  authToken: string | null;
  tickedUrns: Set<string>;
  addedUrns: { urn: string; name: string }[];
  activeSetLabel: string | null;
  startPeriod: number;
  activeView: ViewKey;
  onChangeView: (v: ViewKey) => void;
}) {
  const urnsKey = useMemo(() => {
    const all = new Set<string>([urn, ...tickedUrns, ...addedUrns.map((a) => a.urn)]);
    return Array.from(all).sort().join(",");
  }, [urn, tickedUrns, addedUrns]);

  const [profilesByUrn, setProfilesByUrn] = useState<Map<string, AcademicSchoolProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<KsStage | null>(null);

  useEffect(() => {
    if (!authToken || urnsKey.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/data-view/academic-schools?anchorUrn=${urn}&urns=${encodeURIComponent(urnsKey)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setError("Couldn't load academic data for this school.");
          return;
        }
        const body = (await res.json()) as { profiles: WireAcademicSchoolProfile[] };
        const profiles = body.profiles.map(deserializeAcademicProfile);
        setProfilesByUrn(new Map(profiles.map((p) => [p.urn, p])));
      } catch {
        if (!cancelled) setError("Couldn't load academic data for this school.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urn, urnsKey, authToken]);

  const targetProfile = profilesByUrn.get(urn) ?? null;
  const availableStages = targetProfile ? stagesPresent(targetProfile) : [];
  // Default: prefer GCSE, then A-level, then KS2 -- matches the frontend spec's own
  // framing ("most senior schools have two [GCSE+A-level], most primary have exactly
  // one [KS2]"), not an arbitrary array-order default.
  const effectiveStage: KsStage | null = stage && availableStages.includes(stage) ? stage : availableStages.includes("ks4") ? "ks4" : availableStages.includes("ks5") ? "ks5" : (availableStages[0] ?? null);

  const tickedProfiles = Array.from(tickedUrns)
    .map((u) => profilesByUrn.get(u))
    .filter((p): p is AcademicSchoolProfile => !!p);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {effectiveStage && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2 sm:px-6 print:hidden dark:border-neutral-900">
          <div className="flex flex-wrap items-center gap-3">
            <KsStageSwitcher stages={availableStages} active={effectiveStage} onChange={setStage} />
            <ViewSwitcher active={activeView} onChange={onChangeView} />
          </div>
          <PdfExportButton />
        </div>
      )}

      <div className={activeView === "map" ? "relative min-h-[480px] flex-1 sm:min-h-[560px]" : "flex-1 p-4 sm:p-6"}>
        {error ? (
          <p className="py-12 text-center text-sm text-neutral-500">{error}</p>
        ) : loading && profilesByUrn.size === 0 ? (
          activeView === "map" ? <LoadingSpinnerCard label="Loading schools…" /> : <p className="py-12 text-center text-sm text-neutral-500">Loading school data…</p>
        ) : !targetProfile ? (
          <p className="py-12 text-center text-sm text-neutral-500">No real data available for this school yet.</p>
        ) : !effectiveStage ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No real KS2/GCSE/A-level academic results are available for this school yet.
          </p>
        ) : (
          <DataViewErrorBoundary key={`${activeView}-${effectiveStage}`}>
            {activeView === "map" ? (
              <AcademicMapView targetProfile={targetProfile} tickedProfiles={tickedProfiles} stage={effectiveStage} />
            ) : activeView === "graphs" ? (
              <AcademicGraphsView targetProfile={targetProfile} tickedProfiles={tickedProfiles} stage={effectiveStage} startPeriod={startPeriod} activeSetLabel={activeSetLabel} />
            ) : (
              <AcademicRankingsView targetProfile={targetProfile} tickedProfiles={tickedProfiles} stage={effectiveStage} startPeriod={startPeriod} />
            )}
          </DataViewErrorBoundary>
        )}
      </div>
    </div>
  );
}
