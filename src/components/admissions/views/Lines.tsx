"use client";

// VicData 0.7 admissions r2 (D3, D4): the row-2 trend views (Main.dc.html, MarketShare.dc.html),
// drawn from the routes' series (already indexed on the server where indexed). R-ADM-VIEW-TRENDS.
import { indexedLabel } from "@/lib/index-base";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { POPULATION_TREND_LABELS, displayPopulationTrendPct } from "@/lib/population-trend";
import type { MarketView, PipelineOk } from "../api";
import { Empty, Key, LineSwatch, ViewTitle, fillHeight, fmtN, fmtPct, yearLabel } from "../ui";
import { LineChart, YearBars, yearTicks } from "./charts";
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
          ticks={yearTicks(s.map((x) => x.period), yr)}
          series={[{ id: "mine", label: "Your cohort", colour: "var(--accent)", points: s.map((x) => ({ x: x.period, y: x.cohort })), title: (pt) => `${yr(pt.x)}: ${fmtN(pt.y)} aged ${p.entry.age}` }]}
        />
      ) : (
        <YearBars height={fullscreen ? fillHeight(room, 80, 320) : 180} bars={s.map((x) => ({ label: yr(x.period).slice(2), value: x.cohort, title: `${yr(x.period)}: ${fmtN(x.cohort)} (${fmtN(x.female)} girls, ${fmtN(x.male)} boys)` }))} />
      )}
    </>
  );
}

// F-16 (0.8 Admissions fb1): the cohort's girls and boys, year by year, and the girls' share of it --
// each sex's trend, and how the balance has moved. The census by sex (cohort.ts); not filtered by the top
// bar's girls/boys (it draws both).
export function EntrySex({ p, fullscreen, room }: { p: PipelineOk; fullscreen: boolean; room?: number }) {
  const s = p.now.series.filter((x) => x.cohort !== null);
  if (s.length < 2) return <Empty>Not enough census years for this school yet.</Empty>;
  const girlsPct = (x: (typeof s)[number]) => (x.cohort ? (100 * (x.female ?? 0)) / x.cohort : null);
  const years = s.map((x) => x.period);
  const xLabels: [string, string] = [yr(years[0]), yr(years[years.length - 1])];
  const first = girlsPct(s[0]);
  const last = girlsPct(s[s.length - 1]);
  return (
    <>
      <ViewTitle>Your {cohortWord(p.entry.age)} cohort: girls and boys</ViewTitle>
      <LineChart
        height={fullscreen ? fillHeight(room, 170, 240) : 100}
        fromZero
        xLabels={xLabels}
        ticks={yearTicks(years, yr)}
        series={[
          { id: "girls", label: "Girls", colour: "var(--accent)", points: s.map((x) => ({ x: x.period, y: x.female })), title: (pt) => `${yr(pt.x)}: ${fmtN(pt.y)} girls aged ${p.entry.age}` },
          { id: "boys", label: "Boys", colour: "var(--adm-amber)", width: 2.2, dashed: "5 3", points: s.map((x) => ({ x: x.period, y: x.male })), title: (pt) => `${yr(pt.x)}: ${fmtN(pt.y)} boys aged ${p.entry.age}` },
        ]}
      />
      <div className="flex gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Girls</Key>
        <Key swatch={<LineSwatch colour="var(--adm-amber)" width={14} weight={2} dashed />}>Boys</Key>
      </div>
      <div data-girls-share="" className="text-[11px] text-[var(--muted2)]">
        Girls&rsquo; share: <b className="text-[var(--fg)]">{last === null ? "—" : `${last.toFixed(0)}%`}</b> in {yr(years[years.length - 1])}
        {first !== null && last !== null ? <> (from {first.toFixed(0)}% in {yr(years[0])})</> : null}
      </div>
      <LineChart
        height={fullscreen ? fillHeight(room, 220, 150) : 44}
        reference={{ y: 50 }}
        yFormat={(v) => `${v.toFixed(0)}%`}
        ticks={yearTicks(years, yr)}
        series={[{ id: "pct", label: "Girls' share", colour: "var(--adm-grey-soft)", width: 1.8, dots: true, points: s.map((x) => ({ x: x.period, y: girlsPct(x) })), title: (pt) => `${yr(pt.x)}: girls ${pt.y?.toFixed(1)}% of the cohort` }]}
      />
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
        ticks={yearTicks(ix.feeders.map((x) => x.year), yr)}
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
        ticks={yearTicks(needed.map((x) => x.entryYear), String)}
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
        ticks={yearTicks(v.mine.map((x) => x.year), yr)}
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
        ticks={yearTicks(mine.map((r) => r.period), yr)}
        series={[{ id: "s", label: "Your share", colour: "var(--accent)", points: mine.map((r) => ({ x: r.period, y: r.share })), title: (pt) => `${yr(pt.x)}: ${fmtPct(pt.y)} of ${fmtN(m.entryAge.totals[pt.x])} (${ADMISSIONS_NOTES.groupShort.toLowerCase()})` }]}
      />
    </>
  );
}

