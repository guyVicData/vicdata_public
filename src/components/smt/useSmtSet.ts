"use client";

// VicData 0.8 SMT round 1 (B3): the comparison set -- Teacher's sets, as a default VicData function.
// One set drives the whole SMT dashboard. It is Teacher's own choice, resolved Teacher's own way:
//   nearest   the chooser's "10 nearest schools" (POST /api/teacher/chooser-set { kind: "nearest" })
//   saved     a saved set (the same tables and RLS as Teacher: /api/teacher/saved-comparator-sets)
//   urns      a list of schools (the chooser's schools in the LA, a custom pick, or ?set= from a link)
//   ranking   a regional or national ranking (the chooser's rankings)
// The choice is remembered per user and school in this browser (as the level is); a ?set= link
// opens on its schools without saving them (r2b's rule).
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { cachedFetchJson } from "@/lib/fetch-cache";
import { fetchSavedSets, type SavedSetsPayload } from "@/lib/teacher-view-saved-sets";
import { parseLinkedSet } from "@/lib/teacher-view-linked-set";
import type { ChooserChoice } from "@/components/teacher/ComparatorSetChooser";
import { freshToken } from "@/components/admissions/member";
import type { SmtSetChoice } from "./api";
import type { RankingPopulationResult } from "@/lib/chooser-sets";

/** A ranking's whole population, ranked (20 Nov): what SMT benchmarks against, and the panel's table. */
export type SmtRankTable = Omit<RankingPopulationResult, "rows">;

export const DEFAULT_SET_LABEL = "10 nearest schools";
type Stored = { kind: "nearest" } | ChooserChoice;
const KEY = (urn: string) => `vicdata.smt.set:${urn}`;

function readStored(urn: string): Stored {
  try {
    const raw = window.localStorage.getItem(KEY(urn));
    const c = raw ? (JSON.parse(raw) as Stored) : null;
    if (c && (c.kind === "nearest" || c.kind === "saved" || c.kind === "urns" || c.kind === "ranking")) return c;
  } catch {
    // Blocked storage: the default.
  }
  return { kind: "nearest" };
}

type Phase = "ks2" | "ks4" | "ks5";

/** The chooser-set request for a set that isn't a saved one: the one body, so a head start shares its answer. */
function chooserBody(urn: string, phase: Phase, effective: Exclude<Stored, { kind: "saved" }>): string {
  // 20 Nov (Leighton Park prep): a ranking is SMT's benchmark, so it is the WHOLE population (`full`), not
  // the chooser's top 15 and 5 either side -- the school's real regional or national position.
  const set = effective.kind === "nearest" ? { kind: "nearest" } : effective.kind === "urns" ? { kind: "urns", urns: effective.urns } : { kind: "ranking", filters: effective.filters, full: true };
  return JSON.stringify({ urn, phase, set });
}

// 20 Nov (speed): the set's phase comes from /api/smt/school (setPhaseOf), and the set's schools waited for
// it. Remembered per school in this browser, so the next visit asks for the set alongside the school.
const PHASE_KEY = (urn: string) => `vicdata.smt.setPhase:${urn}`;
function readPhase(urn: string): Phase | null {
  try {
    const p = window.localStorage.getItem(PHASE_KEY(urn));
    return p === "ks2" || p === "ks4" || p === "ks5" ? p : null;
  } catch {
    return null;
  }
}

export type SmtSetState = {
  choice: Stored;
  set: SmtSetChoice | null; // null while it resolves
  savedSets: SavedSetsPayload | null;
  linked: boolean;
  choose: (c: ChooserChoice | { kind: "nearest" }) => void;
  reloadSaved: () => Promise<void>;
  /** A ranking in use: its whole population, ranked (null for any other set, and while it resolves). */
  rankTable: SmtRankTable | null;
  /** The set's schools couldn't be loaded (its route failed, twice): say so, never wait for ever. */
  failed: boolean;
  retry: () => void;
};

