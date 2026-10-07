// VicData 0.6.1 S5: the rail icon menu's "Shows for" ticks (docs/wireframes/v0.6/RailMenu).
//
// One chip per Results measure on a Results dashboard: ticked where the view shows on it,
// greyed (dashed, with the reason) where it can't honestly be drawn there -- S4's
// showForOptions (catalogue/honest.ts), the same verdicts 3 · Preview's "Show this view
// for" gives. A panel that also varies by Context's Compare against or Comparisons' kind of
// comparison gets a chip row per axis (round 4's "Show on…" checklist, folded in here: the
// board has no second page). The last ticked chip of an axis can't be unticked: taking a
// view off everything is Remove everywhere.
//
// Pure, so src/lib/rail-menu.test.ts can pin it.
import { dataviewById } from "@/catalogue/dataviews";
import { showForOptions } from "@/catalogue/honest";
import { dataviewResults, effectiveResults } from "@/catalogue/results";
import { AXIS_STATES, dataviewStates, effectiveStates, panelAxes, followsResultsPill, type VariantAxis } from "@/catalogue/variants";
import type { DashboardConfig, DataviewInstance, PanelConfig, Phase, ResultsMeasure } from "@/catalogue/types";
import { columnHostOf } from "@/components/view-editor/model";

export type ShowsForChip = {
  axis: VariantAxis;
  state: string;
  // The chip's short word ("Avg points"); `name` is the state's full name, for titles.
  label: string;
  name: string;
  on: boolean;
  // Greyed: the view can't honestly be drawn on it (with the reason).
  ok: boolean;
  reason?: string;
  // The note a measure carries where it is drawn ("Falls back to Average points here.").
  note?: string;
  // The last ticked chip of its axis: unticking it would leave the view on nothing.
  last: boolean;
};

export type ShowsForRow = { axis: VariantAxis; name: string; chips: ShowsForChip[] };

// The board's chip words: short enough for four in a row at the menu's 300px.
export function shortMeasureWord(phase: Phase, m: ResultsMeasure): string {
  if (m === "points") return "Avg points";
  if (m === "threshold") return phase === "ks5" ? "A*–E" : "Grade 4+";
  return m === "bands" ? "Bands" : "Counts";
}

export function showsForRows(
  config: DashboardConfig,
  panel: PanelConfig,
  v: DataviewInstance,
  axisNames: Partial<Record<VariantAxis, { name: string; labels: Record<string, string> }>>,
): ShowsForRow[] {
  if (v.kind !== "view") return [];
  const dv = dataviewById(v.dataview);
  if (!dv) return [];
  const phase: Phase = config.columns[0]?.data.phase ?? "ks4";
  const rows: ShowsForRow[] = [];
  for (const axis of panelAxes(config, panel)) {
    const names = axisNames[axis]?.labels ?? {};
    if (axis === "results") {
      if (!followsResultsPill(config)) continue;
      const host = columnHostOf(config, panel.id) ?? dv.host.id;
      const on = effectiveResults(v);
      const opts = showForOptions(v.spec, { phase, host }, dv.host.id, dataviewResults(dv));
      rows.push({
        axis,
        name: axisNames.results?.name ?? "Results",
        chips: opts.map((o) => {
          const ticked = on.includes(o.measure);
          return { axis, state: o.measure, label: shortMeasureWord(phase, o.measure), name: names[o.measure] ?? o.label, on: ticked, ok: o.ok, ...(o.reason ? { reason: o.reason } : {}), ...(o.ok && o.note ? { note: o.note } : {}), last: ticked && on.length === 1 };
        }),
      });
      continue;
    }
    const can = dataviewStates(dv, axis) as string[];
    const on = effectiveStates(v, axis) as string[];
    rows.push({
      axis,
      name: axisNames[axis]?.name ?? axis,
      chips: (AXIS_STATES[axis] as string[]).map((s) => {
        const ticked = on.includes(s);
        const name = names[s] ?? s;
        return { axis, state: s, label: name, name, on: ticked, ok: can.includes(s), ...(can.includes(s) ? {} : { reason: `This view can't be drawn on ${name}.` }), last: ticked && on.length === 1 };
      }),
    });
  }
  return rows;
}

// The states an axis shows on after a chip is clicked (config order); null = not allowed.
export function toggledStates(row: ShowsForRow, state: string): string[] | null {
  const chip = row.chips.find((c) => c.state === state);
  if (!chip || chip.last || (!chip.on && !chip.ok)) return null;
  return row.chips.filter((c) => (c.state === state ? !c.on : c.on)).map((c) => c.state);
}
