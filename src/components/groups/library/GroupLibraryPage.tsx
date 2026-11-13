"use client";

// VicData 0.8 group sets, M3: one group's page in the library, like an album page (brief v2 §4): the
// header (artwork, name, type and size, regions, source, likely members, its same-type rank), its
// headline per phase against England, its schools as the tracklist (name, LA, phase, roll, headline; a
// special, AP, PRU or nursery school tagged "not in group figures"), and a map. Read-only; Back returns
// to the library as it was left. Head office only (/api/group/library/group).
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { AdmissionsTeacherNav } from "@/components/admissions/controls";
import { GroupViewAsBanner } from "@/components/groups/GroupViewAsBanner";
import { groupDashVars } from "@/components/groups/dash/GroupDashboard";
import { useSmt } from "@/components/smt/api";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import { headlineWords, phaseWords, regionWords, rollWords, typeAndSize } from "@/lib/groups/library";
import type { LibraryGroupPage } from "@/lib/groups/library-page";
import { RegionArtwork } from "./GroupLibrary";
import { AddToSet } from "./AddToSet";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });
const SOURCE_WORD: Record<string, string> = { gias_groups: "GIAS", gias: "GIAS", club_iss: "Club ISS", companies_house: "Companies House", gias_proprietor: "GIAS (proprietor)" };
const fmt = (m: string, v: number) => (m === "ks2_rwm" ? `${v.toFixed(0)}%` : m === "ks5_aps_alevel" ? v.toFixed(2) : v.toFixed(1));
const MEASURE_SHORT: Record<string, string> = { ks4_a8: "A8", ks5_aps_alevel: "A-level points", ks2_rwm: "KS2 RWM" };
const yr = (p: number) => `${p}/${String((p + 1) % 100).padStart(2, "0")}`;

export function GroupLibraryPage({ id }: { id: string }) {
  const [theme, setTheme] = useTeacherTheme();
  const search = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const acc = new URLSearchParams();
  for (const k of ["account", "lookAs", "as", "peek"]) {
    const v = search.get(k);
    if (v) acc.set(k, v);
  }
  const back = search.get("back");
  const q = new URLSearchParams(acc);
  q.set("id", id);
  const load = useSmt<LibraryGroupPage & { source: string; viewer?: { as: string; accountId: string } }>(`/api/group/library/group?${q.toString()}`, null);
  const libraryHref = `/teacher/group/groups${back ? `?${back}` : acc.toString() ? `?${acc}` : ""}`;
  return (
    <main id="teacher-root" data-theme={theme} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={groupDashVars(theme)}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-5 sm:px-7">
        <GroupViewAsBanner />
        <AdmissionsTeacherNav schoolUrn={null} theme={theme} onTheme={setTheme} />
        <Link href={libraryHref} className="text-[12px] font-bold text-[var(--group-accent-text)]">← Back to the groups library</Link>
        {load.status === "ready" ? (
          <Page p={load.data} query={acc.toString()} />
        ) : (
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-[13px] text-[var(--muted2)]">{load.status === "loading" ? "Loading the group…" : load.code === 404 ? "Not found." : load.message}</div>
        )}
      </div>
    </main>
  );
}

