"use client";

// VicData 0.7 admissions r2 (D3, D4): the row-2 trend views (Main.dc.html, MarketShare.dc.html),
// drawn from the routes' series (already indexed on the server where indexed). R-ADM-VIEW-TRENDS.
import { indexedLabel } from "@/lib/index-base";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { POPULATION_TREND_LABELS, displayPopulationTrendPct } from "@/lib/population-trend";
import type { MarketView, PipelineOk } from "../api";
import { Empty, Key, LineSwatch, ViewTitle, fillHeight, fmtN, fmtPct, yearLabel } from "../ui";
import { LineChart, YearBars } from "./charts";
import { cohortWord } from "../panels/EntryNow";
import { signedDelta, UNSIGNED_ZERO } from "@/lib/signed-delta";

const yr = (y: number) => yearLabel(y);

// ----------------------------------------------------------------- Pipelines, column 1
export function EntryTrend({ p, as, fullscreen, room }: { p: PipelineOk; as: "line" | "bars"; fullscreen: boolean; room?: number }) {
  const s = p.now.series;
  if (s.filter((x) => x.cohort !== null).length < 2) return <Empty>Not enough census years for this school yet.</Empty>;
  return (
    <>
      <ViewTitle>Your {cohortWord(p.entry.age)} cohort, year by year</ViewTitle>
      {as === "line" ? (
        <LineChart
          height={fullscreen ? fillHeight(room, 80, 320) : 170}
          xLabels={[yr(s[0].period), yr(s[s.length - 1].period)]}
          series={[{ id: "mine", label: "Your cohort", colour: "var(--accent)", points: s.map((x) => ({ x: x.period, y: x.cohort })), title: (pt) => `${yr(pt.x)}: ${fmtN(pt.y)} aged ${p.entry.age}` }]}
        />
      ) : (
        <YearBars height={fullscreen ? fillHeight(room, 80, 320) : 180} bars={s.map((x) => ({ label: yr(x.period).slice(2), value: x.cohort, title: `${yr(x.period)}: ${fmtN(x.cohort)} (${fmtN(x.female)} girls, ${fmtN(x.male)} boys)` }))} />
      )}
    </>
  );
}

