"use client";

// Leighton Park prep (20 Nov): the Admissions home's sets panel, on the Admissions home and SMT's Admissions tab --
// built like SMT's comparison panel (smt-sets-panel.tsx). One pane that
//   (a) picks the entry point first (both sets belong to one),
//   (b) shows the two sets side by side, each in its own shade of blue and saying which walk it drives:
//       Feeder schools (Pipelines: who could join us) and Rivals (Market share: who we compete with),
//       each a list -- VicData default, School sets, My sets -- with the one in use highlighted and ticked,
//   (c) draws both on one map (the school ringed, feeders and rivals in their colours), and
//   (d) under the map, says what each set is and lists its schools.
// The picks are remembered per school and entry point in this browser and carried into the walks, the tiles'
// figures and the dashboard (&fset= / &rset=, which every Admissions route reads). Admissions makes the sets;
// anyone else here (SMT, a governor) switches between them, with a note saying so.
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import { getJson as admissionsGet } from "@/components/admissions/api";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { entryPoint } from "@/lib/admissions/entry-points";
import { guidedHref } from "@/lib/sets/guided";
import type { AdmissionsMenu, SetChoice } from "@/lib/sets/admissions-page";
import { Spinner } from "@/components/shell/LoadingGraphic";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });

type Kind = "feeders" | "compared_against";

/** The two shades of blue: Admissions' cyan for feeders, a deeper blue for rivals. Hex (Leaflet takes no CSS
 * variables), readable as fills on the light basemap and as borders on either field. */
export const SET_BLUE: Record<Kind, { hex: string; rgb: string; label: string; walk: string; noun: string }> = {
  feeders: { hex: "#22b8e0", rgb: "34,184,224", label: "Feeder schools", walk: "Pipelines: how many children could join us", noun: "feeder" },
  compared_against: { hex: "#3b6ff5", rgb: "59,111,245", label: "Rivals", walk: "Market share: what share we win, and against whom", noun: "rivals" },
};

/** The picks, per school and entry point, in this browser: a set key for each kind (null: the school's own). */
export type AdmissionsPicks = { fset: string | null; rset: string | null };
const PICKS_KEY = (urn: string, entry: string) => `vicdata.adm.home.sets:${urn}:${entry}`;
export function readPicks(urn: string, entry: string | null): AdmissionsPicks {
  if (!entry || typeof window === "undefined") return { fset: null, rset: null };
  try {
    const v = JSON.parse(window.localStorage.getItem(PICKS_KEY(urn, entry)) ?? "null") as AdmissionsPicks | null;
    return { fset: typeof v?.fset === "string" ? v.fset : null, rset: typeof v?.rset === "string" ? v.rset : null };
  } catch {
    return { fset: null, rset: null };
  }
}
export function writePicks(urn: string, entry: string, p: AdmissionsPicks) {
  try {
    window.localStorage.setItem(PICKS_KEY(urn, entry), JSON.stringify(p));
  } catch {
    // Blocked storage: this visit only.
  }
}

/** A set in words: how many, why (a default's own "how", else who chose it), the schools A to Z ("; " between). */
const CREATOR: Record<string, string> = { admissions: "Admissions", smt: "SMT", school_admin: "the School-Admin", me: "you", default: "VicData", group: "the school's group", victoria_consultancy: "Victoria Consultancy" };
export function admissionsSetStory(kind: Kind, entryLabel: string, c: Pick<SetChoice, "name" | "count" | "block" | "creator" | "how" | "main">): string {
  const n = `${c.count.toLocaleString("en-GB")} ${c.count === 1 ? "school" : "schools"}`;
  const what = kind === "feeders" ? `Feeder schools at ${entryLabel}` : `Rivals at ${entryLabel}`;
  const main = kind === "feeders" && c.main ? `, ${c.main} of them main feeders` : "";
  const why = c.block === "default" ? (c.how ? `matched by VicData: ${c.how.replace(/\.$/, "")}` : "VicData's default") : `chosen by ${CREATOR[c.creator] ?? "the school"} as "${c.name}"`;
  return `${what}: ${n}${main}, ${why}.`;
}

