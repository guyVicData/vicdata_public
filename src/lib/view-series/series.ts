// VicData 0.6.1 S3: what the series builder hands a leaf -- one leaf component's props, as
// plain data (no React here), plus the title lines over it. The renderer
// (src/components/views/) maps each `leaf` to its component.
import type { ViewKind } from "@/catalogue/viewspec";
import type { Measure, PanelData } from "@/lib/teacher-view-panels";
import type { SortState } from "./frames";

export type ChangeRowData = { key: string; label: string; colour: string; value: number | null };
export type AverageLine = { value: number; label: string };

// A ViewChart "row" bar (ComputedView's row, the fields the row layout reads).
export type BarRowData = { label: string; value: number | null; isSubject: boolean; color: string; marker?: number | null; emphasis: boolean };

export type SortRowData = {
  key: string;
  label: string;
  value: number | null;
  valueLabel: string;
  delta: number | null;
  deltaLabel: string;
  deltaTone: "positive" | "negative" | "neutral";
  emphasis?: boolean;
  highlight?: boolean;
};

export type LeafSeries =
  // MultiTrend: every series its own line (ranked change bars under 4 real years).
  | {
      leaf: "multiTrend";
      data: PanelData;
      measure: Measure;
      focusKey: string | null;
      showFit: boolean;
      index?: boolean;
      seriesLegend?: boolean;
      fromZero?: boolean;
      endLabels?: boolean;
      // TrendScaleTitle over it (an indexed / headcount chart explains its scale).
      scaleTitle: { view: "indexed" | "actual"; from: number | null; noun: string } | null;
    }
  // TrendChart: a line (or per-year bars under 4 real years, R-TREND-LINE-4YR).
  | { leaf: "trendChart"; data: PanelData; measure: Measure; focusKey?: string; showFit: boolean; fromZero?: boolean; endLabels?: boolean }
  | {
      leaf: "yearTable";
      data: PanelData;
      measure: Measure;
      focusKey: string | null;
      nameHeading?: string;
      showRank?: boolean;
      leadingRank?: boolean;
      changeEmphasis?: "value" | "percent";
      yearColumns?: "first-latest" | "every" | "latest";
      showChange?: boolean;
      rankColumn?: "fullscreen" | "always" | "never";
      counts?: Record<string, number | null>;
      initialSort?: "listed" | "latest" | "change";
      highlight?: boolean;
      colourChange?: boolean;
      sortable?: boolean;
      // CentredOnTarget's watch key (the list scrolls to the focused row).
      centred: string;
    }
  | {
      leaf: "sortTable";
      rows: SortRowData[];
      // The member's sort, owned by the host (survives a view switch), when the view opens
      // in the host's own order; else the renderer keeps its own, opening on `initialSort`.
      hostSort: { sort: SortState; onSort: (key: SortState["key"]) => void } | null;
      initialSort: SortState;
      sortable: boolean;
      columns: { name: string; value: string; delta: string };
      leadingRank: boolean;
      showValue: boolean;
      showDelta: boolean;
      // The watch key before the live sort and row count are added to it.
      centredPrefix: string;
    }
  | {
      leaf: "changeList";
      rows: ChangeRowData[];
      focusKey: string | null;
      group?: { label: string; value: number | null };
      average?: AverageLine;
      // "percent" = ChangeList's own rounded, signed % (a count's change); else the
      // measure's honest change format.
      format: "percent" | "change" | "delta";
      measure: Measure;
      values?: boolean;
      order?: "highest" | "az";
      centred: string;
    }
  | {
      leaf: "rowBars";
      rows: BarRowData[];
      measure: Measure;
      markerLabel?: string;
      scaleMax?: number;
      spacious: boolean;
      average?: AverageLine;
      values?: boolean;
      // null = no scroll box (Comparisons' graph).
      centred: string | null;
    }
  | {
      leaf: "verticalBars";
      bars: { key: string; label: string; shortLabel: string; value: number | null; colour: string }[];
      measure: Measure;
      average?: AverageLine;
    };

// A title line, as one string or as its parts: the hosts write some titles as JSX with the
// figures interpolated ("Every school in the {set}: …"), which the browser lays out as
// separate text runs, so the renderer keeps the same runs to draw the same pixels.
export type TitleText = string | string[];

export type ViewSeries = {
  kind: ViewKind;
  // Results' "Results in {category}" line over Current's bars and table.
  heading: TitleText | null;
  // The view's own title line (ViewTitle; an instance's title replaces it).
  title: TitleText | null;
  leaf: LeafSeries;
};

export type BuildContext = { fullscreen: boolean };
