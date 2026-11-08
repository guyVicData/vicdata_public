"use client";

// VicData 0.8 SMT Academic by qualification: Academic's state -- the level (GCSE, Post-16), the mode
// (Results · Entries · Value added), the Post-16 group and DfE's applied type, the GCSE area -- held in
// the address (?level=&mode=&group=&applied=&area=) and remembered for the user between visits, as the
// level was. What the school offers is the route's to say (it answers with the state it resolved, an old
// ?level=whole falling back to the main level), so the page asks for what's in the address and draws
// what comes back.
import { useState } from "react";
import type { AcademicMode, AcademicPhase, AppliedType, QualGroup } from "@/lib/smt/qual-groups";

export type AcademicAsk = { level: string | null; mode: AcademicMode; group: QualGroup | null; applied: AppliedType | null; area: string | null };

const KEY = (urn: string) => `vicdata.smt.academic:${urn}`;
const MODES = new Set(["results", "entries", "va"]);

function read(sp: URLSearchParams): AcademicAsk {
  const m = sp.get("mode");
  const a = sp.get("applied");
  return { level: sp.get("level"), mode: m && MODES.has(m) ? (m as AcademicMode) : "results", group: (sp.get("group") as QualGroup | null) ?? null, applied: a === "ag" || a === "tl" ? a : null, area: sp.get("area") };
}

export function useAcademicAsk(urn: string): [AcademicAsk, (patch: Partial<AcademicAsk> & { level?: AcademicPhase | string | null }) => void] {
  const [ask, setAsk] = useState<AcademicAsk>(() => {
    if (typeof window === "undefined") return read(new URLSearchParams());
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("mode") || sp.has("group")) return read(sp);
    try {
      const saved = window.localStorage.getItem(KEY(urn));
      // The address's level wins over the remembered one (another dashboard's chip may have set it).
      if (saved) return { ...read(new URLSearchParams(saved)), ...(sp.has("level") ? { level: sp.get("level") } : {}) };
    } catch {
      // Blocked storage: the defaults.
    }
    return read(sp);
  });
  const set = (patch: Partial<AcademicAsk>) => {
    const next = { ...ask, ...patch };
    // A new level or group starts its own area / applied type afresh.
    if (patch.level !== undefined && patch.level !== ask.level) next.area = patch.area ?? null;
    const q: Record<string, string> = {};
    if (next.level) q.level = next.level;
    q.mode = next.mode;
    if (next.group) q.group = next.group;
    if (next.applied) q.applied = next.applied;
    if (next.area) q.area = next.area;
    const sp = new URLSearchParams(window.location.search);
    for (const k of ["level", "mode", "group", "applied", "area"]) sp.delete(k);
    for (const [k, v] of Object.entries(q)) sp.set(k, v);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${sp.toString()}`);
    try {
      window.localStorage.setItem(KEY(urn), new URLSearchParams(q).toString());
    } catch {
      // As above.
    }
    setAsk(next);
  };
  return [ask, set];
}
