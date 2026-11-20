"use client";

// Leighton Park prep (20 Nov): the SMT home's comparison panel. One pane that (a) says what the set is for --
// the walks above set the school against it -- (b) lists the choices on the left, the one in use highlighted
// and ticked, picking one changes the set for the home, the walks and the SMT dashboards at once (useSmtSet,
// the dashboard's own choice and store), (c) shows who is in it: a small set on the dashboard's own set map
// (SetMap, from the Overview answer the home already holds), a large one in words, and (d) opens the set
// builder to make your own.
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Overview } from "@/components/smt/api";
import type { SmtSetState } from "@/components/smt/useSmtSet";
import { DEFAULT_SET_LABEL } from "@/components/smt/useSmtSet";
import { smtVars } from "@/components/smt/ui";
import { SetMap } from "@/components/smt/views/SetMap";
import { NEAREST_KEY, rankingKey, teacherMenuRows } from "@/components/sets/teacherMenu";
import type { SetMenuRow } from "@/components/sets/SetSelector";
import { guidedHref } from "@/lib/sets/guided";
import { Spinner } from "@/components/shell/LoadingGraphic";
import type { Theme } from "@/components/shell/TeacherChrome";

/** Up to this many schools, the set is drawn on its map; more than that reads as a cloud of dots. */
export const SET_MAP_MAX = 40;

export function smtSetKey(choice: SmtSetState["choice"]): string | null {
  return choice.kind === "nearest" ? NEAREST_KEY : choice.kind === "saved" ? `saved:${choice.id}` : choice.kind === "ranking" && choice.rankingId ? rankingKey(choice.rankingId) : null;
}

const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export function SmtSetsPanel({ urn, schoolName, phase, sets, o, readOnly, theme }: { urn: string; schoolName: string; phase: "ks2" | "ks4" | "ks5" | null; sets: SmtSetState; o: Overview | null; readOnly: boolean; theme: Theme }) {
  const set = sets.set;
  const menu = teacherMenuRows(sets.savedSets, { nearestLabel: DEFAULT_SET_LABEL, nearestCount: sets.choice.kind === "nearest" && set ? set.urns.length : 10 });
  const selected = smtSetKey(sets.choice);
  const groups: { title: string; rows: SetMenuRow[] }[] = [
    { title: "VicData default", rows: menu.rows.default },
    { title: "School sets", rows: menu.rows.school },
    { title: "My sets", rows: menu.rows.mine },
  ].filter((g) => g.rows.length);
  const pick = (r: SetMenuRow) => {
    if (r.key === NEAREST_KEY) sets.choose({ kind: "nearest" });
    else if (r.key.startsWith("saved:")) sets.choose({ kind: "saved", id: r.key.slice(6) });
    else if (r.key.startsWith("ranking:")) {
      const rk = sets.savedSets?.rankings?.find((x) => rankingKey(x.id) === r.key);
      if (rk) sets.choose({ kind: "ranking", label: rk.name, filters: rk.filters, rankingId: rk.id });
    }
  };
  // The map draws the Overview answer for the set now in use (useSmt keys it on the set: never a stale one).
  const oNow = set ? o : null;
  const n = set?.urns.length ?? null;
  const builder = phase === "ks4" || phase === "ks5" ? guidedHref({ urn, kind: "compared_against", product: "smt", phase, fromHome: true }) : null;
  const pill = "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--panel-border2)] px-4 text-[13.5px] font-semibold text-[var(--fg)] hover:border-[var(--tile-accent-text,var(--accent))]";
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
          {sets.linked && set && (
            <p className="text-[12.5px] text-[var(--muted2)]">Now showing a linked set ({set.label}). Pick one above to go back to yours.</p>
          )}
        </div>
        <div className="min-w-0" data-smt-set-show="">
          {!set || (n !== null && n <= SET_MAP_MAX && !oNow) ? (
            <div className="flex min-h-[340px] items-center justify-center rounded-[10px] border border-[var(--panel-border)] text-[13px] text-[var(--muted2)]">
              <span className="flex items-center gap-2">
                <Spinner size={16} /> Loading the set&rsquo;s schools…
              </span>
            </div>
          ) : n !== null && n <= SET_MAP_MAX && oNow ? (
            <div className="flex flex-col gap-2" style={smtVars(theme) as CSSProperties}>
              <SetMap o={oNow} fullscreen={false} />
            </div>
          ) : (
            <div className="flex min-h-[200px] flex-col justify-center gap-2 rounded-[10px] border border-[var(--panel-border)] px-5 py-6">
              <p className="text-[28px] font-semibold tabular-nums">{n?.toLocaleString("en-GB")} schools</p>
              <p className="text-[14px] text-[var(--muted2)]">
                {set.label}: too many to map. The walks set {schoolName} against the middle of these schools, and show where it ranks among them.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--panel-border)] pt-4">
        {builder && !readOnly ? (
          <Link href={builder} data-smt-set-build="" className={pill}>
            Build your own set <span aria-hidden="true">&rarr;</span>
          </Link>
        ) : (
          builder && <span className="text-[13px] text-[var(--muted2)]">Building a set isn&rsquo;t open while you look as this school.</span>
        )}
        <Link href="/sets?kind=compared_against" className="inline-flex min-h-[44px] items-center px-2 text-[13px] text-[var(--muted2)] hover:text-[var(--fg)]">
          All sets
        </Link>
      </div>
    </section>
  );
}