function Page({ p, query }: { p: LibraryGroupPage & { source: string; viewer?: { as: string; accountId: string } }; query: string }) {
  const c = p.card;
  const ts = typeAndSize(c);
  const members: ConsortiumMapMember[] = useMemo(() => p.schools.filter((s) => s.easting !== null && s.northing !== null).map((s) => ({ urn: s.urn, name: s.name, easting: s.easting!, northing: s.northing!, roll: s.roll })), [p.schools]);
  const phases = (["secondary", "post16", "primary"] as const).filter((ph) => c.schools_by_phase?.[ph] > 0);
  return (
    <div className="flex flex-col gap-4" data-library-group={c.group_id}>
      <header className="flex flex-wrap gap-4 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
        <RegionArtwork regions={c.regions} size={120} label={`Where ${c.displayName}'s schools are: ${regionWords(c)}`} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">{c.displayName}</h1>
          <div className="text-[13px] font-semibold text-[var(--muted)]">
            {ts.line}
            {ts.likely && <span className="ml-2 rounded-full bg-[var(--group-likely-bg)] px-2 py-[1px] text-[11px] font-bold text-[var(--group-likely-fg)]">{ts.likely}</span>}
          </div>
          <div className="text-[12.5px] text-[var(--muted2)]">{regionWords(c)} · {phaseWords(c)}</div>
          <div className="text-[12.5px] text-[var(--fg)]">{rollWords(c)}</div>
          {p.rank && <div className="text-[12.5px] font-bold text-[var(--group-strong)]">{p.rank.text} on {MEASURE_SHORT[p.rank.measure] ?? p.rank.measure} ({yr(p.rank.period)})</div>}
          <div className="text-[11.5px] text-[var(--muted2)]">Source: {SOURCE_WORD[c.source] ?? c.source}{p.isUs ? " · this is your own group" : ""}</div>
        </div>
        <div className="flex min-w-[220px] flex-col gap-1 text-[12.5px]">
          {phases.length ? phases.map((ph) => {
            const h = headlineWords(c, ph);
            return <div key={ph} className={h.value === null ? "italic text-[var(--muted2)]" : "font-semibold"}>{h.text}{h.value !== null && c.headline[ph]?.period ? <span className="font-normal text-[var(--muted2)]"> · {yr(c.headline[ph]!.period!)}</span> : null}</div>;
          }) : <div className="italic text-[var(--muted2)]">{headlineWords(c, "all").text}</div>}
          <div className="mt-1">
            {!p.isUs && <AddToSet groupId={c.group_id} account={p.viewer?.accountId ?? ""} query={query} readOnly={p.viewer?.as !== "head_office"} />}
          </div>
        </div>
      </header>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
          <div className="mb-2 text-[13px] font-bold">{p.schools.length ? `Its ${p.schools.length} schools` : "Its schools"}</div>
          {p.schools.length ? (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted2)]">
                  <th className="py-1 pr-2">School</th>
                  <th className="py-1 pr-2">LA</th>
                  <th className="py-1 pr-2">Phase</th>
                  <th className="py-1 pr-2 text-right">Roll</th>
                  <th className="py-1">Headline</th>
                </tr>
              </thead>
              <tbody>
                {p.schools.map((s) => (
                  <tr key={s.urn} className="border-t border-[var(--panel-border)]" data-urn={s.urn}>
                    <td className="py-1.5 pr-2 font-semibold">
                      <Link href={`/schools/${s.urn}`} className="hover:underline">{s.name}</Link>
                      {s.likely && <span className="ml-1.5 rounded-full bg-[var(--group-likely-bg)] px-1.5 text-[10px] font-bold text-[var(--group-likely-fg)]">likely</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-[var(--muted)]">{s.la ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-[var(--muted)]">{s.phases.join(", ") || "—"}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{s.roll !== null ? s.roll.toLocaleString("en-GB") : "—"}</td>
                    <td className="py-1.5">{s.headline ? `${MEASURE_SHORT[s.headline.measure] ?? s.headline.measure} ${fmt(s.headline.measure, s.headline.value)}` : <i className="text-[var(--muted2)]">{s.note ?? "no figure"}</i>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-[12.5px] text-[var(--muted2)]">The school list isn&rsquo;t available{p.source === "fixtures" ? " in the test fixtures (Harris and Dukes only)" : " right now"}.</div>
          )}
        </div>
        <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
          <div className="mb-2 text-[13px] font-bold">Where its schools are</div>
          {members.length ? (
            <ConsortiumMap members={members} targetUrn="" heightClass="h-[360px] w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]" tooltipOf={(x) => `${x.name}${x.roll !== null ? ` — ${x.roll.toLocaleString("en-GB")} pupils` : ""}`} />
          ) : (
            <div className="text-[12.5px] text-[var(--muted2)]">No located schools to draw.</div>
          )}
        </div>
      </section>
    </div>
  );
}