const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const FeederIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12h12M11 7l5 5-5 5M20 4v16" />
  </svg>
);
const RivalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="7" cy="12" r="4" />
    <circle cx="17" cy="12" r="4" />
  </svg>
);

function useMenu(urn: string, entry: string | null, kind: Kind, key: string | null) {
  const [menu, setMenu] = useState<{ ask: string; m: AdmissionsMenu | "error" } | null>(null);
  const ask = entry ? `/api/admissions/sets?urn=${urn}&entry=${encodeURIComponent(entry)}&kind=${kind}${key ? `&key=${encodeURIComponent(key)}` : ""}` : null;
  useEffect(() => {
    if (!ask) return;
    let live = true;
    void admissionsGet<AdmissionsMenu>(ask).then((r) => live && setMenu({ ask, m: r.status === "ready" ? r.data : "error" }));
    return () => {
      live = false;
    };
  }, [ask]);
  return menu && menu.ask === ask ? menu.m : null;
}

function SetColumn({ kind, menu, picked, onPick, makeHref }: { kind: Kind; menu: AdmissionsMenu | "error" | null; picked: string | null; onPick: (key: string | null) => void; makeHref: string | null }) {
  const blue = SET_BLUE[kind];
  const current = menu && menu !== "error" ? menu.current : null;
  const selected = current?.key ?? picked;
  const groups = menu && menu !== "error" ? ([["VicData default", menu.default], ["School sets", menu.school], ["My sets", menu.mine]] as const).filter(([, rows]) => rows.length) : [];
  return (
    <div data-adm-set-column={kind} className="flex flex-col gap-3 rounded-[12px] border-2 p-3" style={{ borderColor: `rgba(${blue.rgb},0.55)`, background: `rgba(${blue.rgb},0.06)` }}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#0b1220]" style={{ background: blue.hex }}>
          {kind === "feeders" ? <FeederIcon /> : <RivalIcon />}
        </span>
        <span className="min-w-0">
          <span className="block text-[15.5px] font-semibold">{blue.label}</span>
          <span className="block text-[12.5px] text-[var(--muted2)]">{blue.walk}</span>
        </span>
      </div>
      {!menu ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--muted2)]">
          <Spinner size={14} /> Loading the sets…
        </p>
      ) : menu === "error" ? (
        <p className="text-[13px] text-[var(--muted2)]">The {blue.noun} sets didn&rsquo;t load. The Admissions dashboard lists them.</p>
      ) : (
        <div className="flex flex-col gap-3" role="radiogroup" aria-label={blue.label}>
          {groups.map(([title, rows]) => (
            <div key={title} className="flex flex-col gap-1.5">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted2)]">{title}</p>
              <ul className="flex flex-col gap-1.5">
                {rows.map((r) => {
                  const on = r.key === selected;
                  return (
                    <li key={r.key}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-adm-set-row={r.key}
                        onClick={() => onPick(r.key)}
                        className="flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-[14px]"
                        style={on ? { borderColor: blue.hex, background: `rgba(${blue.rgb},0.18)`, fontWeight: 600 } : { borderColor: "var(--panel-border2)" }}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#0b1220]" style={on ? { background: blue.hex } : { border: "1px solid var(--panel-border2)" }}>
                          {on && <Tick />}
                        </span>
                        <span className="min-w-0 flex-grow truncate">{r.name}</span>
                        <span className="shrink-0 text-[12px] font-normal tabular-nums text-[var(--muted2)]">
                          {r.count} {r.count === 1 ? "school" : "schools"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {makeHref && (
        <Link href={makeHref} data-adm-set-make={kind} className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-[#0b1220] hover:opacity-90" style={{ background: blue.hex }}>
          <span aria-hidden="true">+</span> Make a {blue.noun} set
        </Link>
      )}
    </div>
  );
}

type Located = { urn: string; name: string; easting: number | null; northing: number | null };

export function AdmissionsSetsPanel({
  urn,
  schoolName,
  entries,
  entry,
  onEntry,
  picks,
  onPicks,
  canMake,
  readOnly,
  urnsOf,
}: {
  urn: string;
  schoolName: string | null;
  entries: string[] | null;
  entry: string | null;
  onEntry: (e: string) => void;
  picks: AdmissionsPicks;
  onPicks: (p: AdmissionsPicks) => void;
  /** Admissions makes the school's sets; anyone else here switches between them. */
  canMake: boolean;
  readOnly: boolean;
  /** Each set's schools, from the pipeline and market answers the home already holds (setChoices.urns). */
  urnsOf: { feeders: string[] | null; rivals: string[] | null };
}) {
  const fMenu = useMenu(urn, entry, "feeders", picks.fset);
  const rMenu = useMenu(urn, entry, "compared_against", picks.rset);
  const label = entry ? (entryPoint(entry)?.label ?? entry) : "";
  const make = (kind: Kind) => (canMake && !readOnly && entry ? guidedHref({ urn, kind, product: "admissions", entry, fromHome: true }) : null);
  // Where the school and both sets' schools are (the public schools table), for the one map.
  const want = useMemo(() => Array.from(new Set([urn, ...(urnsOf.feeders ?? []), ...(urnsOf.rivals ?? [])])), [urn, urnsOf.feeders, urnsOf.rivals]);
  const [places, setPlaces] = useState<Map<string, Located>>(new Map());
  useEffect(() => {
    const missing = want.filter((u) => !places.has(u));
    if (!missing.length) return;
    let live = true;
    void (async () => {
      const got = new Map(places);
      for (let i = 0; i < missing.length; i += 150) {
        const { data } = await createBrowserSupabaseClient().from("schools").select("urn, current_name, easting, northing").in("urn", missing.slice(i, i + 150));
        for (const r of (data ?? []) as { urn: string; current_name: string; easting: number | null; northing: number | null }[]) got.set(r.urn, { urn: r.urn, name: r.current_name, easting: r.easting, northing: r.northing });
      }
      if (live) setPlaces(got);
    })();
    return () => {
      live = false;
    };
  }, [want.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const fSet = new Set(urnsOf.feeders ?? []);
  const rSet = new Set(urnsOf.rivals ?? []);
  const members: ConsortiumMapMember[] = want
    .map((u) => places.get(u))
    .filter((p): p is Located => !!p && p.easting !== null && p.northing !== null)
    .map((p) => ({ urn: p.urn, name: p.name, easting: p.easting!, northing: p.northing!, roll: null }));
  const namesOf = (urns: string[] | null) => (urns ?? []).filter((u) => u !== urn).map((u) => places.get(u)?.name).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b, "en-GB"));
  const current = (m: AdmissionsMenu | "error" | null) => (m && m !== "error" ? m.current : null);
  const fNow = current(fMenu);
  const rNow = current(rMenu);
  const pick = (kind: Kind, key: string | null) => onPicks(kind === "feeders" ? { ...picks, fset: key } : { ...picks, rset: key });
  return (
    <section data-adm-sets="" aria-labelledby="adm-sets-h" className="fd-tile flex flex-col gap-4 rounded-[14px] px-5 py-5 text-[var(--fg)]">
      <div className="flex flex-col gap-1">
        <h2 id="adm-sets-h" className="text-[17px] font-semibold">Who feeds us, and who do we compete with?</h2>
        <p className="max-w-[780px] text-[13.5px] leading-relaxed text-[var(--muted2)]">
          The two walks above use two sets of schools at each entry point: the <b style={{ color: SET_BLUE.feeders.hex }}>feeder schools</b> the pool of children is counted from, and the <b style={{ color: SET_BLUE.compared_against.hex }}>rivals</b> {schoolName ?? "the school"}&rsquo;s share is measured against. Pick the entry point, then a set of each.
        </p>
        {!canMake && <p className="max-w-[780px] text-[13px] leading-relaxed text-[var(--muted2)]">Admissions makes and looks after the school&rsquo;s feeder and rival sets. You can switch between them here; to change one, ask your Admissions team.</p>}
      </div>
      {entries && entries.length > 0 && (
        <div role="group" aria-label="Entry point" className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--muted2)]">Entry point</span>
          {entries.map((e) => (
            <button
              key={e}
              type="button"
              data-entry-switch={e}
              aria-pressed={e === entry}
              onClick={() => onEntry(e)}
              className={`min-h-[44px] rounded-full border px-4 text-[14px] sm:min-h-[36px] ${e === entry ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.18)] font-semibold" : "border-[var(--panel-border2)] hover:border-[var(--accent)]"}`}
            >
              {entryPoint(e)?.label ?? e}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SetColumn kind="feeders" menu={fMenu} picked={picks.fset} onPick={(k) => pick("feeders", k)} makeHref={make("feeders")} />
        <SetColumn kind="compared_against" menu={rMenu} picked={picks.rset} onPick={(k) => pick("compared_against", k)} makeHref={make("compared_against")} />
      </div>
      <div className="flex flex-col gap-2" data-adm-sets-map="">
        {members.length > 1 ? (
          <ConsortiumMap
            members={members}
            targetUrn={urn}
            pageScroll
            redrawKey={`${[...fSet].join(",")}|${[...rSet].join(",")}`}
            heightClass="h-[360px] w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]"
            markerOf={(m) => {
              if (m.urn === urn) return { radius: 9, color: "#c2410c", fillColor: "#ffffff", fillOpacity: 0.9, weight: 4 };
              const both = fSet.has(m.urn) && rSet.has(m.urn);
              const k: Kind = rSet.has(m.urn) && !fSet.has(m.urn) ? "compared_against" : "feeders";
              return { radius: both ? 8 : 6, color: both ? SET_BLUE.compared_against.hex : SET_BLUE[k].hex, fillColor: SET_BLUE[k].hex, fillOpacity: 0.75, weight: both ? 3 : 1.5 };
            }}
            tooltipOf={(m) => `<b>${m.name.replace(/[&<>"]/g, "")}</b><br>${m.urn === urn ? "this school" : [fSet.has(m.urn) ? "feeder" : null, rSet.has(m.urn) ? "rival" : null].filter(Boolean).join(" and ")}`}
          />
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-[10px] border border-[var(--panel-border)] text-[13px] text-[var(--muted2)]">
            <span className="flex items-center gap-2">
              <Spinner size={16} /> Loading the map…
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          <span className="inline-flex items-center gap-1.5"><span className="h-[11px] w-[11px] rounded-full border-[3px] border-[#c2410c] bg-white" />{schoolName ?? "The school"}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-[10px] w-[10px] rounded-full" style={{ background: SET_BLUE.feeders.hex }} />Feeder schools</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-[10px] w-[10px] rounded-full" style={{ background: SET_BLUE.compared_against.hex }} />Rivals</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-[12px] w-[12px] rounded-full border-[3px]" style={{ borderColor: SET_BLUE.compared_against.hex, background: SET_BLUE.feeders.hex }} />Both</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed" data-adm-sets-story="">
        {([["feeders", fNow, urnsOf.feeders], ["compared_against", rNow, urnsOf.rivals]] as const).map(([kind, c, urns]) =>
          c ? (
            <div key={kind} className="border-l-4 pl-3" style={{ borderColor: SET_BLUE[kind].hex }}>
              <p>{admissionsSetStory(kind, label, c)}</p>
              {namesOf(urns).length > 0 && (
                <p className="text-[var(--muted2)]">
                  <span className="font-semibold text-[var(--fg)]">Schools in the set:</span> {namesOf(urns).join("; ")}.
                </p>
              )}
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}
