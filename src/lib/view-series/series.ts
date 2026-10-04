// VicData 0.6.1 S3: what the series builder hands a leaf -- one leaf component's props, as
// plain data (no React here), plus the title lines over it. The renderer
// (src/components/views/) maps each `leaf` to its component.
import type { ViewKind } from "@/catalogue/viewspec";
import type { Measure, PanelData } from "@/lib/teacher-view-panels";
import type { FrameMap, SortState } from "./frames";

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
  // S3b: NumberTiles -- the main figure and the tiles, after the instance's Figures
  // (params.tiles / mainLabel, src/lib/tile-figures.ts). Icons by PanelIcons glyph name.
  | { leaf: "numberTiles"; main: { figure: string; label: string } | null; tiles: TileData[] }
  // S3b: RankedList (Context's Ranked list). `columns` / rank set only off the default.
  | {
      leaf: "rankedList";
      rows: RankRowData[];
      measure: Measure;
      focusKey: string | null;
      columns?: RankColumnKey[];
      centred: string;
    }
  // S3b: SchoolRankingTable (Comparisons' Ranking).
  | {
      leaf: "schoolRanking";
      rows: SchoolRankRowData[];
      valueHeading: string;
      targetName: string;
      columns?: RankColumnKey[];
      centred: string;
    }
  // S3b: the two-year slope (no preset uses it yet).
  | {
      leaf: "slope";
      from: number;
      to: number;
      rows: SlopeRowData[];
      measure: Measure;
    }
  // S3c: ShareDonut (Context's Share), its figures formatted as the host formats them.
  | {
      leaf: "donut";
      percent: number;
      label: string;
      groupLabel: string;
      valueLabel: string;
      otherLabel?: string;
      groupValueLabel: string;
      colour: string;
    }
  // S3c: RankingsMap (AcademicMapView), in the host's own wrapper for where it sits:
  // Comparisons' Current ("current"), Comparisons' Trend / Change maps ("change"), Results'
  // Trend map ("trend"). The title sits inside the wrapper, as the hosts draw it.
  | {
      leaf: "map";
      place: "current" | "change" | "trend";
      map: FrameMap;
      targetUrn: string;
      forcedColourMode?: "accent" | "grade_band" | "trend" | "trend_absolute";
      changeValues?: { byUrn: Record<string, number>; format: (v: number) => string; label: string };
      untitledSizeLegend?: boolean;
    }
  // S3c: the geography comparison (GeographyView's own picture): its heading (an instance's
  // title replaces the words), then a note, the area table or the area chart.
  | {
      leaf: "geography";
      heading: string;
      note?: string;
      view: "chart" | "table";
      data: PanelData;
      measure: Measure;
      centred: string;
    }
  | {
      leaf: "verticalBars";
      bars: { key: string; label: string; shortLabel: string; value: number | null; colour: string }[];
      measure: Measure;
      average?: AverageLine;
    };

export type TileIconName = "PodiumIcon" | "SchoolIcon" | "ChangeArrowIcon" | "GradesIcon" | "AverageIcon" | "FlagIcon";
export type TileData = {
  key: string;
  icon: TileIconName;
  figure: string;
  detail: string;
  direction?: "up" | "down" | "flat";
  vars?: Record<string, string | number | null | undefined>;
};

export type RankColumnKey = "rank" | "sector" | "value" | "change" | "distance" | "n" | "bar";
// A ranked row: its true rank (rows a look leaves out keep the others' ranks), its figure,
// and the extra columns' figures where the look asks for them.
export type RankRowData = { key: string; label: string; value: number | null; rank?: number | null; change?: string | null; n?: number | null; share?: number | null };
export type SchoolRankRowData = {
  key: string;
  name: string;
  rank: number | null;
  value: number | null;
  valueLabel: string;
  distanceKm: number | null;
  independent: boolean | null;
  isTarget: boolean;
  change?: string | null;
  n?: number | null;
  share?: number | null;
};

export type SlopeRowData = { key: string; label: string; colour: string; from: number; to: number; emphasis: boolean; comparison?: boolean };

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

// `params`: the showing instance's own settings (round 3's Figures on a numbers view);
// absent = none set, the host's own tiles.
export type BuildContext = { fullscreen: boolean; params?: Record<string, unknown> | null };
