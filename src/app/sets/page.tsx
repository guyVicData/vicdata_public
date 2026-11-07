"use client";

// VicData 0.8 sets round 1 (D18): the library -- every set a person can use at their school, in one
// place: the default sets, the school's sets and their own (src/components/sets/SetsLibrary.tsx).
// ?urn picks the school (else their first); ?kind, ?entry and ?phase open it filtered to the page that
// sent them here (a set menu's Manage sets).
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SetsLibrary } from "@/components/sets/SetsLibrary";
import { SetsShell, useSetsMember } from "@/components/sets/SetsShell";
import { entryOfPhase } from "@/lib/sets/model";
import type { LibraryData } from "@/lib/sets/library";
import type { LibraryFilter } from "@/lib/sets/library-view";

function Library() {
  const sp = useSearchParams();
  const m = useSetsMember(sp.get("urn"));
  const [data, setData] = useState<LibraryData | null | "error">(null);
  useEffect(() => {
    if (m.status !== "ready") return;
    (async () => {
      const r = await fetch(`/api/sets/library?urn=${m.member.urn}`, { headers: { Authorization: `Bearer ${m.member.token}` } });
      setData(r.ok ? ((await r.json()) as LibraryData) : "error");
    })();
  }, [m]);
  const kind = sp.get("kind") === "feeders" ? "feeders" : sp.get("kind") === "compared_against" ? "compared_against" : "all";
  const sectionParam = sp.get("section") ?? "";
  const section = (["default", "school", "mine", "archived"].includes(sectionParam) || /^folder:.{1,80}$/.test(sectionParam) ? sectionParam : null) as LibraryFilter["section"] | null;
  const entry = sp.get("entry") ?? entryOfPhase(sp.get("phase") === "ks5" ? "ks5" : sp.get("phase") === "ks4" ? "ks4" : null);
  return (
    <SetsShell>
      {(phone) =>
        m.status === "error" ? (
          <p className="p-6 text-[13px] text-[var(--muted2)]">{m.message}</p>
        ) : !data || m.status !== "ready" ? (
          <p className="p-6 text-[13px] text-[var(--muted2)]">Loading your sets…</p>
        ) : data === "error" ? (
          <p className="p-6 text-[13px] text-[var(--muted2)]">Could not read the sets.</p>
        ) : (
          <SetsLibrary key={data.school.urn} data={data} phone={phone} initial={{ kind, entry: entry && data.entries.includes(entry) ? entry : null, query: sp.get("q") ?? "", ...(section ? { section } : {}) }} />
        )
      }
    </SetsShell>
  );
}

export default function SetsLibraryPage() {
  return (
    <Suspense fallback={null}>
      <Library />
    </Suspense>
  );
}
