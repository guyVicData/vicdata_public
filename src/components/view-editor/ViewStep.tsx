"use client";

// VicData 0.6.1 S4: 2 · View (AddView2, with AddView2Table / Rank / Bar / Spread) -- the
// View tiles with the real PanelIcons glyphs, then that View's look box and its dashed "comes
// from 1 · Data" note. A View only decides how the numbers are drawn: a tile that would
// need other numbers is greyed and points back to 1 · Data, and no look option changes a
// figure. "Something else? Plan it" is the only way to a placeholder.
import type { ReactNode } from "react";
import { VIEW_KINDS, VIEW_LABEL, averageHow, viewHonest } from "@/catalogue/honest";
import type { BarLook, LineLook, RankingLook, SpreadLook, TableLook, ViewKind, ViewSpec } from "@/catalogue/viewspec";
import { honestCtx, setView } from "./model";
import { Chip, Chips, KIND_GLYPH, Opt, ToggleOpt, glyph } from "./bits";
import type { StepProps } from "./DataStep";

// The tiles' short reasons for the sentence under them (the full one is the tooltip).
const SHORT: Partial<Record<ViewKind, string>> = {
  line: "needs one value per year",
  ranking: "ranks subjects or schools",
  spread: "needs one value per grade",
  slope: "needs a first year",
  donut: "needs entries (counts) across a group of subjects",
  map: "needs a set of other schools",
};

const NOTE: Record<ViewKind, ReactNode> = {
  line: <>The lines, the numbers (actual / indexed / change) and the years all come from <b>1 &middot; Data</b>.</>,
  table: <>The rows and the years in range come from <b>1 &middot; Data</b>.</>,
  ranking: <>What is ranked (schools / subjects), among which schools, and by what (latest / change) come from <b>1 &middot; Data</b>. An average row is an average added there.</>,
  bar: <>Which bars (one per subject, in which group), latest or change, and the England marker all come from <b>1 &middot; Data</b>: a comparison there is drawn as a marker on each bar.</>,
  spread: <>The grades, the year and comparisons (England as a marker on each grade) come from <b>1 &middot; Data</b>.</>,
  numbers: <>Which figures the tiles show is set on the panel; the subject, the year and the comparison come from <b>1 &middot; Data</b>.</>,
  slope: <>The rows, the first year and the latest come from <b>1 &middot; Data</b>.</>,
  donut: <>The subjects and the year come from <b>1 &middot; Data</b>.</>,
  map: <>The schools, and whether it is coloured by the figure or the change, come from <b>1 &middot; Data</b>.</>,
};

export function ViewTiles({ draft, set, env, wide }: Pick<StepProps, "draft" | "set" | "env" | "wide">) {
  const ctx = honestCtx(env);
  const verdicts = VIEW_KINDS.map((k) => ({ k, h: viewHonest(ctx, k, draft.spec.data) }));
  const greyed = verdicts.filter((v) => !v.h.ok && v.k !== draft.spec.view.kind);
  return (
    <>
      <div className="label">a &middot; Which view</div>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(9, 1fr)" : "repeat(3, 1fr)", gap: wide ? 6 : 7 }}>
        {verdicts.map(({ k, h }) => {
          const on = draft.spec.view.kind === k;
          const off = !h.ok && !on;
          return (
            <button key={k} type="button" className={`kind${on ? " on" : ""}${off ? " off" : ""}`} disabled={off} title={off ? h.reason : undefined} aria-pressed={on} onClick={() => set((d) => ({ ...d, spec: setView(d.spec, k) }))}>
              {glyph(KIND_GLYPH[k])}
              {VIEW_LABEL[k]}
            </button>
          );
        })}
      </div>
      {greyed.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--cc-faint)", marginTop: -4, lineHeight: 1.4 }}>
          Dotted, for this data:{" "}
          {greyed.map((v, i) => (
            <span key={v.k}>
              {i > 0 ? "; " : ""}
              {wide ? VIEW_LABEL[v.k] : <b>{VIEW_LABEL[v.k]}</b>} {SHORT[v.k] ?? "can't draw it"}
            </span>
          ))}
          .{wide ? "" : " Hover for the reason."}
        </div>
      )}
    </>
  );
}

