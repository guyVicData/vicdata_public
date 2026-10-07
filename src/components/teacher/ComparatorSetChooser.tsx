"use client";

// Teacher view: the comparator-schools chooser, rebuilt to the v29 wireframe
// (docs/wireframes/comparator-chooser-v29). A hub of starting points, then an "adjust"
// screen for whichever was picked:
//   hub (Main / MainSavedSets / MainSchoolSets / MainRankings)
//     -> 10 nearest (2a)  -> adding a school by name forks it into a custom set (2c)
//     -> Schools in {LA} (2b) -> the same fork (2c)
//     -> My saved sets -> edit one (2c)
//     -> The school's sets / Victoria Consultancy Sets -> Done (switch one on)
//     -> Regional & national rankings -> a population (3a) -> narrowed, a custom ranking (3b)
//
// This component owns the state and every write; ./chooser/screens.tsx draws it. Every
// population comes from the module that already owns it (see ./chooser/data.ts):
// default-comparator-lists' list1 / boarding recipe / list2 / local16Plus through the
// member Data View's own routes, the ranking population through region_nation_set.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { VIEW_AS_READ_ONLY } from "@/lib/view-as";
import type { SchoolSearchResult } from "@/components/SchoolSearch";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";
import { resolveNearestOption } from "@/lib/nearest-option";
import { REGION_NAME_TO_ONS_CODE } from "@/lib/region-crosswalk";
import {
  NATIONAL,
  defaultRankingFilters,
  describeRanking,
  isCustomRanking,
  matchesRanking,
  sameScope,
  type ChooserSchool,
  type PopulationRow,
  type RankingFilters,
  type RankingScope,
} from "@/lib/comparator-chooser";
import {
  deleteComparatorSet,
  deleteRanking,
  fetchSavedRankings,
  PERSONAL_RANKING_CAP,
  saveComparatorSet,
  saveRanking,
  type SavedComparatorSet,
  type SavedRanking,
  type SavedSetsPayload,
} from "@/lib/teacher-view-saved-sets";
import { TeacherModal } from "./TeacherModal";
import { Panel, PrimaryButton, SecondaryButton, DangerGhostButton, FooterCount, SaveBox } from "./chooser/ui";
import { CustomScreen, HubScreen, LaScreen, NearestScreen, RankingScreen, plural, type GroupBy, type HubPick, type Theme } from "./chooser/screens";
import {
  fetchAdjacentLas,
  fetchDefaultLists,
  fetchLaSet,
  fetchNearest,
  fetchPopulation,
  fetchSchoolDetails,
  type DefaultListsPayload,
  type SchoolDetail,
} from "./chooser/data";

// What the chooser hands back when a teacher presses Done or saves: a saved set to switch
// on, an unsaved list of schools, or a ranking.
export type ChooserChoice =
  | { kind: "saved"; id: string }
  | { kind: "urns"; label: string; urns: string[] }
  | { kind: "ranking"; label: string; filters: RankingFilters; rankingId: string | null };

type Screen = "hub" | "nearest" | "la" | "custom" | "ranking";
type CustomState = {
  base: "nearest" | "la" | "set";
  baseLabel: string;
  coreUrns: string[]; // la / set bases (nearest reads the live nearest list)
  added: string[];
  removed: string[];
  editing: SavedComparatorSet | null;
};

const NEAREST_DEFAULT = 10;
const scopeKey = (s: RankingScope) => (s.kind === "nation" ? "nation" : s.code);

