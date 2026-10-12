"use client";

// VicData 0.7 admissions r3 (F2): is this school a boarding school (GIAS, isBoardingSchool)? For
// the editor's preview school; null until known, or with no school.
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { isBoardingSchool } from "@/lib/admissions/boarding";

export function useBoardingSchool(urn: string | null): boolean | null {
  const [state, setState] = useState<{ urn: string; boarding: boolean } | null>(null);
  useEffect(() => {
    if (!urn) return;
    let live = true;
    createBrowserSupabaseClient()
      .from("schools")
      .select("boarders_name")
      .eq("urn", urn)
      .maybeSingle<{ boarders_name: string | null }>()
      .then(({ data }) => {
        if (live) setState({ urn, boarding: isBoardingSchool(data?.boarders_name) });
      });
    return () => {
      live = false;
    };
  }, [urn]);
  return urn && state?.urn === urn ? state.boarding : null;
}
