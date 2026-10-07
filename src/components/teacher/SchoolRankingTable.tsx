"use client";

// Teacher view, Column 3 round Part 2: a reusable school-ranking table.
//
// Its own component rather than a wider SortTable: Results' and Context's subject tables
// have no use for a sector or a distance, and those two are expected to recur in other
// school-comparison views, so they belong on a table built for schools. SortTable is
// untouched.
//
// The sector icon is coloured from TAG_COLOURS, the palette the school map's dots and the
// site's sector pills use (State green, Independent ISC orange), in its light or dark
// shade with the theme. sectorOf() still supplies the state / independent split.
//
// Columns: a bare rank ("3", no header text -- the same shape as the % change table's
// leading rank), the school, a small sector icon beside the name (state / independent), the figure, and the distance from the school itself. The
// school's own row is picked out in the phase accent and carries `data-highlight`, so a
// CentredOnTarget around it scrolls it into the middle, as the old table's row did.
import { useState, type CSSProperties } from "react";
import { SECTOR, sectorOf } from "@/lib/school-sector";
import { TAG_COLOURS } from "@/lib/tag-colours";
import { windowCut } from "@/lib/subject-ranking-view";

// The TAG_COLOURS entry for each sector, and its foreground shade per theme.
const SECTOR_TAG = { state: "State", independent: "Independent" } as const;
const sectorFill = (id: keyof typeof SECTOR_TAG) => {
  const c = TAG_COLOURS[SECTOR_TAG[id]];
  return { "--sector-light": c.light[1], "--sector-dark": c.dark[1] } as CSSProperties;
};

export type SchoolRankingRow = {
  key: string;
  name: string;
  rank: number | null;
  value: number | null;
  valueLabel: string;
  distanceKm: number | null;
  independent: boolean | null;
  isTarget: boolean;
  // 0.6.1 S3b: the ranking look's extra columns (drawn only where `columns` asks).
  change?: string | null;
  n?: number | null;
  share?: number | null;
  // 0.6.6: a subject ranking's window (src/lib/subject-ranking-view.ts) -- the row's position
  // in the whole population's order. With positions the rows are drawn in that order, cut for
  // the card or full screen, with a break row wherever positions jump, and don't re-sort
  // (their ranks are the population's, not the rows').
  pos?: number;
};

// 0.6.1 S3b: the ranking look's columns. Absent = rank, sector, value, distance, exactly as
// before. The school's name is always drawn.
export type SchoolRankingColumn = "rank" | "sector" | "value" | "change" | "distance" | "n" | "bar";
const HOST_COLUMNS: SchoolRankingColumn[] = ["rank", "sector", "value", "distance"];

type Key = "rank" | "name" | "value" | "distance";