// ----------------------------------------------------------------- Pipelines, column 2
// 0.7 admissions editor s2: `la` / `england` -- the view's compare chips (the area lines; the
// feeders' line always draws) -- and the `endLabels` look. The undercount note always shows.
export function PoolTrends({ p, fullscreen, room, la = true, england = true, endLabels = false }: { p: PipelineOk; fullscreen: boolean; room?: number; la?: boolean; england?: boolean; endLabels?: boolean }) {
  const t = p.poolTrends;
  const ix = t.indexed;
  const areaShort = t.areaYears.length < 2;
  if (ix.feeders.filter((x) => x.value !== null).length < 2) return <Empty>Not enough past pools to draw a trend.</Empty>;
  return (
    <>
      {/* Both area lines (the preset): the title's text runs exactly as before the looks. */}
      {la && england ? (
        <ViewTitle>
          {t.age}-year-olds: your feeders, {t.laName ?? "the LA"} and England
        </ViewTitle>
      ) : (
        <ViewTitle>
          {t.age}-year-olds: your feeders{la ? ` and ${t.laName ?? "the LA"}` : england ? " and England" : ""}
        </ViewTitle>
      )}
      <LineChart
        endLabels={endLabels}
        height={fullscreen ? fillHeight(room, 150, 300) : 150}
        reference={{ y: 100 }}
        yFormat={(v) => v.toFixed(0)}
        xLabels={[yr(ix.feeders[0].year), yr(ix.feeders[ix.feeders.length - 1].year)]}
        series={[
          { id: "f", label: "Feeders", colour: "var(--accent)", points: ix.feeders.map((x) => ({ x: x.year, y: x.value })), title: (pt) => `Feeders ${yr(pt.x)}: ${pt.y?.toFixed(0)} (${fmtN(t.feeders.find((f) => f.year === pt.x)?.value)} aged ${t.age})` },
          ...(la ? [{ id: "la", label: t.laName ?? "LA", colour: "var(--adm-grey-soft)", width: 1.6, points: ix.la.map((x) => ({ x: x.year, y: x.value })), dots: areaShort }] : []),
          ...(england ? [{ id: "en", label: "England", colour: "var(--adm-grey-2)", width: 1.6, dashed: "4 3", points: ix.england.map((x) => ({ x: x.year, y: x.value })), dots: areaShort }] : []),
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Feeders</Key>
        {la && <Key swatch={<LineSwatch colour="var(--adm-grey-soft)" width={14} weight={2} />}>{t.laName ?? "LA"}</Key>}
        {england && <Key swatch={<LineSwatch colour="var(--adm-grey-2)" width={14} weight={2} dashed />}>England</Key>}
      </div>
      {areaShort && <div className="text-[10.5px] leading-snug text-[var(--muted)]">{t.laName ?? "The LA"} and England by single age are held for {t.areaYears.map(yr).join(", ") || "no year"} only so far: their lines start when more years are synced.</div>}
      {t.pastAreaYears?.length ? <div className="text-[10.5px] leading-snug text-[var(--muted)]">{ADMISSIONS_NOTES.areaUndercount}</div> : null}
    </>
  );
}

export function PoolTable({ p, la = true, england = true }: { p: PipelineOk; la?: boolean; england?: boolean }) {
  const t = p.poolTrends;
  const years = Array.from(new Set([...t.feeders, ...t.la, ...t.england].map((x) => x.year))).sort((a, b) => a - b);
  const at = (s: { year: number; value: number | null }[], y: number) => s.find((x) => x.year === y)?.value ?? null;
  return (
    <>
      {la && england ? (
        <ViewTitle>{t.age}-year-olds: your feeders, {t.laName ?? "the LA"} and England</ViewTitle>
      ) : (
        <ViewTitle>
          {t.age}-year-olds: your feeders{la ? ` and ${t.laName ?? "the LA"}` : england ? " and England" : ""}
        </ViewTitle>
      )}
      <table className="w-full text-[11.5px] tabular-nums">
        <thead>
          <tr className="text-left text-[10.5px] text-[var(--muted)]">
            <th className="font-normal">Year</th>
            <th className="text-right font-normal">Feeders</th>
            {la && <th className="text-right font-normal">{t.laName ?? "LA"}</th>}
            {england && <th className="text-right font-normal">England</th>}
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y} className="border-t border-[var(--panel-border)]">
              <td className="py-[3px]">{yr(y)}</td>
              <td className="text-right">{fmtN(at(t.feeders, y))}</td>
              {la && <td className="text-right">{fmtN(at(t.la, y))}</td>}
              {england && <td className="text-right">{fmtN(at(t.england, y))}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {t.pastAreaYears?.length ? <div className="text-[10.5px] leading-snug text-[var(--muted)]">{ADMISSIONS_NOTES.areaUndercount}</div> : null}
    </>
  );
}

/** The school page's Population trends in the area (ages 5-15), in this panel's style: each
 * area's ages 15 → 5 as bars, with its trend word (POPULATION_TREND_LABELS) as the page shows it. */
// 0.7 admissions editor s2: `la` / `region` -- the view's compare chips: which areas it draws.
export function AreaPopulation({ p, la = true, region = true }: { p: PipelineOk; la?: boolean; region?: boolean }) {
  const a = p.areaPopulation;
  if (!a || (!a.laSeries && !a.regionSeries)) return <Empty>No area population figures for this LA.</Empty>;
  const cols = [
    { name: a.laName, series: la ? a.laSeries : null, trend: a.laTrend },
    { name: a.region, series: region ? a.regionSeries : null, trend: a.regionTrend },
  ].filter((c) => c.series && c.name);
  return (
    <>
      <ViewTitle>Population trends in the area (ages 5&ndash;15)</ViewTitle>
      <div className="grid grid-cols-2 gap-3">
        {cols.map((c) => {
          const max = Math.max(...c.series!.map((s) => s.total));
          return (
            <div key={c.name} className="flex flex-col gap-1">
              <div className="truncate text-[11.5px] font-bold text-[var(--fg)]">{c.name}</div>
              <div className="text-[11px] text-[var(--muted2)]">
                {c.trend ? `${POPULATION_TREND_LABELS[c.trend.tier]} · ${signedDelta(displayPopulationTrendPct(c.trend.pct), (x) => `${Math.abs(x).toFixed(1)}%`, UNSIGNED_ZERO)}` : "Too few pupils to call"}
              </div>
              {c.series!.map((s) => (
                <div key={s.age} className="grid grid-cols-[22px_1fr] items-center gap-1 text-[10px] text-[var(--muted)]" title={`Age ${s.age}: ${fmtN(s.total)}`}>
                  <span>{s.age}</span>
                  <span className="block h-[6px] rounded-[2px] bg-[var(--adm-grey-2)]" style={{ width: `${(s.total / max) * 100}%` }} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ----------------------------------------------------------------- Pipelines, column 3
export function ShareNeeded({ p, fullscreen, table = false, room }: { p: PipelineOk; fullscreen: boolean; room?: number; table?: boolean }) {
  const h = p.hold;
  const needed = h.needed.filter((x) => x.share !== null);
  if (!h.current || !needed.length) return <Empty>No share needed: this school has no entry cohort or pool at this entry point.</Empty>;
  const target = needed.find((x) => x.entryYear === p.changeYear) ?? needed[Math.min(3, needed.length - 1)];
  const counted = needed.filter((x) => x.source === "counted");
  const later = needed.filter((x) => x.source !== "counted");
  if (table)
    return (
      <>
        <ViewTitle>Share needed to hold numbers steady</ViewTitle>
        <table className="w-full text-[11.5px] tabular-nums">
          <thead>
            <tr className="text-left text-[10.5px] text-[var(--muted)]">
              <th className="font-normal">September</th>
              <th className="text-right font-normal">Share needed</th>
              <th className="text-right font-normal">Range</th>
              <th className="text-right font-normal">Source</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--panel-border)]">
              <td className="py-[3px]">{h.current.entryYear} (now)</td>
              <td className="text-right font-bold">{fmtPct(h.current.share)}</td>
              <td className="text-right">—</td>
              <td className="text-right text-[var(--muted2)]">counted</td>
            </tr>
            {needed.map((x) => (
              <tr key={x.entryYear} className="border-t border-[var(--panel-border)]">
                <td className="py-[3px]">{x.entryYear}</td>
                <td className="text-right">{fmtPct(x.share)}</td>
                <td className="text-right text-[var(--muted2)]">{x.low !== null && x.high !== null ? `${x.low.toFixed(1)}–${x.high.toFixed(1)}%` : "—"}</td>
                <td className="text-right text-[var(--muted2)]">{x.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  return (
    <>
      <ViewTitle>Share needed to hold numbers steady</ViewTitle>
      <div className="text-[12px] leading-[1.4] text-[var(--chip-fg)]">
        To keep {fmtN(h.current.cohort)} in {cohortWord(p.entry.age)}, you&rsquo;d need <b className="text-[var(--fg)]">{fmtPct(target.share)}</b> of the {target.entryYear} pool. Now: {fmtPct(h.current.share)}.
      </div>
      <LineChart
        height={fullscreen ? fillHeight(room, 120, 260) : 110}
        reference={{ y: h.current.share }}
        yFormat={(v) => `${v.toFixed(1)}%`}
        xLabels={[String(needed[0].entryYear), String(needed[needed.length - 1].entryYear)]}
        series={[
          { id: "now", label: "Your share now", colour: "var(--adm-grey-line)", width: 2, dashed: "4 4", points: needed.map((x) => ({ x: x.entryYear, y: h.current!.share })), title: () => `Your share now: ${fmtPct(h.current!.share)} (${fmtN(h.current!.cohort)} of ${fmtN(h.current!.pool)})` },
          { id: "c", label: "Share needed", colour: "var(--adm-amber)", width: 2.4, points: counted.map((x) => ({ x: x.entryYear, y: x.share })), title: (pt) => `${pt.x}: ${fmtPct(pt.y)} needed (counted pool)` },
          { id: "b", label: "Share needed (from births)", colour: "var(--adm-amber)", width: 2, dashed: "5 4", points: (counted.length ? [counted[counted.length - 1], ...later] : later).map((x) => ({ x: x.entryYear, y: x.share })), title: (pt) => `${pt.x}: ${fmtPct(pt.y)} needed (pool from births: an estimate)` },
        ]}
      />
      <div className="flex gap-3">
        <Key swatch={<LineSwatch colour="var(--adm-amber)" width={14} />}>Share needed</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-line)" width={14} weight={2} dashed />}>Your share now</Key>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- Market share, row 2
export function VsRivals({ m, setLabel, as, fullscreen, room }: { m: MarketView; setLabel: string; as: "line" | "bars"; fullscreen: boolean; room?: number }) {
  const v = m.summary.vsIndexed;
  const word = cohortWord(m.entry.age);
  if (v.mine.filter((x) => x.value !== null).length < 2) return <Empty>Not enough census years to compare.</Empty>;
  if (as === "bars") {
    const rows = m.entryAge.periods.map((y) => ({ y, mine: m.entryAge.rows.find((r) => r.urn === m.urn && r.period === y)?.count ?? null, avg: m.summary.rivalsAverage.find((x) => x.year === y)?.value ?? null }));
    const max = Math.max(1, ...rows.flatMap((r) => [r.mine ?? 0, r.avg ?? 0]));
    return (
      <>
        <ViewTitle>
          Your {word} against the {setLabel}
        </ViewTitle>
        <div className="flex items-end gap-2" style={{ height: fullscreen ? fillHeight(room, 110, 300) : 150 }}>
          {rows.map((r) => (
            <div key={r.y} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${yr(r.y)}: you ${fmtN(r.mine)}, rivals' average ${fmtN(r.avg)}`}>
              <div className="flex w-full items-end justify-center gap-[2px]" style={{ height: "85%" }}>
                <span className="w-1/2 rounded-t-[2px] bg-[var(--accent)]" style={{ height: `${((r.mine ?? 0) / max) * 100}%` }} />
                <span className="w-1/2 rounded-t-[2px] bg-[var(--adm-grey-2)]" style={{ height: `${((r.avg ?? 0) / max) * 100}%` }} />
              </div>
              <span className="text-[10px] text-[var(--muted)]">{yr(r.y).slice(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Key swatch={<span className="h-[9px] w-[9px] rounded-[2px] bg-[var(--accent)]" />}>You</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-[2px] bg-[var(--adm-grey-2)]" />}>Rivals&rsquo; average</Key>
        </div>
      </>
    );
  }
  return (
    <>
      <ViewTitle>
        Your {word} against the {setLabel}
      </ViewTitle>
      <LineChart
        height={fullscreen ? fillHeight(room, 110, 300) : 160}
        reference={{ y: 100 }}
        yFormat={(x) => x.toFixed(0)}
        xLabels={[yr(v.mine[0].year), yr(v.mine[v.mine.length - 1].year)]}
        series={[
          { id: "me", label: "You", colour: "var(--accent)", points: v.mine.map((x) => ({ x: x.year, y: x.value })) },
          { id: "avg", label: "Rivals' average", colour: "var(--adm-grey-soft)", width: 1.8, dashed: "5 3", points: v.rivals.map((x) => ({ x: x.year, y: x.value })) },
        ]}
      />
      <div className="flex gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>You</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-soft)" width={14} weight={2} dashed />}>Rivals&rsquo; average</Key>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">Indexed: {indexedLabel(v.base ?? null)}.</div>
    </>
  );
}

export function ShareTrend({ m, fullscreen, room }: { m: MarketView; fullscreen: boolean; room?: number }) {
  const mine = m.entryAge.rows.filter((r) => r.urn === m.urn).sort((a, b) => a.period - b.period);
  if (mine.filter((r) => r.share !== null).length < 2) return <Empty>Not enough years of shares yet.</Empty>;
  return (
    <>
      <ViewTitle>Your market share at {m.entry.label.replace(/ \(.*\)$/, "")}, year by year</ViewTitle>
      <LineChart
        height={fullscreen ? fillHeight(room, 80, 300) : 160}
        yFormat={(v) => `${v.toFixed(1)}%`}
        xLabels={[yr(mine[0].period), yr(mine[mine.length - 1].period)]}
        series={[{ id: "s", label: "Your share", colour: "var(--accent)", points: mine.map((r) => ({ x: r.period, y: r.share })), title: (pt) => `${yr(pt.x)}: ${fmtPct(pt.y)} of ${fmtN(m.entryAge.totals[pt.x])} (${ADMISSIONS_NOTES.groupShort.toLowerCase()})` }]}
      />
    </>
  );
}

export function RollTrend({ m, fullscreen, room }: { m: MarketView; fullscreen: boolean; room?: number }) {
  // The entry point's age band (not the whole roll): the school in the accent, each rival a grey line.
  const series = m.extras.map((e) => {
    const rows = m.ageBand.rows.filter((r) => r.urn === e.urn).sort((a, b) => a.period - b.period);
    return { id: e.urn, label: m.schools[e.urn]?.name ?? e.urn, colour: e.urn === m.urn ? "var(--accent)" : "var(--adm-grey-2)", width: e.urn === m.urn ? 2.6 : 1.2, points: rows.map((r) => ({ x: r.period, y: r.count })) };
  });
  const years = m.ageBand.periods;
  return (
    <>
      <ViewTitle>
        Pupils aged {m.band.from}&ndash;{m.band.to}: you and the rivals
      </ViewTitle>
      <LineChart height={fullscreen ? fillHeight(room, 80, 300) : 160} xLabels={[yr(years[0]), yr(years[years.length - 1])]} series={[...series.filter((s) => s.id !== m.urn), ...series.filter((s) => s.id === m.urn)]} />
    </>
  );
}
