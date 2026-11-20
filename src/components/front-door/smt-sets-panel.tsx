"use client";

// Leighton Park prep (20 Nov): the SMT home's comparison panel. One pane that (a) says what the set is for --
// the walks above set the school against it -- (b) lists the choices on the left, the one in use highlighted
// and ticked, picking one changes the set for the home, the walks and the SMT dashboards at once (useSmtSet,
// the dashboard's own choice and store), (c) shows who is in it: a small set on the dashboard's own set map
// (SetMap, from the Overview answer the home already holds), a large one in words, and (d) opens the set
// builder to make your own.
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchDefaultLists } from "@/components/teacher/chooser/data";
import type { Overview } from "@/components/smt/api";
import type { SmtSetState } from "@/components/smt/useSmtSet";
import { DEFAULT_SET_LABEL } from "@/components/smt/useSmtSet";
import { smtVars } from "@/components/smt/ui";
import { SetMap, TREND_HEX } from "@/components/smt/views/SetMap";
import { RollIndexed } from "@/components/smt/views/Lines";
import { periodLabel, ROLL_DIRECTION_SPAN, ROLL_WORD } from "@/catalogue/years";
import { NEAREST_KEY, rankingKey, teacherEditorHref, teacherMenuRows } from "@/components/sets/teacherMenu";
import type { SetMenuRow } from "@/components/sets/SetSelector";
import { guidedHref } from "@/lib/sets/guided";
import { defaultRankingFilters, NATIONAL, type RankingFilters } from "@/lib/comparator-chooser";
import { chunkedRankingDisplay } from "@/lib/data-view-cards";
import { Spinner } from "@/components/shell/LoadingGraphic";
import { featuredRow } from "@/components/shell/accent";
import type { Theme } from "@/components/shell/TeacherChrome";

/** Up to this many schools, the set is drawn on its map; more than that reads as a cloud of dots. */
export const SET_MAP_MAX = 40;

/** English regions take "the" ("the South East"); London doesn't. */
export const regionWords = (name: string | null) => (name ? (name === "London" ? "London" : `the ${name}`) : "the region");

/** A one-click VicData default beyond the 10 nearest: rankings, each a WHOLE population (20 Nov) -- the school's
 * own sector in its region and in England, and every school and college in its region (all sectors). Every school
 * and college in England is too many to benchmark as a set (2,535 at Post-16): the Overview's England ranks are it. */
type DefaultRanking = { key: string; label: string; filters: RankingFilters };
export function defaultRankings(school: { independent: boolean; regionCode?: string | null; regionName: string | null } | null, phase: "ks2" | "ks4" | "ks5" | null = "ks5"): DefaultRanking[] {
  if (!school) return [];
  const sector = school.independent ? "Independent" : "State";
  const filters = (scope: RankingFilters["scope"], sectors: RankingFilters["sectors"]): RankingFilters => ({ ...defaultRankingFilters(scope), sectors });
  const region = school.regionCode && school.regionName ? ({ kind: "region", code: school.regionCode, name: school.regionName } as const) : null;
  const all = phase === "ks5" ? "All sixth forms and colleges" : "All schools";
  return [
    ...(region ? [{ key: "default:region", label: `${sector} schools in ${regionWords(school.regionName)}`, filters: filters(region, [sector]) }] : []),
    { key: "default:nation", label: `${sector} schools in England`, filters: filters(NATIONAL, [sector]) },
    ...(region ? [{ key: "default:region-all", label: `${all} in ${regionWords(school.regionName)}`, filters: filters(region, []) }] : []),
  ];
}

/** The row the set in use ticks: a saved set or ranking by id; the 10 nearest however it was chosen (the
 * dashboard's chooser stores it as a list of schools); a default ranking by its name. "current" when none fits. */
export function smtSetKey(choice: SmtSetState["choice"], defaults: DefaultRanking[] = [], laLabel: string | null = null): string {
  if (choice.kind === "nearest" || (choice.kind === "urns" && choice.label === DEFAULT_SET_LABEL)) return NEAREST_KEY;
  if (choice.kind === "urns" && laLabel && choice.label === laLabel) return "default:la";
  if (choice.kind === "saved") return `saved:${choice.id}`;
  if (choice.kind === "ranking") {
    if (choice.rankingId) return rankingKey(choice.rankingId);
    const d = defaults.find((x) => x.label === choice.label);
    if (d) return d.key;
  }
  return "current";
}

