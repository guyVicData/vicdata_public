"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import TypologyTags from "./TypologyTags";
import type { SchoolTypology } from "@/lib/typology";

type ListedSchool = {
  urn: string;
  currentName: string;
  town: string | null;
  postcode: string | null;
  totalRoll: number;
  typology: SchoolTypology;
};

// Member-tier named surrounding-schools list (chart palette doc, "Public View
// rebuild"): "verification, not just scanning" -- lets a verified member see the 10
// schools' own tags and visually confirm the free-tier aggregate is genuinely
// like-with-like, not take the matching on faith. Same unauthorized/loading pattern
// as PaidTrendsSection -- silently shows nothing rather than a broken-looking gate
// when logged out, since the free-tier summary above it already carries the join
// prompt copy.
export default function SurroundingSchoolsMemberList({ urn }: { urn: string }) {
  const supabase = createBrowserSupabaseClient();
  const [state, setState] = useState<"loading" | "unauthorized" | "loaded">("loading");
  const [schools, setSchools] = useState<ListedSchool[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setState("unauthorized");
        return;
      }
      const res = await fetch(`/api/surrounding-schools-list?urn=${urn}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setState("unauthorized");
        return;
      }
      const body = await res.json();
      setSchools(body.schools ?? []);
      setState("loaded");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn]);

  if (state === "loading" || state === "unauthorized") return null;
  if (schools.length === 0) return null;

  return (
    <div className="mt-4">
      <ul className="space-y-2">
        {schools.map((s) => (
          <li
            key={s.urn}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 p-2.5 text-sm dark:border-neutral-800"
          >
            <div>
              <p className="font-medium">{s.currentName}</p>
              <p className="text-xs text-neutral-500">
                {[s.town, s.postcode].filter(Boolean).join(", ")} — {s.totalRoll.toLocaleString()} pupils
              </p>
            </div>
            <TypologyTags typology={s.typology} />
          </li>
        ))}
      </ul>
    </div>
  );
}
