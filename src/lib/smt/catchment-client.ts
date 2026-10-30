"use client";

// VicData 0.8 SMT round 4 (Guy's decision, 15 Oct): the school's catchment read in the browser, under the
// member's own session -- for Admissions' list editor, whose leads needn't hold the SMT role that
// /api/smt/catchment asks for. The saved km comes from school_catchment (the app DB's RLS: the school's
// approved members read it); the default and cap from the school's type (public schools table) and, for a
// state school, its density radius, by the same rules as SMT (catchment.ts). A school's sixth form is read from its statutory high age here (SMT
// also counts Post-16 results; logged).
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchViewedSchool, getActiveViewAs } from "@/lib/view-as";
import { catchmentCapKm, catchmentDefaultKm, densityKmOf, densityPhase, type CatchmentSchool, type NearSchool } from "./catchment";

export type SchoolCatchment = { km: number; saved: boolean; capKm: number };

export function useSchoolCatchment(urn: string): SchoolCatchment | null {
  const [c, setC] = useState<SchoolCatchment | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const [{ data: sch }, { data: acct }] = await Promise.all([
        supabase.from("schools").select("establishment_type_group, establishment_type, statutory_low_age, statutory_high_age").eq("urn", urn).maybeSingle<{ establishment_type_group: string | null; establishment_type: string | null; statutory_low_age: number | null; statutory_high_age: number | null }>(),
        supabase.from("school_accounts").select("id").eq("school_urn", urn).maybeSingle<{ id: string }>(),
      ]);
      const independent = sch?.establishment_type_group === "Independent schools" && sch?.establishment_type !== "City technology college";
      // 0.8 Admissions fb1: a state school's default is its density radius, from the same public
      // nearest_schools the server reads (catchment.ts's rule, so the two never differ).
      const phase = densityPhase(sch?.statutory_low_age ?? null, sch?.statutory_high_age ?? null);
      let densityKm: number | null = null;
      if (!independent && phase) {
        const { data: near } = await supabase.rpc("nearest_schools", { p_urn: urn, p_limit: 400, p_relax_sector: true });
        densityKm = densityKmOf(urn, phase, (near ?? []) as NearSchool[]);
      }
      const school: CatchmentSchool = { independent, high: sch?.statutory_high_age ?? null, phases: { post16: false }, densityKm };
      let saved: number | null = null;
      // 0.8 View as: the platform admin's own RLS reads no other school's account or catchment; the one
      // caller helper reads them on the server once it has confirmed a platform admin.
      const viewing = getActiveViewAs();
      if (viewing && viewing.urn === urn) saved = (await fetchViewedSchool(supabase, urn))?.catchmentKm ?? null;
      else if (acct?.id) {
        const { data, error } = await supabase.from("school_catchment").select("km").eq("school_account_id", acct.id).maybeSingle<{ km: number }>();
        if (!error) saved = data?.km ?? null;
      }
      const cap = catchmentCapKm(school);
      if (live) setC({ km: saved !== null ? Math.min(saved, cap) : catchmentDefaultKm(school), saved: saved !== null, capKm: cap });
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [urn]);
  return c;
}
