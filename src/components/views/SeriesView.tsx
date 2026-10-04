"use client";

// VicData 0.6.1 S3: draws a built series -- the title lines, then the leaf component with
// the props the series builder worked out. Every leaf is the one the hosts draw today
// (MultiTrend, TrendChart, YearTable, SortTable, ChangeList, ViewChart, VerticalBars), in
// the same wrappers (CentredOnTarget where a list scrolls to its focused row).
import { useState } from "react";
import { formatChange } from "@/lib/teacher-view-panels";
import type { LeafSeries, ViewSeries } from "@/lib/view-series";
import { CentredOnTarget } from "@/components/teacher/CentredOnTarget";
import { ChangeList, MultiTrend, TrendScaleTitle, ViewTitle, YearTable } from "@/components/teacher/SeriesViews";
import { SortTable, nextSort, type SortState } from "@/components/teacher/SortTable";
import { TrendChart } from "@/components/teacher/TrendChart";
import { VerticalBars } from "@/components/teacher/VerticalBars";
import { ViewChart } from "@/components/teacher/ViewChart";

export function SeriesView({ series, fullscreen }: { series: ViewSeries; fullscreen: boolean }) {
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
    case "verticalBars":
      return <VerticalBars bars={leaf.bars} measure={leaf.measure} fullscreen={fullscreen} average={leaf.average} />;
  }
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