export function ComparatorSetChooser({
  payload,
  phase,
  theme,
  targetUrn,
  targetName,
  initialEdit,
  onClose,
  onDone,
  onSetsChanged,
}: {
  payload: SavedSetsPayload;
  // KS2 has no exam population to rank within, so its chooser has no rankings row.
  phase: "ks2" | "ks4" | "ks5";
  theme: Theme;
  targetUrn: string;
  targetName: string;
  // Open straight at the custom editor for this set ("Edit" beside a set in the pill).
  initialEdit: SavedComparatorSet | null;
  onClose: () => void;
  onDone: (choice: ChooserChoice) => void | Promise<void>;
  onSetsChanged: () => Promise<void>;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // ------------------------------------------------------------------- shared data
  const [lists, setLists] = useState<DefaultListsPayload | null>(null);
  const [details, setDetails] = useState<Map<string, SchoolDetail>>(new Map());
  const addDetails = useCallback(
    async (urns: string[]) => {
      const missing = urns.filter((u) => !details.has(u));
      if (!missing.length) return;
      const got = await fetchSchoolDetails(supabase, missing);
      setDetails((d) => new Map([...d, ...got]));
    },
    [supabase, details],
  );

  // Nearest: which recipe "10 nearest" is (resolveNearestOption, the Data View's own
  // rule), and how many it currently shows.
  const [nearest, setNearest] = useState<{ recipe: "list1" | "boarding"; count: number; entries: DefaultListEntry[] | null; busy: boolean }>({
    recipe: "list1",
    count: NEAREST_DEFAULT,
    entries: null,
    busy: false,
  });
  // LA: list2 plus the additive 16+ colleges (never merged into list2 upstream), plus any
  // extra LA added here.
  const [la, setLa] = useState<{ entries: DefaultListEntry[] | null; extraLas: string[]; unticked: string[]; groupBy: GroupBy; adjacent: string[] | null; adjacentOpen: boolean; busy: boolean }>({
    entries: null,
    extraLas: [],
    unticked: [],
    groupBy: "sector",
    adjacent: null,
    adjacentOpen: false,
    busy: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const body = await fetchDefaultLists(supabase, targetUrn, phase === "ks5");
      if (cancelled || !body) return;
      setLists(body);
      const chosen = resolveNearestOption(body.list1, body.boardingBand, body.boardingRecipe, null);
      const recipe = chosen && body.boardingRecipe && chosen === body.boardingRecipe ? "boarding" : "list1";
      const laEntries = [...(body.list2?.schools ?? [])];
      for (const c of body.local16Plus?.schools ?? []) if (!laEntries.some((e) => e.urn === c.urn)) laEntries.push(c);
      setNearest((n) => ({ ...n, recipe, entries: chosen?.schools ?? [] }));
      setLa((l) => ({ ...l, entries: laEntries.filter((e) => e.urn !== targetUrn) }));
      const urns = [targetUrn, ...(chosen?.schools ?? []).map((s) => s.urn), ...laEntries.map((s) => s.urn)];
      const got = await fetchSchoolDetails(supabase, urns);
      if (!cancelled) setDetails((d) => new Map([...d, ...got]));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, targetUrn, phase]);

  const target = details.get(targetUrn) ?? null;
  const toSchool = useCallback(
    (urn: string, distanceKm?: number | null): ChooserSchool => {
      const d = details.get(urn);
      let km = distanceKm ?? null;
      if (km === null && d && target && d.easting !== null && d.northing !== null && target.easting !== null && target.northing !== null) {
        km = Math.hypot(d.easting - target.easting, d.northing - target.northing) / 1000;
      }
      return { urn, name: d?.name ?? urn, distanceKm: km, sector: d?.sector ?? null, boarders: d?.boarders ?? false, laName: d?.laName ?? null };
    },
    [details, target],
  );

  const nearestSchools = (nearest.entries ?? []).filter((e) => e.urn !== targetUrn).map((e) => toSchool(e.urn, e.distanceKm));
  const laSchools = (la.entries ?? []).map((e) => toSchool(e.urn, e.distanceKm));
  const laTicked = new Set(laSchools.map((s) => s.urn).filter((u) => !la.unticked.includes(u)));
  const laName = payload.target.laName;

  // 0.6.5 S4: on the Post-16 page "10 nearest" is the 10 nearest with Post-16 provision.
  const nearestName = (n: number) => (phase === "ks5" ? `${n} nearest with a sixth form or 16+ provision` : `${n} nearest schools`);

  const stepNearest = async (delta: number) => {
    const count = Math.max(5, nearest.count + delta);
    setNearest((n) => ({ ...n, busy: true }));
    const entries = await fetchNearest(supabase, targetUrn, count, nearest.recipe, phase === "ks5");
    if (entries) await addDetails(entries.map((e) => e.urn));
    setNearest((n) => ({ ...n, busy: false, count: entries ? count : n.count, entries: entries ?? n.entries }));
  };

  const openAdjacent = async () => {
    setLa((l) => ({ ...l, adjacentOpen: !l.adjacentOpen }));
    if (la.adjacent === null) {
      const names = await fetchAdjacentLas(supabase, targetUrn);
      setLa((l) => ({ ...l, adjacent: names }));
    }
  };
  const addLa = async (name: string) => {
    setLa((l) => ({ ...l, busy: true }));
    const entries = await fetchLaSet(supabase, targetUrn, [name]);
    if (entries) await addDetails(entries.map((e) => e.urn));
    setLa((l) => {
      const merged = [...(l.entries ?? [])];
      for (const e of entries ?? []) if (e.urn !== targetUrn && !merged.some((m) => m.urn === e.urn)) merged.push(e);
      return { ...l, busy: false, entries: merged, extraLas: [...l.extraLas, name], adjacent: (l.adjacent ?? []).filter((n) => n !== name) };
    });
  };

  // ------------------------------------------------------------------ navigation
  const [screen, setScreen] = useState<Screen>(initialEdit ? "custom" : "hub");
  const [pick, setPick] = useState<HubPick>(initialEdit ? "mine" : "nearest");
  const [setSub, setSetSub] = useState<string | null>(initialEdit?.id ?? null);
  const mine = payload.sets.filter((s) => s.mine);
  const school = payload.sets.filter((s) => s.shared && !s.vc);
  // Victoria Consultancy Sets: present only when VC has switched at least one on for this
  // school (the route returns none otherwise), so the row renders only then.
  const vcSets = payload.sets.filter((s) => s.vc);
  const listFor = (p: HubPick) => (p === "mine" ? mine : p === "school" ? school : p === "vc" ? vcSets : []);
  const choosePick = (p: HubPick) => {
    setPick(p);
    const list = listFor(p);
    if (list.length && !list.some((s) => s.id === setSub)) setSetSub(list[0].id);
  };

  // ------------------------------------------------------------------ custom (2c)
  const [custom, setCustom] = useState<CustomState | null>(
    initialEdit ? { base: "set", baseLabel: initialEdit.name, coreUrns: initialEdit.members.map((m) => m.urn), added: [], removed: [], editing: initialEdit } : null,
  );
  const [name, setName] = useState(initialEdit?.name ?? "");
  const [shared, setShared] = useState(initialEdit?.shared ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialEdit) return;
    (async () => {
      await addDetails(initialEdit.members.map((m) => m.urn));
    })();
    // Once, for the set the chooser was opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forkWith = async (from: "nearest" | "la", school: SchoolSearchResult) => {
    if (school.urn === targetUrn) return;
    await addDetails([school.urn]);
    setCustom({
      base: from,
      baseLabel: from === "nearest" ? nearestName(nearest.count) : `Schools in ${laName ?? "your LA"}`,
      coreUrns: from === "la" ? laSchools.filter((s) => laTicked.has(s.urn)).map((s) => s.urn) : [],
      added: [school.urn],
      removed: [],
      editing: null,
    });
    setName("");
    setShared(false);
    setError(null);
    setScreen("custom");
  };
  const editSet = async (set: SavedComparatorSet) => {
    await addDetails(set.members.map((m) => m.urn));
    setCustom({ base: "set", baseLabel: set.name, coreUrns: set.members.map((m) => m.urn), added: [], removed: [], editing: set });
    setName(set.name);
    setShared(set.shared);
    setError(null);
    setScreen("custom");
  };

  const customCore: ChooserSchool[] = !custom
    ? []
    : custom.base === "nearest"
      ? nearestSchools
      : custom.coreUrns
          .filter((u) => u !== targetUrn && !custom.removed.includes(u))
          .map((u) => toSchool(u, (la.entries ?? []).find((e) => e.urn === u)?.distanceKm))
          .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  const customAdded = (custom?.added ?? []).filter((u) => !customCore.some((c) => c.urn === u)).map((u) => toSchool(u));
  const customUrns = [...customCore, ...customAdded].map((s) => s.urn);

  const me = payload.me;
  const personalFull = payload.personalCount >= payload.cap;
  const editingSet = custom?.editing ?? null;
  const willBePersonal = (asNew: boolean) => (asNew || !editingSet ? !shared || !me.canEditShared : !editingSet.shared);
  const capBlocks = (asNew: boolean) => (asNew || !editingSet) && willBePersonal(asNew) && personalFull;

  // 0.6 snag 4 (B): View as draws the chooser exactly as the viewed member has it (a
  // School-Admin may share), but never writes the school's shared sets or rankings: those
  // saves are refused, with the read-only note on their buttons.
  const viewAsShared = (personal: boolean) => !!me.viewAs && !personal;
  const persistSet = async (asNew: boolean) => {
    if (!custom) return;
    if (viewAsShared(willBePersonal(asNew))) {
      setError(`${VIEW_AS_READ_ONLY}: shared sets aren't saved.`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await saveComparatorSet(supabase, {
      id: asNew ? null : editingSet && editingSet.editable ? editingSet.id : null,
      schoolAccountId: me.schoolAccountId,
      ownerMembershipId: willBePersonal(asNew) ? me.membershipId : null,
      name: name.trim(),
      urns: customUrns,
      config: asNew || !editingSet ? { startedFrom: custom.baseLabel } : editingSet.config,
      viewAs: me.viewAs ?? null,
    });
    if ("error" in result) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await onSetsChanged();
    setBusy(false);
    await onDone({ kind: "saved", id: result.id });
  };
  const removeSet = async (set: SavedComparatorSet) => {
    if (viewAsShared(!set.shared)) {
      setError(`${VIEW_AS_READ_ONLY}: shared sets aren't changed.`);
      return;
    }
    setBusy(true);
    const err = await deleteComparatorSet(supabase, set.id, me.viewAs ?? null);
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    await onSetsChanged();
    setBusy(false);
    setCustom(null);
    setSetSub(null);
    setScreen("hub");
    setPick("mine");
  };

  // ---------------------------------------------------------------- rankings (3a/3b)
  const [populations, setPopulations] = useState<Record<string, PopulationRow[] | "error">>({});
  const [ownRegion, setOwnRegion] = useState<RankingScope | null>(null);
  const [savedRankings, setSavedRankings] = useState<SavedRanking[]>([]);
  const [rankingSub, setRankingSub] = useState<string | null>("national");
  const [filters, setFilters] = useState<RankingFilters>(defaultRankingFilters(NATIONAL));
  const [editingRanking, setEditingRanking] = useState<SavedRanking | null>(null);

  const rankPhase = phase === "ks2" ? null : phase;
  const reloadRankings = useCallback(async () => {
    if (rankPhase) setSavedRankings(await fetchSavedRankings(supabase, me, rankPhase));
  }, [supabase, me, rankPhase]);
  useEffect(() => {
    if (!rankPhase) return;
    let cancelled = false;
    (async () => {
      const got = await fetchSavedRankings(supabase, me, rankPhase);
      if (!cancelled) setSavedRankings(got);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, me, rankPhase]);

  // Which scopes have been asked for, so each is fetched once. A ref, not state: a
  // population not yet in `populations` simply reads as loading.
  const requested = useRef(new Set<string>());
  const ensurePopulation = useCallback(
    async (scope: RankingScope) => {
      const key = scopeKey(scope);
      if (requested.current.has(key) || !rankPhase) return;
      requested.current.add(key);
      const body = await fetchPopulation(supabase, targetUrn, rankPhase, scope);
      setPopulations((p) => ({ ...p, [key]: body ? body.rows : "error" }));
      if (body?.ownRegion) setOwnRegion((r) => r ?? { kind: "region", code: body.ownRegion!.code, name: body.ownRegion!.name });
    },
    [supabase, targetUrn, rankPhase],
  );
  // Opening the rankings row loads the whole nation and (once it names it) the school's
  // own region, for the two default rows' counts.
  useEffect(() => {
    if (pick !== "rankings" && screen !== "ranking") return;
    (async () => {
      await Promise.all([ensurePopulation(NATIONAL), ownRegion ? ensurePopulation(ownRegion) : Promise.resolve()]);
    })();
  }, [pick, screen, ownRegion, ensurePopulation]);
  useEffect(() => {
    if (screen !== "ranking") return;
    (async () => {
      await ensurePopulation(filters.scope);
    })();
  }, [screen, filters.scope, ensurePopulation]);

  const rowsFor = (scope: RankingScope) => {
    const p = populations[scopeKey(scope)];
    return Array.isArray(p) ? p : null;
  };
  const matchedCount = (f: RankingFilters) => {
    const rows = rowsFor(f.scope);
    return rows ? rows.filter((r) => matchesRanking(r, f)).length : null;
  };

  const openRanking = (f: RankingFilters, editing: SavedRanking | null) => {
    setFilters(f);
    setEditingRanking(editing);
    setName(editing?.name ?? "");
    setShared(editing?.shared ?? false);
    setError(null);
    setScreen("ranking");
  };
  const rankingIsCustom = isCustomRanking(filters, ownRegion) || editingRanking !== null;
  const personalRankings = savedRankings.filter((r) => r.mine).length;
  const rankingPersonal = (asNew: boolean) => (asNew || !editingRanking ? !shared || !me.canEditShared : !editingRanking.shared);
  const rankingCapBlocks = (asNew: boolean) => (asNew || !editingRanking) && rankingPersonal(asNew) && personalRankings >= PERSONAL_RANKING_CAP;

  const persistRanking = async (asNew: boolean) => {
    if (viewAsShared(rankingPersonal(asNew))) {
      setError(`${VIEW_AS_READ_ONLY}: shared rankings aren't saved.`);
      return;
    }
    setBusy(true);
    setError(null);
    if (!rankPhase) return;
    const result = await saveRanking(supabase, {
      id: asNew ? null : editingRanking && editingRanking.editable ? editingRanking.id : null,
      schoolAccountId: me.schoolAccountId,
      ownerMembershipId: rankingPersonal(asNew) ? me.membershipId : null,
      name: name.trim(),
      phase: rankPhase,
      filters,
      viewAs: me.viewAs ?? null,
    });
    if ("error" in result) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await reloadRankings();
    setBusy(false);
    await onDone({ kind: "ranking", label: name.trim(), filters, rankingId: result.id });
  };
  const removeRanking = async (r: SavedRanking) => {
    if (viewAsShared(!r.shared)) {
      setError(`${VIEW_AS_READ_ONLY}: shared rankings aren't changed.`);
      return;
    }
    setBusy(true);
    const err = await deleteRanking(supabase, r.id, me.viewAs ?? null);
    await reloadRankings();
    setBusy(false);
    if (err) setError(err);
    setEditingRanking(null);
    setRankingSub("national");
    setScreen("hub");
    setPick("rankings");
  };

  const otherRegions = Object.entries(REGION_NAME_TO_ONS_CODE)
    .filter(([n, code]) => n !== "Wales" && !(ownRegion && ownRegion.kind === "region" && ownRegion.code === code))
    .map(([n, code]) => ({ code, name: n }));

  // --------------------------------------------------------------------- hub footer
  const nationalRows = rowsFor(NATIONAL);
  const regionalRows = ownRegion ? rowsFor(ownRegion) : null;
  const pickedRanking = savedRankings.find((r) => r.id === rankingSub) ?? null;
  const pickedSet = listFor(pick).find((s) => s.id === setSub) ?? null;
  const hubCount = (): string => {
    if (pick === "nearest") return `${plural(nearestSchools.length, "school")} selected`;
    if (pick === "la") return `${plural(laTicked.size, "school")} selected`;
    if (pick === "rankings") {
      const n =
        rankingSub === "national" ? nationalRows?.length ?? null : rankingSub === "regional" ? regionalRows?.length ?? null : pickedRanking ? matchedCount(pickedRanking.filters) : null;
      return n === null ? "… schools & colleges" : `${n.toLocaleString()} schools & colleges`;
    }
    return `${plural(pickedSet?.members.length ?? 0, "school")} selected`;
  };
  const hubAction = (): { label: "Next" | "Done"; disabled: boolean; onClick: () => void } => {
    if (pick === "nearest") return { label: "Next", disabled: nearest.entries === null, onClick: () => setScreen("nearest") };
    if (pick === "la") return { label: "Next", disabled: la.entries === null, onClick: () => setScreen("la") };
    if (pick === "rankings")
      return {
        label: "Next",
        disabled: !rankingSub,
        onClick: () => {
          if (rankingSub === "national") openRanking(defaultRankingFilters(NATIONAL), null);
          else if (rankingSub === "regional" && ownRegion) openRanking(defaultRankingFilters(ownRegion), null);
          else if (pickedRanking) openRanking(pickedRanking.filters, pickedRanking);
        },
      };
    if (pick === "mine") return { label: "Next", disabled: !pickedSet, onClick: () => pickedSet && void editSet(pickedSet) };
    // The school's own sets and Victoria Consultancy Sets are switched on, not edited.
    return { label: "Done", disabled: !pickedSet, onClick: () => pickedSet && void onDone({ kind: "saved", id: pickedSet.id }) };
  };

  // ----------------------------------------------------------------------- render
  let content: React.ReactNode;
  if (screen === "nearest") {
    content = (
      <NearestScreen
        targetName={targetName}
        schools={nearestSchools}
        count={nearest.count}
        title={nearestName(nearest.count)}
        loading={nearest.busy || nearest.entries === null}
        onLess={() => void stepNearest(-5)}
        onMore={() => void stepNearest(5)}
        onAdd={(s) => void forkWith("nearest", s)}
        onBack={() => setScreen("hub")}
        onClose={onClose}
        onDone={() => void onDone({ kind: "urns", label: nearestName(nearest.count), urns: nearestSchools.map((s) => s.urn) })}
      />
    );
  } else if (screen === "la") {
    const laLabel = la.extraLas.length ? `${laName ?? "your LA"} + ${la.extraLas.length} more` : laName ?? "your LA";
    content = (
      <LaScreen
        laLabel={laLabel}
        schools={laSchools}
        extra={
          lists?.local16Plus
            ? { label: lists.local16Plus.label, urns: new Set(lists.local16Plus.schools.map((c) => c.urn).filter((u) => !(lists.list2?.schools ?? []).some((e) => e.urn === u))) }
            : null
        }
        ticked={laTicked}
        onToggle={(urn) => setLa((l) => ({ ...l, unticked: l.unticked.includes(urn) ? l.unticked.filter((u) => u !== urn) : [...l.unticked, urn] }))}
        onToggleMany={(urns, on) => setLa((l) => ({ ...l, unticked: on ? l.unticked.filter((u) => !urns.includes(u)) : Array.from(new Set([...l.unticked, ...urns])) }))}
        groupBy={la.groupBy}
        onGroupBy={(g) => setLa((l) => ({ ...l, groupBy: g }))}
        adjacent={{ names: la.adjacent ?? [], open: la.adjacentOpen, onOpen: () => void openAdjacent(), loaded: la.adjacent !== null }}
        onAddLa={(n) => void addLa(n)}
        laBusy={la.busy}
        onAdd={(s) => void forkWith("la", s)}
        onBack={() => setScreen("hub")}
        onClose={onClose}
        onDone={() => void onDone({ kind: "urns", label: `Schools in ${laLabel}`, urns: laSchools.filter((s) => laTicked.has(s.urn)).map((s) => s.urn) })}
      />
    );
  } else if (screen === "custom" && custom) {
    const isEditing = custom.base === "set" && editingSet !== null;
    const canShare = me.canEditShared && !isEditing;
    const saveNote = viewAsShared(willBePersonal(true)) || (isEditing && viewAsShared(!editingSet!.shared))
      ? `${VIEW_AS_READ_ONLY}: shared sets aren't saved.`
      : capBlocks(true)
      ? `You have ${payload.personalCount} of ${payload.cap} personal sets.${me.canEditShared ? " Delete one, or save this for the whole school." : " Delete one to save another."}`
      : !isEditing && willBePersonal(true)
        ? `${payload.personalCount} of ${payload.cap} personal sets used`
        : null;
    const emptyOrUnnamed = !name.trim() || customUrns.length === 0;
    content = (
      <CustomScreen
        theme={theme}
        title={custom.base === "nearest" ? nearestName(nearest.count) : custom.base === "la" ? custom.baseLabel : custom.baseLabel}
        subtitle={
          isEditing
            ? `${plural(customUrns.length, "school")} · ${editingSet!.shared ? "shared school-wide" : "your saved set"}`
            : `${plural(customUrns.length, "school")} · started from "${custom.baseLabel}"`
        }
        forked={custom.base !== "set"}
        core={customCore}
        added={customAdded}
        onRemoveCore={custom.base === "set" ? (urn) => setCustom({ ...custom, removed: [...custom.removed, urn] }) : null}
        onRemoveAdded={(urn) => setCustom({ ...custom, added: custom.added.filter((u) => u !== urn) })}
        stepper={
          custom.base === "nearest"
            ? { label: nearestName(nearest.count), onLess: () => void stepNearest(-5), onMore: () => void stepNearest(5), lessDisabled: nearest.count <= 5, busy: nearest.busy }
            : null
        }
        onAdd={(s) => {
          if (s.urn === targetUrn) return;
          void addDetails([s.urn]);
          setCustom({ ...custom, added: [...custom.added, s.urn], removed: custom.removed.filter((u) => u !== s.urn) });
        }}
        name={name}
        onName={setName}
        canShare={canShare}
        shared={shared}
        onShared={setShared}
        saveNote={saveNote}
        canDelete={isEditing && editingSet!.editable && !viewAsShared(!editingSet!.shared)}
        onDelete={() => editingSet && void removeSet(editingSet)}
        onSaveAs={() => void persistSet(true)}
        onSave={() => void persistSet(false)}
        saveDisabled={emptyOrUnnamed || capBlocks(false) || (isEditing && !editingSet!.editable) || viewAsShared(willBePersonal(false))}
        saveAsDisabled={emptyOrUnnamed || capBlocks(true) || viewAsShared(willBePersonal(true))}
        busy={busy}
        error={error}
        onBack={() => {
          setScreen(custom.base === "nearest" ? "nearest" : custom.base === "la" ? "la" : "hub");
          if (custom.base === "set") setCustom(null);
        }}
        onClose={onClose}
      />
    );
  } else if (screen === "ranking" && rankPhase) {
    const total = rowsFor(filters.scope)?.length ?? null;
    const matched = matchedCount(filters);
    const readOnly = editingRanking !== null && !editingRanking.editable;
    const emptyOrUnnamed = !name.trim();
    const canShareRanking = me.canEditShared && !editingRanking;
    const rankingNote = viewAsShared(rankingPersonal(true)) || (editingRanking !== null && viewAsShared(!editingRanking.shared))
      ? `${VIEW_AS_READ_ONLY}: shared rankings aren't saved.`
      : rankingCapBlocks(true)
      ? `You have ${personalRankings} of ${PERSONAL_RANKING_CAP} personal rankings.${me.canEditShared ? " Delete one, or save this for the whole school." : " Delete one to save another."}`
      : null;
    const defaultLabel = filters.scope.kind === "nation" ? "National — all England schools & colleges" : `Regional — all ${filters.scope.name} schools & colleges`;
    content = (
      <RankingScreen
        theme={theme}
        phase={rankPhase}
        title={editingRanking?.name ?? "Build a new ranking"}
        subtitle={describeRanking(filters, ownRegion)}
        filters={filters}
        onFilters={setFilters}
        ownRegion={ownRegion}
        otherRegions={otherRegions}
        count={{ matched, total }}
        custom={rankingIsCustom}
        save={
          rankingIsCustom ? (
            <>
              <SaveBox title="Name this ranking" name={name} onName={setName} placeholder="e.g. Independent girls' boarding schools" canShare={canShareRanking} shared={shared} onShared={setShared} note={rankingNote} />
              {error && <div role="alert" style={{ fontSize: 12, color: "var(--cc-danger)" }}>{error}</div>}
            </>
          ) : null
        }
        footer={
          !rankingIsCustom ? (
            <>
              <FooterCount>{total === null ? "… included" : `${total.toLocaleString()} included`}</FooterCount>
              <PrimaryButton disabled={total === null} onClick={() => void onDone({ kind: "ranking", label: defaultLabel, filters, rankingId: null })}>Done</PrimaryButton>
            </>
          ) : readOnly ? (
            <>
              <SecondaryButton onClick={() => void persistRanking(true)} disabled={emptyOrUnnamed || rankingCapBlocks(true) || busy}>Save as</SecondaryButton>
              <PrimaryButton onClick={() => void onDone({ kind: "ranking", label: editingRanking!.name, filters, rankingId: editingRanking!.id })}>Done</PrimaryButton>
            </>
          ) : (
            <>
              {editingRanking?.editable && !viewAsShared(!editingRanking.shared) ? <DangerGhostButton onClick={() => void removeRanking(editingRanking)} disabled={busy}>Delete</DangerGhostButton> : <span />}
              <div style={{ display: "flex", gap: 8 }}>
                <SecondaryButton onClick={() => void persistRanking(true)} disabled={emptyOrUnnamed || rankingCapBlocks(true) || busy || viewAsShared(rankingPersonal(true))}>Save as</SecondaryButton>
                <PrimaryButton onClick={() => void persistRanking(false)} disabled={emptyOrUnnamed || rankingCapBlocks(false) || busy || viewAsShared(rankingPersonal(false))}>Save</PrimaryButton>
              </div>
            </>
          )
        }
        onBack={() => {
          setScreen("hub");
          setPick("rankings");
        }}
        onClose={onClose}
      />
    );
  } else {
    content = (
      <HubScreen
        targetName={targetName}
        closeRef={closeRef}
        onClose={onClose}
        pick={pick}
        onPick={choosePick}
        nearest={{
          title: nearestName(nearest.count),
          count: nearest.entries === null ? null : nearestSchools.length,
          radiusKm: nearestSchools.length ? Math.max(...nearestSchools.map((s) => s.distanceKm ?? 0)) : null,
        }}
        la={
          laName
            ? {
                laName,
                count: la.entries === null ? null : laSchools.length,
                spanKm: laSchools.length ? Math.max(...laSchools.map((s) => s.distanceKm ?? 0)) : null,
                includesColleges: (lists?.local16Plus?.schools.length ?? 0) > 0,
              }
            : null
        }
        rankings={rankPhase === null ? null : {
          sub: rankingSub,
          onSub: setRankingSub,
          national: nationalRows?.length ?? null,
          regional: ownRegion && ownRegion.kind === "region" ? { name: ownRegion.name, count: regionalRows?.length ?? null } : null,
          saved: savedRankings.map((r) => ({ ...r, count: matchedCount(r.filters) })),
          onEdit: (r) => openRanking(r.filters, r),
          onDelete: (r) => void removeRanking(r),
          onBuild: () => openRanking(defaultRankingFilters(NATIONAL), null),
        }}
        mine={mine}
        school={school}
        schoolLabel={`${targetName} sets`}
        setSub={setSub}
        onSetSub={setSetSub}
        onEditSet={(s) => void editSet(s)}
        onDeleteSet={(s) => void removeSet(s)}
        vc={vcSets.length ? { sets: vcSets } : null}
        count={hubCount()}
        action={hubAction()}
      />
    );
  }

  return (
    <TeacherModal label="Comparator schools" backdropLabel="Close the comparator chooser" onClose={onClose} initialFocusRef={closeRef} size="chooser">
      <Panel>{content}</Panel>
    </TeacherModal>
  );
}

// Re-exported for the page's own use.
export { sameScope };