export function SchoolRankingTable({
  rows,
  valueHeading,
  targetName,
  fullscreen = false,
  columns,
}: {
  rows: SchoolRankingRow[];
  // "Entries" for a candidate count, "Result" otherwise.
  valueHeading: string;
  // For the distance column's own heading: distance from which school.
  targetName: string;
  fullscreen?: boolean;
  columns?: SchoolRankingColumn[];
}) {
  const windowed = rows.some((r) => r.pos !== undefined);
  // A window's schools are anywhere in the country: no distance column unless one has one.
  const hostColumns = windowed && rows.every((r) => r.distanceKm === null) ? HOST_COLUMNS.filter((c) => c !== "distance") : HOST_COLUMNS;
  const has = (c: SchoolRankingColumn) => (columns ?? hostColumns).includes(c);
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const onSort = (key: Key) =>
    windowed ? undefined : setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === "value" ? -1 : 1 }));
  // Ranks past 99 need a wider rank column.
  const rankWidth = !windowed ? "w-6" : rows.some((r) => (r.rank ?? 0) >= 1000) ? "w-11" : rows.some((r) => (r.rank ?? 0) >= 100) ? "w-8" : "w-6";
  const columnCount = (["rank", "value", "change", "n", "bar", "distance"] as const).filter((c) => has(c)).length + 1;

  const valueOf = (r: SchoolRankingRow): number | string | null =>
    sort.key === "rank" ? r.rank : sort.key === "name" ? r.name : sort.key === "value" ? r.value : r.distanceKm;
  // Nulls last whichever way a column points, as SortTable does: "no figure" is not a value.
  const sorted = [...rows].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number)) * sort.dir;
  });

  const drawn: (SchoolRankingRow | null)[] = windowed ? windowCut(rows.map((r) => ({ ...r, pos: r.pos ?? 0 })), fullscreen) : sorted;
  const head = (key: Key, label: string, className: string, title?: string) => (
    <th className={`pb-1.5 font-semibold ${className}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(key)}
        title={title}
        aria-label={windowed ? undefined : `Sort by ${title ?? (label || "rank")}`}
        {...(windowed ? { disabled: true } : {})}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] uppercase tracking-[0.02em] text-[var(--muted)] ${windowed ? "cursor-default" : "hover:text-[var(--fg)]"}`}
      >
        {label}
        <span aria-hidden="true" className={sort.key === key && !windowed ? "" : "opacity-0"}>{sort.dir === 1 ? "▲" : "▼"}</span>
      </button>
    </th>
  );

  return (
    <table className={`w-full border-collapse tabular-nums ${fullscreen ? "text-sm" : "text-[12px]"}`}>
      <thead className="border-b border-[var(--panel-border2)]">
        <tr>
          {/* Rank: no heading text, just the sort arrow. */}
          {has("rank") && head("rank", "", `${rankWidth} pr-1 text-right`)}
          {head("name", "School", "px-1 text-left")}
          {has("value") && head("value", valueHeading, "w-14 px-1 text-right")}
          {has("change") && <th className="w-14 px-1 pb-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.02em] text-[var(--muted)]">Change</th>}
          {has("n") && <th className="w-12 px-1 pb-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.02em] text-[var(--muted)]">n</th>}
          {has("bar") && <th className="w-16 px-1 pb-1.5" aria-label="Bar" />}
          {has("distance") && head("distance", "Distance", "w-[4.5rem] pl-1 text-right", `Distance from ${targetName}`)}
        </tr>
      </thead>
      <tbody>
        {drawn.map((r, i) => {
          // A gap in the population's order: the rows between aren't drawn.
          if (r === null) {
            return (
              <tr key={`break-${i}`} aria-hidden="true" className="border-b border-[var(--panel-border)]">
                <td colSpan={columnCount} className="py-[3px] text-center leading-none tracking-[0.3em] text-[var(--muted3)]">⋯</td>
              </tr>
            );
          }
          const sectorId = r.independent === null || !has("sector") ? null : sectorOf({ independent: r.independent });
          const sector = sectorId === null ? null : { label: SECTOR[sectorId].label, style: sectorFill(sectorId) };
          return (
            <tr
              key={r.key}
              data-highlight={r.isTarget ? "" : undefined}
              className="border-b border-[var(--panel-border)] last:border-b-0"
              style={r.isTarget ? { background: "rgba(var(--accent-rgb,138,138,144),0.14)", color: "var(--accent,var(--fg))" } : undefined}
            >
              {has("rank") && <td className={`${rankWidth} py-[6px] pr-1 text-right text-[var(--muted3)]`}>{r.rank === null ? "" : windowed ? r.rank.toLocaleString() : r.rank}</td>}
              <td className={has("rank") ? "max-w-0 px-1" : "max-w-0 px-1 py-[6px]"}>
                <span className="flex items-center gap-1.5">
                  <span className={`truncate ${r.isTarget ? "font-bold" : ""}`} title={r.name}>{r.name}</span>
                  {sector && (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      className="shrink-0 fill-[var(--sector-light)] dark:fill-[var(--sector-dark)]"
                      style={sector.style}
                      role="img"
                      aria-label={sector.label}
                    >
                      <title>{sector.label}</title>
                      {/* A small schoolhouse, filled in the sector colour (the svg's fill). */}
                      <path d="M6 1 11 4.5V11H1V4.5z" />
                      <rect x="4.75" y="7" width="2.5" height="4" fill="var(--box-bg,#fff)" />
                    </svg>
                  )}
                </span>
              </td>
              {has("value") && <td className={`w-14 px-1 text-right font-semibold ${r.value === null ? "font-normal text-[var(--muted3)]" : ""}`}>{r.valueLabel}</td>}
              {has("change") && <td className="w-14 px-1 text-right text-[var(--muted2)]">{r.change ?? "—"}</td>}
              {has("n") && <td className="w-12 px-1 text-right text-[var(--muted2)]">{r.n === null || r.n === undefined ? "—" : Math.round(r.n).toLocaleString()}</td>}
              {has("bar") && (
                <td className="w-16 px-1">
                  <span aria-hidden="true" className="block h-[5px] rounded-full bg-[var(--muted3)]" style={{ width: `${Math.round((r.share ?? 0) * 100)}%`, background: r.isTarget ? "var(--accent,var(--fg))" : undefined }} />
                </td>
              )}
              {has("distance") && (
                <td className="w-[4.5rem] pl-1 text-right text-[var(--muted2)]">
                  {r.isTarget ? "—" : r.distanceKm === null ? "—" : `${r.distanceKm.toFixed(1)} km`}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