const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** What the set is, in words: who is in it, where, and why they were matched (Leighton Park prep, 20 Nov).
 * Pure, from the set's own recipe -- the chooser's rules (chooser-sets.ts, default-comparator-lists.ts). */
export type SetStoryInput = {
  key: string; // smtSetKey: nearest, default:la, default:region, default:nation, saved:<id>, ranking:<id>, current
  count: number;
  schoolName: string;
  phase: "ks2" | "ks4" | "ks5" | null;
  independent: boolean;
  laName: string | null;
  regionName: string | null;
  saved?: { name: string; creator?: string | null } | null;
  label: string;
  /** A ranking's whole population: the school's place and how many are ranked. */
  ranked?: { rank: number | null; of: number } | null;
};
const ordinalOf = (n: number) => {
  const t = n % 100;
  return `${n.toLocaleString("en-GB")}${t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};
const CREATOR_WORD: Record<string, string> = { admissions: "Admissions", smt: "SMT", school_admin: "the School-Admin", me: "you", teacher: "a teacher", hod: "a head of department", group: "the school's group", victoria_consultancy: "Victoria Consultancy" };
export function setStory(i: SetStoryInput): string {
  const n = `${i.count.toLocaleString("en-GB")} ${i.count === 1 ? "school" : "schools"}`;
  const sector = i.independent ? "independent" : "state";
  const stage = i.phase === "ks5" ? "with a sixth form" : i.phase === "ks4" ? "teaching GCSE" : "of the same phase";
  const measure = i.phase === "ks5" ? "academic points per entry (A level, IB, Pre-U)" : i.phase === "ks4" ? "Attainment 8" : "their headline results";
  const area = i.laName ? `in and around ${i.laName}` : "nearby";
  switch (i.key) {
    case "nearest":
      return `This set includes ${n} ${area}, matched because they are the ${sector} schools ${stage} closest to ${i.schoolName}, across local authority lines (VicData's default).`;
    case "default:la":
      return `This set includes ${n} in ${i.laName ?? "the local authority"}, matched because they are every state and independent school there ${stage} (special schools and alternative provision are left out: they would distort the averages).`;
    case "default:region":
    case "default:nation":
    case "default:region-all": {
      const where = i.key === "default:nation" ? "England" : regionWords(i.regionName);
      const who = i.key === "default:region-all" ? (i.phase === "ks5" ? "sixth forms and colleges, state and independent," : "schools, state and independent,") : `${sector} schools`;
      const results = i.phase === "ks5" ? "academic results (A level, IB or Pre-U)" : i.phase === "ks4" ? "GCSE results" : "results";
      const of = i.ranked?.of ?? i.count + 1;
      const place = i.ranked?.rank ? ` ${i.schoolName} ranks ${ordinalOf(i.ranked.rank)} of ${of.toLocaleString("en-GB")} by ${measure}, and the walks compare it with the middle of them, not the top.` : ` ${i.schoolName} has no published ${measure} to rank.`;
      return `This set includes all ${(of - (i.ranked?.rank ? 1 : 0)).toLocaleString("en-GB")} ${who} in ${where} with published ${results}.${place}`;
    }
  }
  if (i.key.startsWith("saved:") && i.saved) {
    const who = i.saved.creator ? CREATOR_WORD[i.saved.creator] ?? "the school" : "the school";
    return `This set includes ${n}, matched because ${who === "you" ? "you" : who} chose them by hand, as "${i.saved.name}".`;
  }
  if (i.key.startsWith("ranking:")) return `This set includes every school in the ranking "${i.label}" with a published figure${i.ranked?.rank ? `: ${i.schoolName} ranks ${ordinalOf(i.ranked.rank)} of ${i.ranked.of.toLocaleString("en-GB")}` : ""}.`;
  return `This set includes ${n} (${i.label}).`;
}