export function useSmtSet(urn: string | null, phase: "ks2" | "ks4" | "ks5" | null): SmtSetState {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [linked, setLinked] = useState<{ urns: string[]; label: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const l = parseLinkedSet(sp);
    return l ? { urns: l.urns, label: sp.get("setLabel")?.slice(0, 80) || "Linked schools" } : null;
  });
  // The page mounts this only in the browser, with its school known: read the stored choice once.
  const [choice, setChoice] = useState<Stored>(() => (urn && typeof window !== "undefined" ? readStored(urn) : { kind: "nearest" }));
  const [savedSets, setSavedSets] = useState<SavedSetsPayload | null>(null);
  useEffect(() => {
    if (!urn || !phase) return;
    let live = true;
    fetchSavedSets(supabase, urn, phase).then((p) => live && setSavedSets(p));
    return () => {
      live = false;
    };
  }, [urn, phase, supabase]);
  const reloadSaved = useCallback(async () => {
    if (urn && phase) setSavedSets(await fetchSavedSets(supabase, urn, phase, { fresh: true }));
  }, [urn, phase, supabase]);

  const [resolved, setResolved] = useState<{ key: string; set: SmtSetChoice; rankTable?: SmtRankTable } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // Try again: the same set asked again.
  const [tries, setTries] = useState(0);
  const retry = useCallback(() => {
    setFailedKey(null);
    setTries((t) => t + 1);
  }, []);
  const effective: Stored = linked ? { kind: "urns", label: linked.label, urns: linked.urns } : choice;
  const key = JSON.stringify([urn, phase, effective, effective.kind === "saved" ? !!savedSets : null]);
  // 20 Nov (speed): a head start. While the page waits for the school (and so the set's phase), the set's
  // own requests start with the phase this school had last time here, or, with none remembered, the
  // default "10 nearest schools" at GCSE (most schools' set phase). Fire and forget: nothing here is read.
  // The real requests below are unchanged and are made once the phase is known; when it is the phase
  // guessed, they are the same requests and share these answers (the fetch cache), else these are unused.
  // So the set used, and every figure, is exactly as before; only sooner.
  useEffect(() => {
    if (!urn) return;
    if (phase) {
      try {
        window.localStorage.setItem(PHASE_KEY(urn), phase);
      } catch {
        // Blocked storage: no head start next time.
      }
      return;
    }
    const remembered = readPhase(urn);
    const guess = remembered ?? "ks4";
    // A guess (nothing remembered) only for the default set, the cheapest; a ranking only where it can be.
    if (!remembered && effective.kind !== "nearest") return;
    if (effective.kind === "ranking" && guess === "ks2") return;
    let live = true;
    (async () => {
      if (remembered) void fetchSavedSets(supabase, urn, remembered);
      if (effective.kind === "saved") return;
      const token = await freshToken();
      if (!token || !live) return;
      void cachedFetchJson("/api/teacher/chooser-set", { token, method: "POST", body: chooserBody(urn, guess, effective) }).catch(() => undefined);
    })();
    return () => {
      live = false;
    };
  }, [urn, phase === null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!urn || !phase) return;
    let live = true;
    (async () => {
      if (effective.kind === "saved") {
        if (!savedSets) return;
        const s = savedSets.sets.find((x) => x.id === effective.id);
        if (!s) {
          // A saved set that has gone: back to the default.
          setChoice({ kind: "nearest" });
          return;
        }
        if (live) setResolved({ key, set: { kind: "saved", label: s.name, urns: s.rows.map((r) => r.urn).filter((u) => u !== urn) } });
        return;
      }
      const token = await freshToken();
      if (!token) return;
      // One quiet retry (a busy or restarting server answers 502 now and then) before the set says it failed.
      // A head start below (the same request, sooner) is shared here through the fetch cache.
      const ask = () => cachedFetchJson<{ rows: { urn: string }[] } & Partial<RankingPopulationResult>>("/api/teacher/chooser-set", { token, method: "POST", body: chooserBody(urn, phase, effective) }).catch(() => ({ ok: false, status: 0, body: null }));
      let res = await ask();
      if (live && (!res.ok || !res.body)) {
        await new Promise((r) => setTimeout(r, 2000));
        res = await ask();
      }
      if (!live) return;
      if (!res.ok || !res.body) {
        console.error(`[smt set] ${effective.kind}: HTTP ${res.status}`);
        setFailedKey(key);
        return;
      }
      const label = effective.kind === "nearest" ? DEFAULT_SET_LABEL : effective.label;
      const b = res.body;
      const rankTable = effective.kind === "ranking" && b.ranking ? { ranking: b.ranking, targetRank: b.targetRank ?? null, ranked: b.ranked ?? b.ranking.length, measure: b.measure ?? "", period: b.period ?? null } : undefined;
      setResolved({ key, set: { kind: effective.kind, label, urns: b.rows.map((r) => r.urn).filter((u) => u !== urn) }, rankTable });
    })();
    return () => {
      live = false;
    };
  }, [key, tries]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = useCallback(
    (c: ChooserChoice | { kind: "nearest" }) => {
      if (!urn) return;
      setLinked(null);
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("set")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("set");
        url.searchParams.delete("setLabel");
        url.searchParams.delete("subject");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
      setChoice(c);
      try {
        window.localStorage.setItem(KEY(urn), JSON.stringify(c));
      } catch {
        // As above: this visit only.
      }
    },
    [urn],
  );

  return { choice: effective, set: resolved?.key === key ? resolved.set : null, savedSets, linked: !!linked, choose, reloadSaved, rankTable: resolved?.key === key ? (resolved.rankTable ?? null) : null, failed: failedKey === key && resolved?.key !== key, retry };
}