export function LookBox({ draft, set, env }: Pick<StepProps, "draft" | "set" | "env">) {
  const spec = draft.spec;
  const kind = spec.view.kind;
  const span = "from" in spec.data.years;
  const look = spec.view.look as Record<string, unknown>;
  const setLook = (patch: Record<string, unknown>) => set((d) => ({ ...d, spec: { ...d.spec, view: { ...d.spec.view, look: { ...d.spec.view.look, ...patch } } as ViewSpec["view"] } }));
  const hasComparison = spec.compare === "follows-page" || spec.compare.some((c) => c.kind !== "self");
  const ctx = honestCtx(env);
  let body: ReactNode = null;
  switch (kind) {
    case "line": {
      const l = look as LineLook;
      body = (
        <>
          <ToggleOpt k="Trend line" on={l.trendLine === true} onChange={(on) => setLook({ trendLine: on })} hint={l.trendLine === "member" ? "members switch it on (off to start)" : "a straight line of best fit"} />
          <ToggleOpt k="End labels" on={!!l.endLabels} onChange={(on) => setLook({ endLabels: on })} hint="latest value at the end of each line" />
          <ToggleOpt k="From zero" on={!!l.fromZero} onChange={(on) => setLook({ fromZero: on })} hint="start the axis at 0" />
        </>
      );
      break;
    }
    case "bar": {
      const l = look as BarLook;
      body = (
        <>
          <Opt k="Order">
            <Chips>
              <Chip on={(l.order ?? "highest") === "highest"} onClick={() => setLook({ order: "highest" })}>Highest first</Chip>
              <Chip on={l.order === "az"} onClick={() => setLook({ order: "az" })}>A&ndash;Z</Chip>
              <Chip on={l.order === "above-comparison"} off={!hasComparison && l.order !== "above-comparison"} reason="Needs a comparison in 1 · Data." onClick={() => setLook({ order: "above-comparison" })}>
                Furthest above comparison
              </Chip>
            </Chips>
          </Opt>
          <Opt k="Average">
            <Chips>
              {(["none", "mean", "median", "weighted"] as const).map((a) => {
                const h = a === "none" ? { ok: true } : averageHow(ctx, a);
                return (
                  <Chip key={a} on={(l.average ?? "none") === a} off={!h.ok} reason={"reason" in h ? h.reason : undefined} onClick={() => setLook({ average: a })}>
                    {a === "none" ? "None" : a.charAt(0).toUpperCase() + a.slice(1)}
                  </Chip>
                );
              })}
            </Chips>
          </Opt>
          <div style={{ fontSize: 11, color: "var(--cc-faint)", marginTop: -3, paddingLeft: 70 }}>a line across the bars shown, drawn across them</div>
          <ToggleOpt k="Top 10" on={!!l.top10} onChange={(on) => setLook({ top10: on })} hint="only the top 10 (this subject always shown)" />
          <ToggleOpt k="Highlight" on={l.highlight !== false} onChange={(on) => setLook({ highlight: on })} hint={spec.data.per === "school" ? "this school" : "the dashboard's subject"} />
          <ToggleOpt k="Values" on={l.values !== false} onChange={(on) => setLook({ values: on })} hint="value at the end of each bar" />
        </>
      );
      break;
    }
    case "table": {
      const l = look as TableLook;
      const extra = l.extra ?? [];
      const toggleExtra = (x: "change" | "rank" | "n") => setLook({ extra: extra.includes(x) ? extra.filter((e) => e !== x) : [...extra, x] });
      body = (
        <>
          {span && (
            <Opt k="Year columns">
              <Chips>
                <Chip on={(l.yearColumns ?? "first-latest") === "first-latest"} onClick={() => setLook({ yearColumns: "first-latest" })}>First &amp; latest</Chip>
                <Chip on={l.yearColumns === "every"} onClick={() => setLook({ yearColumns: "every" })}>Every year</Chip>
              </Chips>
            </Opt>
          )}
          <Opt k="Extra columns" top>
            <Chips>
              <Chip on={extra.includes("change")} off={!span && !extra.includes("change")} reason="A change needs a first year in 1 · Data." onClick={() => toggleExtra("change")}>Change</Chip>
              <Chip on={extra.includes("rank")} onClick={() => toggleExtra("rank")}>Rank</Chip>
              <Chip on={extra.includes("n")} onClick={() => toggleExtra("n")}>Entries (n)</Chip>
            </Chips>
          </Opt>
          <Opt k="Sort by">
            <Chips>
              <Chip on={(l.sort ?? "listed") === "listed"} onClick={() => setLook({ sort: "listed" })}>As listed</Chip>
              <Chip on={l.sort === "latest"} onClick={() => setLook({ sort: "latest" })}>Latest</Chip>
              <Chip on={l.sort === "change"} off={!span && l.sort !== "change"} reason="A change needs a first year in 1 · Data." onClick={() => setLook({ sort: "change" })}>Change</Chip>
            </Chips>
          </Opt>
          <ToggleOpt k="Highlight" on={l.highlight !== false} onChange={(on) => setLook({ highlight: on })} hint="this school's row" />
          <ToggleOpt k="Colour" on={l.colourChange !== false} onChange={(on) => setLook({ colourChange: on })} hint="change up / down" />
          <ToggleOpt k="Re-sort" on={!!l.memberSort} onChange={(on) => setLook({ memberSort: on })} hint="members can click a heading" />
        </>
      );
      break;
    }
    case "ranking": {
      const l = look as RankingLook;
      const cols = l.columns ?? [];
      const COLS: { id: NonNullable<RankingLook["columns"]>[number]; label: string; ok: boolean; why?: string }[] = [
        { id: "rank", label: "Rank", ok: true },
        { id: "sector", label: "Sector dot", ok: spec.data.per === "school", why: "Schools only." },
        { id: "value", label: "Value", ok: true },
        { id: "change", label: "Change", ok: span, why: "A change needs a first year in 1 · Data." },
        { id: "distance", label: "Distance", ok: spec.data.per === "school", why: "Schools only." },
        { id: "n", label: "Entries (n)", ok: true },
        { id: "bar", label: "Inline bar", ok: true },
      ];
      body = (
        <>
          <Opt k="Columns" top>
            <Chips>
              {COLS.map((c) => (
                <Chip key={c.id} on={cols.includes(c.id)} off={!c.ok && !cols.includes(c.id)} reason={c.why} onClick={() => setLook({ columns: cols.includes(c.id) ? cols.filter((x) => x !== c.id) : [...cols, c.id] })}>
                  {c.label}
                </Chip>
              ))}
            </Chips>
          </Opt>
          <Opt k="Show">
            <Chips>
              <Chip on={l.show === "top5"} onClick={() => setLook({ show: "top5" })}>Top 5</Chip>
              <Chip on={(l.show ?? "all") === "all"} onClick={() => setLook({ show: "all" })}>All</Chip>
              <Chip on={l.show === "around"} onClick={() => setLook({ show: "around" })}>Around this school</Chip>
            </Chips>
          </Opt>
          <ToggleOpt k="Always" on={l.alwaysSelf !== false} onChange={(on) => setLook({ alwaysSelf: on })} hint={spec.data.per === "school" ? "show this school's row" : "show this subject's row"} />
        </>
      );
      break;
    }
    case "spread": {
      const l = look as SpreadLook;
      const gcse = env.phase === "ks4";
      const bandIs = (t: string, b: string) => typeof l.bands === "object" && l.bands.top === t && l.bands.bottom === b;
      body = (
        <>
          <Opt k="Show as">
            <Chips>
              <Chip on={(l.show ?? "percent") === "percent"} onClick={() => setLook({ show: "percent" })}>% of entries</Chip>
              <Chip on={l.show === "counts"} onClick={() => setLook({ show: "counts" })}>Counts</Chip>
            </Chips>
          </Opt>
          <Opt k="Average">
            <Chips>
              <Chip on={(l.average ?? "none") === "none"} onClick={() => setLook({ average: "none" })}>None</Chip>
              <Chip on={l.average === "mean"} onClick={() => setLook({ average: "mean" })}>Mean grade</Chip>
              <Chip on={l.average === "median"} onClick={() => setLook({ average: "median" })}>Median grade</Chip>
            </Chips>
          </Opt>
          <div style={{ fontSize: 11, color: "var(--cc-faint)", marginTop: -3, paddingLeft: 70 }}>a marker under the grade scale</div>
          <Opt k="Bands" top>
            <Chips>
              <Chip on={(l.bands ?? "none") === "none"} onClick={() => setLook({ bands: "none" })}>None</Chip>
              {gcse && <Chip on={bandIs("9", "4")} onClick={() => setLook({ bands: { top: "9", bottom: "4" } })}>Shade 4&ndash;9</Chip>}
              {gcse && <Chip on={bandIs("9", "7")} onClick={() => setLook({ bands: { top: "9", bottom: "7" } })}>Shade 7&ndash;9</Chip>}
              <Chip on={l.bands === "follows-page"} onClick={() => setLook({ bands: "follows-page" })}>The page&rsquo;s band</Chip>
            </Chips>
          </Opt>
          <ToggleOpt k="Values" on={l.values !== false} onChange={(on) => setLook({ values: on })} hint="value at the end of each bar" />
        </>
      );
      break;
    }
    default:
      body = <div style={{ fontSize: 12, color: "var(--cc-label)" }}>Nothing to set for the {VIEW_LABEL[kind].toLowerCase()}: it draws what 1 &middot; Data gives it.</div>;
  }
  return (
    <div className="box">
      <div className="label">b &middot; How the {VIEW_LABEL[kind].toLowerCase()} looks</div>
      {body}
      <div className="dashed">{NOTE[kind]}</div>
    </div>
  );
}
