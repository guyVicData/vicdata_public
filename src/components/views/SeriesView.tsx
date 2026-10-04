"use client";

// VicData 0.6.1 S3: draws a built series -- the title lines, then the leaf component with
// the props the series builder worked out. Every leaf is the one the hosts draw today
// (MultiTrend, TrendChart, YearTable, SortTable, ChangeList, ViewChart, VerticalBars), in
// the same wrappers (CentredOnTarget where a list scrolls to its focused row). S3b adds
// NumberTiles, RankedList, SchoolRankingTable and the new SlopeChart; S3c ShareDonut and the
// geography comparison (GeographyView's picture). Maps draw through MapView.
import { useContext, useState } from "react";
import { formatChange } from "@/lib/teacher-view-panels";
import type { LeafSeries, ViewSeries } from "@/lib/view-series";
import { CentredOnTarget } from "@/components/teacher/CentredOnTarget";
import { ChangeList, MultiTrend, TrendScaleTitle, ViewTitle, ViewTitleOverrideContext, YearTable, multiTrendHasLine } from "@/components/teacher/SeriesViews";
import { ShareDonut } from "@/components/teacher/ShareDonut";
import { shouldIndex } from "@/lib/teacher-view-trend-styles";
import { SortTable, nextSort, type SortState } from "@/components/teacher/SortTable";
import { TrendChart } from "@/components/teacher/TrendChart";
import { VerticalBars } from "@/components/teacher/VerticalBars";
import { ViewChart } from "@/components/teacher/ViewChart";
import { NumberTiles } from "@/components/teacher/NumberTiles";
import * as Icons from "@/components/teacher/PanelIcons";
import { RankedList } from "@/components/teacher/RankedList";
import { SchoolRankingTable } from "@/components/teacher/SchoolRankingTable";
import { SlopeChart } from "./SlopeChart";

export function SeriesView({ series, fullscreen }: { series: ViewSeries; fullscreen: boolean }) {
  // The geography views carry their own heading (GeographyView's), not a ViewTitle line.
  if (series.leaf.leaf === "geography") return <GeographyLeaf leaf={series.leaf} fullscreen={fullscreen} />;
  return (
    <>
      {series.heading && <p className="mb-2 shrink-0 text-[12px] font-semibold text-[var(--muted2)]">{series.heading}</p>}
      <ViewTitle>{series.title}</ViewTitle>
      <Leaf leaf={series.leaf} fullscreen={fullscreen} />
    </>
  );
}

function Leaf({ leaf, fullscreen }: { leaf: LeafSeries; fullscreen: boolean }) {
  switch (leaf.leaf) {
    case "multiTrend":
      return (
        <>
          {leaf.scaleTitle && <TrendScaleTitle view={leaf.scaleTitle.view} from={leaf.scaleTitle.from} noun={leaf.scaleTitle.noun} />}
          <MultiTrend
            data={leaf.data}
            measure={leaf.measure}
            focusKey={leaf.focusKey}
            showFit={leaf.showFit}
            fullscreen={fullscreen}
            index={leaf.index}
            seriesLegend={leaf.seriesLegend}
            fromZero={leaf.fromZero}
            endLabels={leaf.endLabels}
          />
        </>
      );
    case "trendChart":
      return (
        <TrendChart
          data={leaf.data}
          measure={leaf.measure}
          showFit={leaf.showFit}
          fullscreen={fullscreen}
          focusKey={leaf.focusKey}
          fromZero={leaf.fromZero}
          endLabels={leaf.endLabels}
        />
      );
    case "yearTable": {
      const { leaf: _l, centred, ...props } = leaf;
      void _l;
      return (
        <CentredOnTarget watch={centred}>
          <YearTable {...props} fullscreen={fullscreen} />
        </CentredOnTarget>
      );
    }
    case "sortTable":
      return <SortTableLeaf leaf={leaf} fullscreen={fullscreen} />;
    case "changeList":
      return (
        <CentredOnTarget watch={leaf.centred}>
          <ChangeList
            rows={leaf.rows}
            focusKey={leaf.focusKey}
            group={leaf.group}
            average={leaf.average}
            formatValue={leaf.format === "percent" ? undefined : leaf.format === "change" ? (v) => formatChange(leaf.measure, v) : leaf.measure.formatDelta}
            values={leaf.values}
            order={leaf.order}
          />
        </CentredOnTarget>
      );
    case "rowBars": {
      const chart = (
        <ViewChart
          layout="row"
          unit=""
          formatValue={leaf.measure.format}
          markerLabel={leaf.markerLabel}
          scaleMax={leaf.scaleMax}
          spacious={leaf.spacious}
          average={leaf.average}
          values={leaf.values}
          computed={{ rows: leaf.rows }}
        />
      );
      return leaf.centred ? <CentredOnTarget watch={leaf.centred}>{chart}</CentredOnTarget> : chart;
    }
    case "numberTiles":
      // The Figures are already applied (the series builder, from the instance's params).
      return <NumberTiles main={leaf.main} tiles={leaf.tiles.map((t) => ({ ...t, icon: Icons[t.icon] }))} fullscreen={fullscreen} />;
    case "rankedList":
      return (
        <CentredOnTarget watch={leaf.centred}>
          <RankedList rows={leaf.rows} measure={leaf.measure} focusKey={leaf.focusKey} {...(leaf.columns ? { columns: leaf.columns } : {})} />
        </CentredOnTarget>
      );
    case "schoolRanking":
      return (
        <CentredOnTarget watch={leaf.centred}>
          <SchoolRankingTable rows={leaf.rows} valueHeading={leaf.valueHeading} targetName={leaf.targetName} fullscreen={fullscreen} {...(leaf.columns ? { columns: leaf.columns } : {})} />
        </CentredOnTarget>
      );
    case "slope":
      return <SlopeChart from={leaf.from} to={leaf.to} rows={leaf.rows} measure={leaf.measure} fullscreen={fullscreen} />;
    case "verticalBars":
      return <VerticalBars bars={leaf.bars} measure={leaf.measure} fullscreen={fullscreen} average={leaf.average} />;
    case "donut":
      return (
        <ShareDonut
          percent={leaf.percent}
          label={leaf.label}
          groupLabel={leaf.groupLabel}
          valueLabel={leaf.valueLabel}
          otherLabel={leaf.otherLabel}
          groupValueLabel={leaf.groupValueLabel}
          colour={leaf.colour}
          fullscreen={fullscreen}
        />
      );
    case "geography":
      return <GeographyLeaf leaf={leaf} fullscreen={fullscreen} />;
    case "map":
      // Drawn by its own renderer (MapView, registered for "map").
      return null;
  }
}

