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
// Round 1 built headline level only. Round 2 adds: Part A (a includePopulation flag
// so the free card's fetch skips the census round-trip it never used -- see
// academic-data-view.ts), Part B (family-level Map/Graphs via the Category filter
// below), Part C (a subject-level table inside Graphs' Overview, entries + KS5
// value-added only -- see AcademicGraphsView's own comment for why average grade/
// point score and a subject-level Map aren't built). Subject data is fetched
// separately from the main profile batch, for the target school alone (see
// /api/data-view/academic-subject) -- the subject table is a single-school view, not
// a ticked-set comparison, so there's no reason to pull it for every ticked school.

import { useEffect, useMemo, useState } from "react";
import type { ViewKey } from "@/lib/data-view-types";
import {
  stagesPresent,
  availableFamilies,
  deserializeAcademicProfile,
  type AcademicSchoolProfile,
  type WireAcademicSchoolProfile,
  type KsStage,
  type SubjectEntry,
  type SubjectValueAdded,
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

// Round 2, Part B: Category (subject family) drill-down -- same real pill/button
// styling FilterBar.tsx's own Phase pills use (active fill, ▾ caret hinting at a
// sub-level), a self-contained copy rather than importing FilterBar's own private
// `Pill` (that component is styled for Rolls' TAG_COLOURS tag keys specifically; this
// one just needs the same visual shape, not the same colour-lookup mechanism).
function CategoryPill({ active, onClick, children, hasCaret }: { active: boolean; onClick: () => void; children: React.ReactNode; hasCaret?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          : "inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }
    >
      {children}
      {hasCaret && (
        <span aria-hidden="true" className="text-[10px] opacity-70">
          ▾
        </span>
      )}
    </button>
  );
}

function CategoryFilter({
  families,
  activeFamilyId,
  onChange,
}: {
  families: { familyId: string; familyLabel: string }[];
  activeFamilyId: string | null;
  onChange: (familyId: string | null) => void;
}) {
  if (families.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Category</span>
      <CategoryPill active={activeFamilyId === null} onClick={() => onChange(null)}>
        Whole school
      </CategoryPill>
      {families.map((f) => (
        <CategoryPill key={f.familyId} active={activeFamilyId === f.familyId} onClick={() => onChange(f.familyId)} hasCaret>
          {f.familyLabel}
        </CategoryPill>
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
  // Round 2, Part B: which subject family (if any) is drilled into. Reset whenever
  // the key stage itself changes -- family_id values are shared across ks4/ks5 (the
  // same 8 families), but a family selected under one stage carrying silently over to
  // a stage switch reads as confusing state, not a helpful default.
  const [familyId, setFamilyId] = useState<string | null>(null);
  function changeStage(next: KsStage) {
    setStage(next);
    setFamilyId(null);
  }

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

  // Union across target + ticked, per stage -- KS2 always yields [] (no family
  // taxonomy at all), so the Category row simply never renders for it.
  const families = effectiveStage ? availableFamilies([targetProfile, ...tickedProfiles].filter((p): p is AcademicSchoolProfile => !!p), effectiveStage) : [];

  // Round 2, Part C: subject-level data for the TARGET school only (see this file's
  // own header comment for why), refetched whenever the stage changes (ks4/ks5 are
  // genuinely different sources) -- not gated on familyId, since AcademicGraphsView
  // needs the real subject list to populate its own picker before a subject is chosen.
  // Which SUBJECT is picked is AcademicGraphsView's own local state, not lifted here --
  // that component already remounts on stage/family change (its parent
  // DataViewErrorBoundary key includes both), so its local subject selection resets
  // for free on either change, no explicit reset effect needed.
  const [subjectData, setSubjectData] = useState<{ entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authToken || !effectiveStage || effectiveStage === "ks2") {
        if (!cancelled) setSubjectData(null);
        return;
      }
      try {
        const res = await fetch(`/api/data-view/academic-subject?anchorUrn=${urn}&stage=${effectiveStage}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as { entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] };
        setSubjectData(body);
      } catch {
        // Non-fatal -- the subject table just doesn't appear; headline/family levels
        // above are unaffected.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urn, effectiveStage, authToken]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {effectiveStage && (
        <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2 sm:px-6 print:hidden dark:border-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <KsStageSwitcher stages={availableStages} active={effectiveStage} onChange={changeStage} />
              <ViewSwitcher active={activeView} onChange={onChangeView} />
            </div>
            <PdfExportButton />
          </div>
          <CategoryFilter families={families} activeFamilyId={familyId} onChange={setFamilyId} />
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
          <DataViewErrorBoundary key={`${activeView}-${effectiveStage}-${familyId ?? "whole"}`}>
            {activeView === "map" ? (
              <AcademicMapView targetProfile={targetProfile} tickedProfiles={tickedProfiles} stage={effectiveStage} familyId={familyId} familyLabel={families.find((f) => f.familyId === familyId)?.familyLabel ?? null} />
            ) : activeView === "graphs" ? (
              <AcademicGraphsView
                targetProfile={targetProfile}
                tickedProfiles={tickedProfiles}
                stage={effectiveStage}
                startPeriod={startPeriod}
                activeSetLabel={activeSetLabel}
                familyId={familyId}
                familyLabel={families.find((f) => f.familyId === familyId)?.familyLabel ?? null}
                subjectData={subjectData}
              />
            ) : (
              <AcademicRankingsView targetProfile={targetProfile} tickedProfiles={tickedProfiles} stage={effectiveStage} startPeriod={startPeriod} />
            )}
          </DataViewErrorBoundary>
        )}
      </div>
    </div>
  );
}