// F-20 (0.8 Admissions fb1): the entry age band's roll indexed (the first year every line has = 100) so a
// trend reads whatever the school's size. In the panel: you against the rivals' average. In full screen:
// you and each rival in its own colour, with a key.
export function RollTrend({ m, fullscreen, room }: { m: MarketView; fullscreen: boolean; room?: number }) {
  const r = m.summary.rollIndexed;
  if (r.mine.filter((x) => x.value !== null).length < 2) return <Empty>Not enough census years to compare.</Empty>;
  const years = r.mine.map((x) => x.year);
  const band = `${m.band.from}\u2013${m.band.to}`;
  const raw = (urn: string, y: number) => m.ageBand.rows.find((x) => x.urn === urn && x.period === y)?.count ?? null;
  const me = { id: m.urn, label: "You", colour: "var(--accent)", width: 2.8, points: r.mine.map((x) => ({ x: x.year, y: x.value })), title: (pt: { x: number; y: number | null }) => `You ${yr(pt.x)}: ${pt.y?.toFixed(0)} (${fmtN(raw(m.urn, pt.x))} aged ${band})` };
  const rivals = fullscreen
    ? r.rivals.map((x, i) => ({ id: x.urn, label: m.schools[x.urn]?.name ?? x.urn, colour: `var(--adm-series-${i % 7})`, width: 1.6, dashed: i >= 7 ? "6 3" : undefined, points: x.values.map((v) => ({ x: v.year, y: v.value })), title: (pt: { x: number; y: number | null }) => `${m.schools[x.urn]?.name ?? x.urn} ${yr(pt.x)}: ${pt.y?.toFixed(0)} (${fmtN(raw(x.urn, pt.x))} aged ${band})` }))
    : [{ id: "avg", label: "Rivals' average", colour: "var(--adm-grey-soft)", width: 1.8, dashed: "5 3", points: r.average.map((x) => ({ x: x.year, y: x.value })) }];
  return (
    <>
      <ViewTitle>
        Pupils aged {m.band.from}&ndash;{m.band.to}: you {fullscreen ? "and each rival" : "against the rivals\u2019 average"}
      </ViewTitle>
      <LineChart
        height={fullscreen ? fillHeight(room, 140, 300) : 150}
        reference={{ y: 100 }}
        yFormat={(v) => v.toFixed(0)}
        xLabels={[yr(years[0]), yr(years[years.length - 1])]}
        ticks={yearTicks(years, yr)}
        series={[...rivals, me]}
      />
      <div data-roll-key="" className="flex flex-wrap gap-x-3 gap-y-1">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>You</Key>
        {rivals.map((x) => (
          <Key key={x.id} swatch={<LineSwatch colour={x.colour} width={14} weight={2} dashed={!!x.dashed} />}>
            {x.label}
          </Key>
        ))}
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">Indexed: {indexedLabel(r.base ?? null)}.</div>
    </>
  );
}

// F-21 (0.8 Admissions fb1): your share of the whole age band's roll (11+: Years 7-11), year by year.
export function BandShareTrend({ m, fullscreen, room }: { m: MarketView; fullscreen: boolean; room?: number }) {
  const mine = m.ageBand.rows.filter((r) => r.urn === m.urn).sort((a, b) => a.period - b.period);
  if (mine.filter((r) => r.share !== null).length < 2) return <Empty>Not enough years of shares yet.</Empty>;
  return (
    <>
      <ViewTitle>Your share of {bandWords(m.band)}, year by year</ViewTitle>
      <LineChart
        height={fullscreen ? fillHeight(room, 80, 300) : 160}
        yFormat={(v) => `${v.toFixed(1)}%`}
        xLabels={[yr(mine[0].period), yr(mine[mine.length - 1].period)]}
        ticks={yearTicks(mine.map((r) => r.period), yr)}
        series={[{ id: "s", label: "Your share", colour: "var(--accent)", points: mine.map((r) => ({ x: r.period, y: r.share })), title: (pt) => `${yr(pt.x)}: ${fmtPct(pt.y)} of ${fmtN(m.ageBand.totals[pt.x])} aged ${m.band.from}\u2013${m.band.to} (${ADMISSIONS_NOTES.groupShort.toLowerCase()})` }]}
      />
    </>
  );
}

/** "Years 7–11" for an age band (Reception for 4, then Year age-4). */
export function bandWords(b: { from: number; to: number }): string {
  const y = (a: number) => (a <= 4 ? "Reception" : `${a - 4}`);
  return b.from <= 4 ? `Reception to Year ${y(b.to)}` : `Years ${y(b.from)}\u2013${y(b.to)}`;
}
