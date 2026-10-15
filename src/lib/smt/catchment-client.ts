"use client";

// VicData 0.8 SMT round 4 (Guy's decision, 15 Oct): the school's catchment read in the browser, under the
// member's own session -- for Admissions' list editor, whose leads needn't hold the SMT role that
// /api/smt/catchment asks for. The saved km comes from school_catchment (the app DB's RLS: the school's
// approved members read it); the default and cap from the school's type (public schools table), by the
// same rules as SMT (catchment.ts). A school's sixth form is read from its statutory high age here (SMT
// also counts Post-16 results; logged).
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { catchmentCapKm, catchmentDefaultKm, type CatchmentSchool } from "./catchment";

export type SchoolCatchment = { km: number; saved: boolean; capKm: number };

export function useSchoolCatchment(urn: string): SchoolCatchment | null {
  const [c, setC] = useState<SchoolCatchment | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const [{ data: sch }, { data: acct }] = await Promise.all([
        supabase.from("schools").select("establishment_type_group, establishment_type, statutory_high_age").eq("urn", urn).maybeSingle<{ establishment_type_group: string | null; establishment_type: string | null; statutory_high_age: number | null }>(),
        supabase.from("school_accounts").select("id").eq("school_urn", urn).maybeSingle<{ id: string }>(),
      ]);
      const school: CatchmentSchool = {
        independent: sch?.establishment_type_group === "Independent schools" && sch?.establishment_type !== "City technology college",
        high: sch?.statutory_high_age ?? null,
        phases: { post16: false },
      };
      let saved: number | null = null;
      if (acct?.id) {
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
