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

export type SmtSetState = {
  choice: Stored;
  set: SmtSetChoice | null; // null while it resolves
  savedSets: SavedSetsPayload | null;
  linked: boolean;
  choose: (c: ChooserChoice | { kind: "nearest" }) => void;
  reloadSaved: () => Promise<void>;
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

  const [resolved, setResolved] = useState<{ key: string; set: SmtSetChoice } | null>(null);
  const effective: Stored = linked ? { kind: "urns", label: linked.label, urns: linked.urns } : choice;
  const key = JSON.stringify([urn, phase, effective, effective.kind === "saved" ? !!savedSets : null]);
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
      const set = effective.kind === "nearest" ? { kind: "nearest" } : effective.kind === "urns" ? { kind: "urns", urns: effective.urns } : { kind: "ranking", filters: effective.filters };
      const res = await cachedFetchJson<{ rows: { urn: string }[] }>("/api/teacher/chooser-set", { token, method: "POST", body: JSON.stringify({ urn, phase, set }) });
      if (!live || !res.ok || !res.body) return;
      const label = effective.kind === "nearest" ? DEFAULT_SET_LABEL : effective.label;
      setResolved({ key, set: { kind: effective.kind, label, urns: res.body.rows.map((r) => r.urn).filter((u) => u !== urn) } });
    })();
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return { choice: effective, set: resolved?.key === key ? resolved.set : null, savedSets, linked: !!linked, choose, reloadSaved };
}