// S3c: the geography comparison, as GeographyView draws it -- its heading (an instance's title
// replaces the words), then the note, the area table, or the area chart.
function GeographyLeaf({ leaf, fullscreen }: { leaf: Extract<LeafSeries, { leaf: "geography" }>; fullscreen: boolean }) {
  const override = useContext(ViewTitleOverrideContext);
  const heading = <p className="shrink-0 text-[12px] font-semibold text-[var(--muted2)]">{override ?? leaf.heading}</p>;
  if (leaf.note !== undefined) {
    return (
      <>
        {heading}
        <p className="text-[12px] leading-relaxed text-[var(--muted2)]">{leaf.note}</p>
      </>
    );
  }
  if (leaf.view === "table") {
    return (
      <>
        {heading}
        <CentredOnTarget watch={leaf.centred}>
          <YearTable data={leaf.data} measure={leaf.measure} focusKey="own" fullscreen={fullscreen} nameHeading="Where" showRank={false} changeEmphasis="percent" />
        </CentredOnTarget>
      </>
    );
  }
  // Entries are drawn indexed to each line's first year (MultiTrend's rule for a headcount),
  // with the indexed chart's title; average points at their real level.
  return (
    <>
      {heading}
      {shouldIndex(leaf.measure.aggregate) && multiTrendHasLine(leaf.data) && <TrendScaleTitle view="indexed" from={leaf.data.periods[0] ?? null} noun="entries" />}
      <MultiTrend data={leaf.data} measure={leaf.measure} focusKey="own" fullscreen={fullscreen} />
    </>
  );
}

// Current's sortable table. The sort is the member's: the host's own state when the view
// opens in the host's order (so it survives a view switch, as today), else this view's.
function SortTableLeaf({ leaf, fullscreen }: { leaf: Extract<LeafSeries, { leaf: "sortTable" }>; fullscreen: boolean }) {
  const [own, setOwn] = useState<SortState>(leaf.initialSort);
  const sort = leaf.hostSort?.sort ?? own;
  const onSort = (key: SortState["key"]) => {
    if (!leaf.sortable) return;
    if (leaf.hostSort) leaf.hostSort.onSort(key);
    else setOwn(nextSort(own, key));
  };
  return (
    <CentredOnTarget watch={`${leaf.centredPrefix}:${sort.key}:${sort.dir}:${leaf.rows.length}`}>
      <SortTable
        rows={leaf.rows}
        sort={sort}
        onSort={onSort}
        columns={leaf.columns}
        leadingRank={leaf.leadingRank}
        showValue={leaf.showValue}
        showDelta={leaf.showDelta}
        fullscreen={fullscreen}
      />
    </CentredOnTarget>
  );
}