export function SmtSetsPanel({ urn, schoolName, school = null, phase, sets, o, readOnly, theme, accentInk = "#111" }: { urn: string; schoolName: string; school?: { independent: boolean; regionCode?: string | null; regionName: string | null; laName?: string | null } | null; phase: "ks2" | "ks4" | "ks5" | null; sets: SmtSetState; o: Overview | null; readOnly: boolean; theme: Theme; /** Text on the accent: white on light SMT's deep orange, else near-black. */ accentInk?: string }) {
  const set = sets.set;
  // Rankings are for GCSE and Post-16 (the chooser-set route); a primary school's defaults are the nearest only.
  const defaults = phase === "ks4" || phase === "ks5" ? defaultRankings(school, phase) : [];
  // The schools in the LA, every sector (state, independent, special), as the dashboard's chooser lists them
  // (default-lists' List 2, with the LA's 16+ provision at Post-16), labelled as the chooser labels it.
  const laLabel = school?.laName ? `Schools in ${school.laName}` : null;
  const [laUrns, setLaUrns] = useState<string[] | null>(null);
  useEffect(() => {
    if (!laLabel || !phase) return;
    let live = true;
    void fetchDefaultLists(createBrowserSupabaseClient(), urn, phase === "ks5").then((b) => {
      if (!live || !b) return;
      const out = (b.list2?.schools ?? []).map((x) => x.urn);
      for (const x of b.local16Plus?.schools ?? []) if (!out.includes(x.urn)) out.push(x.urn);
      setLaUrns(out.filter((u) => u !== urn));
    });
    return () => {
      live = false;
    };
  }, [urn, phase, laLabel]);
  const selected = smtSetKey(sets.choice, defaults, laLabel);
  const laRow: SetMenuRow[] = laLabel && (laUrns?.length || selected === "default:la") ? [{ key: "default:la", name: laLabel, count: selected === "default:la" && set ? set.urns.length : (laUrns?.length ?? null), creator: "default" }] : [];
  const menu = teacherMenuRows(sets.savedSets, { nearestLabel: DEFAULT_SET_LABEL, nearestCount: selected === NEAREST_KEY && set ? set.urns.length : 10, hideAdmissions: true });
  const inUse: SetMenuRow[] = selected === "current" ? [{ key: "current", name: set?.label ?? ("label" in sets.choice ? sets.choice.label : "This set"), count: set ? set.urns.length : null, creator: "me" }] : [];
  const groups: { title: string; rows: SetMenuRow[] }[] = [
    { title: "In use now", rows: inUse },
    { title: "VicData default", rows: [...menu.rows.default, ...laRow, ...defaults.map((d): SetMenuRow => ({ key: d.key, name: d.label, count: selected === d.key && set ? set.urns.length : null, creator: "default", countText: selected === d.key && set ? undefined : d.key === "default:nation" ? "national" : "region" }))] },
    { title: "School sets", rows: menu.rows.school },
    { title: "My sets", rows: menu.rows.mine },
  ].filter((g) => g.rows.length);
  const pick = (r: SetMenuRow) => {
    const d = defaults.find((x) => x.key === r.key);
    if (r.key === "current") return;
    if (r.key === "default:la") {
      if (laLabel && laUrns) sets.choose({ kind: "urns", label: laLabel, urns: laUrns });
      return;
    }
    if (d) sets.choose({ kind: "ranking", label: d.label, filters: d.filters, rankingId: null });
    else if (r.key === NEAREST_KEY) sets.choose({ kind: "nearest" });
    else if (r.key.startsWith("saved:")) sets.choose({ kind: "saved", id: r.key.slice(6) });
    else if (r.key.startsWith("ranking:")) {
      const rk = sets.savedSets?.rankings?.find((x) => rankingKey(x.id) === r.key);
      if (rk) sets.choose({ kind: "ranking", label: rk.name, filters: rk.filters, rankingId: rk.id });
    }
  };
  // The map draws the Overview answer for the set now in use (useSmt keys it on the set: never a stale one).
  const oNow = set ? o : null;
  const n = set?.urns.length ?? null;
  const savedId = selected.startsWith("saved:") ? selected.slice(6) : null;
  const savedRow = savedId ? (sets.savedSets?.sets.find((x) => x.id === savedId) ?? null) : null;
  const rt = sets.rankTable;
  const story = set
    ? setStory({ ranked: rt ? { rank: rt.targetRank, of: rt.ranked } : null, key: selected, count: set.urns.length, schoolName, phase, independent: !!school?.independent, laName: school?.laName ?? null, regionName: school?.regionName ?? null, label: set.label, saved: savedRow ? { name: savedRow.name, creator: savedRow.vc ? "victoria_consultancy" : savedRow.group ? "group" : savedRow.mine ? "me" : (savedRow.creator ?? null) } : null })
    : "";
  // The schools by name, A to Z, from the Overview answer for this set (its schools carry their names).
  const names = set && oNow && !rt ? set.urns.map((u) => oNow.schools[u]?.name).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b, "en-GB")) : [];
  // A ranking is a recipe over hundreds of schools, not a list to edit: no edit link.
  const editHref = readOnly || !set || rt ? null : teacherEditorHref({ urn, phase, product: "smt", current: { savedId, name: set.label, urns: set.urns }, fresh: false });
  const builder = phase === "ks4" || phase === "ks5" ? guidedHref({ urn, kind: "compared_against", product: "smt", phase, fromHome: true }) : null;
  return (
    <section data-smt-sets="" aria-labelledby="smt-sets-h" className="fd-tile flex flex-col gap-4 rounded-[14px] px-5 py-5 text-[var(--fg)]">
      <div className="flex flex-col gap-1">
        <h2 id="smt-sets-h" className="text-[17px] font-semibold">Who do we measure ourselves against?</h2>
        <p className="max-w-[760px] text-[13.5px] leading-relaxed text-[var(--muted2)]">
          The walkthroughs above benchmark {schoolName} against a comparison set: the Overview&rsquo;s headlines, the Academic subject rankings and the Pupils figures are each set against these schools. Pick a set here and every SMT walk and dashboard uses it. Context compares with the local authority and England instead.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(240px,320px)_1fr]">
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Comparison set">
          {!sets.savedSets && (
            <p className="flex items-center gap-2 text-[13px] text-[var(--muted2)]">
              <Spinner size={14} /> Loading the sets…
            </p>
          )}
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-1.5">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted2)]">{g.title}</p>
              <ul className="flex flex-col gap-1.5">
                {g.rows.map((r) => {
                  const on = r.key === selected;
                  return (
                    <li key={r.key}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-smt-set-row={r.key}
                        onClick={() => pick(r)}
                        title={r.title}
                        className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-[14px] ${on ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.14)] font-semibold" : "border-[var(--panel-border2)] hover:border-[var(--accent)]"}`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-[var(--accent)] text-[#111]" : "border border-[var(--panel-border2)]"}`}>{on && <Tick />}</span>
                        <span className="min-w-0 flex-grow truncate">{r.name}</span>
                        <span className="shrink-0 text-[12px] font-normal tabular-nums text-[var(--muted2)]">{r.countText ?? (r.count === null ? "ranking" : `${r.count} ${r.count === 1 ? "school" : "schools"}`)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {builder && !readOnly && (
            <Link href={builder} data-smt-set-build="" style={{ color: accentInk }} className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold hover:opacity-90">
              <span aria-hidden="true">+</span> Make your own set
            </Link>
          )}
          {builder && readOnly && <p className="text-[12.5px] text-[var(--muted2)]">Making a set isn&rsquo;t open while you look as this school.</p>}
          {sets.linked && set && (
            <p className="text-[12.5px] text-[var(--muted2)]">Now showing a linked set ({set.label}). Pick one above to go back to yours.</p>
          )}
        </div>
        <div className="min-w-0" data-smt-set-show="">
          {!set && sets.failed ? (
            <div data-smt-set-failed="" className="flex min-h-[200px] flex-col items-start justify-center gap-3 rounded-[10px] border border-[var(--panel-border)] px-5 py-6 text-[14px]">
              <p>This set&rsquo;s schools didn&rsquo;t load. Try it again, or pick another set.</p>
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={sets.retry} className="min-h-[44px] rounded-full bg-[var(--accent)] px-4 font-semibold text-[#111]">
                  Try again
                </button>
                {selected !== NEAREST_KEY && (
                  <button type="button" onClick={() => sets.choose({ kind: "nearest" })} className="min-h-[44px] rounded-full border border-[var(--panel-border2)] px-4 font-semibold hover:border-[var(--accent)]">
                    Back to the 10 nearest schools
                  </button>
                )}
              </span>
            </div>
          ) : set && rt ? (
            <div className="flex flex-col gap-3" style={smtVars(theme) as CSSProperties}>
              <RankTable rt={rt} schoolName={schoolName} phase={phase} />
              {/* 20 Nov: what the map's colours say for a small set -- each school's roll over 3 years -- for the
                  whole population, with the school's roll against the set's average (the Overview walk's chart). */}
              {oNow && <SetRolls o={oNow} urn={urn} schoolName={schoolName} />}
            </div>
          ) : !set || (n !== null && n <= SET_MAP_MAX && !oNow) ? (
            <div className="flex min-h-[340px] items-center justify-center rounded-[10px] border border-[var(--panel-border)] text-[13px] text-[var(--muted2)]">
              <span className="flex items-center gap-2">
                <Spinner size={16} /> Loading the set&rsquo;s schools…
              </span>
            </div>
          ) : n !== null && n <= SET_MAP_MAX && oNow ? (
            <div className="flex flex-col gap-2" style={smtVars(theme) as CSSProperties}>
              <SetMap o={oNow} fullscreen={false} pageScroll />
            </div>
          ) : (
            <div className="flex min-h-[200px] flex-col justify-center gap-2 rounded-[10px] border border-[var(--panel-border)] px-5 py-6">
              <p className="text-[28px] font-semibold tabular-nums">{n?.toLocaleString("en-GB")} schools</p>
              <p className="text-[14px] text-[var(--muted2)]">
                {set.label}: too many to map. The walks set {schoolName} against the middle of these schools, and show where it ranks among them.
              </p>
            </div>
          )}
          {set && (
            <div data-smt-set-story="" className="mt-3 flex flex-col gap-2 text-[13.5px] leading-relaxed">
              <p>
                {story}
                {editHref && (
                  <>
                    {" "}
                    <Link href={editHref} className="font-semibold text-[var(--tile-accent-text,var(--accent))] underline">
                      {savedRow?.editable ? "Edit this set" : "Edit a copy"}
                    </Link>
                  </>
                )}
              </p>
              {names.length > 0 && (
                <p className="text-[var(--muted2)]">
                  {/* 20 Nov: semicolons between, as some names carry a comma ("The King's School, Gloucester"). */}
                  <span className="font-semibold text-[var(--fg)]">Schools in the set:</span> {names.join("; ")}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Teacher's ranking table for a whole population (data-view-cards' chunkedRankingDisplay: the top 10, the school
 * with 2 either side, the bottom 3, each at its real place), headed by the school's place. */
function RankTable({ rt, schoolName, phase }: { rt: NonNullable<SmtSetState["rankTable"]>; schoolName: string; phase: "ks2" | "ks4" | "ks5" | null }) {
  const chunks = chunkedRankingDisplay(rt.ranking, rt.targetRank);
  const fmt = (v: number) => v.toFixed(phase === "ks4" ? 1 : 2);
  const measure = phase === "ks5" ? "academic points per entry (A level, IB, Pre-U)" : phase === "ks4" ? "Attainment 8" : "Headline";
  return (
    <div data-smt-rank-table="" className="flex flex-col gap-2 rounded-[10px] border border-[var(--panel-border)] px-4 py-3">
      <p className="text-[15px] font-semibold">
        {rt.targetRank ? `${schoolName}: ${rt.targetRank.toLocaleString("en-GB")} of ${rt.ranked.toLocaleString("en-GB")}` : `${rt.ranked.toLocaleString("en-GB")} ranked`}
        <span className="ml-2 text-[12.5px] font-normal text-[var(--muted2)]">by {measure}</span>
      </p>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-[11.5px] text-[var(--muted2)]">
            <th className="w-[52px] font-normal">Place</th>
            <th className="font-normal">School</th>
            <th className="text-right font-normal">{phase === "ks5" ? "Points" : measure}</th>
          </tr>
        </thead>
        {chunks.map((c, ci) => (
          <tbody key={ci}>
            {chunks.length > 1 && c.label && (
              <tr>
                <td colSpan={3} className="pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted2)]">
                  {c.label === "Around this school" ? `Around ${schoolName}` : c.label}
                </td>
              </tr>
            )}
            {c.rows.map((r) => (
              <tr key={r.urn} data-rank-row={r.isTarget ? "you" : undefined} {...featuredRow(r.isTarget)} className={`border-t border-[var(--panel-border)] ${r.isTarget ? "font-semibold" : ""}`}>
                <td className="py-[5px] pl-1">{r.rank}</td>
                <td className="min-w-0 truncate py-[5px] pr-2">{r.name}</td>
                <td className="py-[5px] pr-1 text-right">{fmt(r.value)}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** A large set's rolls, as the map colours a small one's: how many are growing, steady and shrinking on the shared
 * 3-year rule (Overview.rolls, the map's own), the middle school's change against this school's, and the school's
 * roll against the set's average, indexed (RollIndexed, the Overview walk's "Has the roll grown or shrunk?"). */
export function setRollSummary(o: Pick<Overview, "rolls">, urn: string, setUrns: string[]) {
  const trends = setUrns.filter((u) => u !== urn).map((u) => o.rolls[u]?.trend).filter((t): t is NonNullable<typeof t> => !!t);
  const count = { up: 0, flat: 0, down: 0 } as Record<"up" | "flat" | "down", number>;
  for (const t of trends) count[t.dir] += 1;
  const pcts = trends.map((t) => t.pct).sort((a, b) => a - b);
  const median = pcts.length ? (pcts.length % 2 ? pcts[(pcts.length - 1) / 2] : (pcts[pcts.length / 2 - 1] + pcts[pcts.length / 2]) / 2) : null;
  const mine = o.rolls[urn]?.trend ?? null;
  const span = trends[0] ?? mine;
  return { count, median, mine, schools: trends.length, from: span?.from ?? null, to: span?.to ?? null };
}

const signedPct = (v: number) => `${v > 0.5 ? "▲ " : v < -0.5 ? "▼ " : ""}${Math.abs(v).toFixed(0)}%`;

function SetRolls({ o, urn, schoolName }: { o: Overview; urn: string; schoolName: string }) {
  const r = setRollSummary(o, urn, Object.keys(o.rolls));
  if (!r.schools) return null;
  const years = r.from !== null && r.to !== null ? ` (${periodLabel(r.from)} to ${periodLabel(r.to)})` : "";
  return (
    <div data-smt-set-rolls="" className="flex flex-col gap-2 rounded-[10px] border border-[var(--panel-border)] px-4 py-3">
      <p className="text-[15px] font-semibold">Pupil numbers across the set</p>
      <p className="text-[13.5px] leading-relaxed">
        Roll over {ROLL_DIRECTION_SPAN} years{years}: {schoolName} {r.mine ? <b>{signedPct(r.mine.pct)}</b> : "no roll trend"}; the middle school in the set {r.median !== null ? <b>{signedPct(r.median)}</b> : "—"}.
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {(["up", "flat", "down"] as const).map((d) => (
          <span key={d} className="inline-flex items-center gap-1.5">
            <span className="h-[10px] w-[10px] rounded-full" style={{ background: TREND_HEX[d] }} aria-hidden="true" />
            {r.count[d].toLocaleString("en-GB")} {ROLL_WORD[d].toLowerCase()}
          </span>
        ))}
        <span className="text-[var(--muted2)]">of {r.schools.toLocaleString("en-GB")} with a census roll</span>
      </p>
      <RollIndexed o={o} fullscreen={false} />
    </div>
  );
}
