"use client";

// VicData 0.8 SMT r2: Pupils (the Pupils board). Column 1 "Your pupils now"; the large view's Shape and
// size (described, never ranked), Entry points at a glance and Leaving at 16 (Admissions' figures,
// read-only). Every figure is /api/smt/pupils'. R-SMT-VIEW-PUPILS-NOW, R-SMT-VIEW-SHAPE,
// R-SMT-ADMISSIONS-READ-ONLY, R-SMT-VIEW-LEAVING, R-SMT-PUPILS-LEVEL.
import Link from "next/link";
import { SHAPE_LABELS } from "@/components/dashboard/ShapeIcon";
import { comparisonCaption } from "@/components/dashboard/PhaseBreakdownCard";
import { Empty, Lbl, Tile, cx } from "@/components/admissions/ui";
import { ADMISSIONS_NOTES, SMT_NOTES } from "@/catalogue/notes";
import { CENSUS_FIRST_PERIOD, periodLabel } from "@/catalogue/years";
import type { ShapeLabel } from "@/lib/shape-classifier";
import type { Pupils } from "@/lib/smt/pupils";
import type { SmtSchool } from "../api";
import { Td, Th, fmt } from "../ui";
import { SizeByPhase } from "./Now";

export const shapeName = (s: string | null) => (s ? (SHAPE_LABELS[s as ShapeLabel] ?? s) : "—");
const inLevel = (age: number, h: [number, number] | null) => !!h && age >= h[0] && age <= h[1];

export function PupilsNow({ p, school, compact = false }: { p: Pupils; school: SmtSchool; compact?: boolean }) {
  const n = p.now;
  const ages = school.low !== null && school.high !== null ? `ages ${school.low}–${school.high}` : "whole school";
  const main = n.sizes.find((b) => b.key === n.mainBand) ?? n.sizes[0];
  // "Context: XL for Worcestershire, larger than the LA's average" -- the badge, then the school
  // page's own comparison (comparisonCaption's first clause), for the main phase.
  const context = main && main.badge && main.laMean !== null && main.englandMean !== null ? `${main.badge} for ${school.laName ?? "the LA"}: ${comparisonCaption(main.total, main.laMean, school.laName, main.englandMean).replace(/^(\w)/, (m) => m.toLowerCase())}` : null;
  const tiles = [
    <Tile key="roll" label="Roll" value={fmt(n.roll, "pupils")} sub={ages} accent />,
    <Tile key="since" label={`Since ${periodLabel(CENSUS_FIRST_PERIOD)}`} value={n.changePct === null ? "—" : `${n.changePct >= 0 ? "▲" : "▼"} ${Math.abs(n.changePct).toFixed(0)}%`} sub="whole school" />,
    ...(school.mixed ? [<Tile key="gb" small label="Girls · boys" value={n.girls !== null && n.boys !== null && n.girls + n.boys ? `${Math.round((n.girls / (n.girls + n.boys)) * 100)}% · ${Math.round((n.boys / (n.girls + n.boys)) * 100)}%` : "—"} sub="whole school" />] : []),
    ...(n.boarding ? [<Tile key="db" small label="Day · boarding" value={`${fmt(n.boarding.day, "pupils")} · ${fmt(n.boarding.boarders, "pupils")}`} sub="whole school" />] : []),
    ...(n.stayingOn ? [<Tile key="stay" small label="Staying on at 16" value={`${Math.round(n.stayingOn.pct)}%`} sub={n.stayingOn.pct > 100 ? "Year 12 against Year 11: more joined than left" : "Year 11 to Year 12"} />] : []),
  ];
  // An odd tile out spans both columns, so the grid has no gap (as the Academic board's four tiles).
  const grid = tiles.map((t, i) => (tiles.length % 2 === 1 && i === tiles.length - 1 ? <div key={`w${i}`} className="col-span-2 [&>div]:h-full">{t}</div> : t));
  if (compact) return <div className="grid grid-cols-2 gap-2">{tiles.slice(0, 4)}</div>;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Your pupils now</div>
      <div className="grid grid-cols-2 gap-2">{grid}</div>
      <SizeByPhase sizes={n.sizes} school={school} caption={false} />
      {context && <div className="text-[12px] leading-[1.4] text-[var(--chip-fg)]">Context: {context}.</div>}
      {!n.boarding && <div className="text-[12px] leading-[1.4] text-[var(--muted2)]">No day or boarding split: {school.name} has no boarders, so the filter and the tile don&rsquo;t appear.</div>}
    </>
  );
}

export function ShapeAndSize({ p, height = 190 }: { p: Pupils; height?: number }) {
  const s = p.shape;
  if (!s.yearGroups.length) return <Empty>No census for this school, so no year groups to draw.</Empty>;
  const max = Math.max(...s.yearGroups.map((y) => y.total));
  const first = s.yearGroups[0].label.replace(/^Y/, "Year ");
  const last = s.yearGroups[s.yearGroups.length - 1].label.replace(/^Y/, "Year ");
  const h = p.highlight;
  return (
    <div className="flex min-h-0 grow flex-col gap-5 lg:flex-row">
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="text-[13px] font-bold text-[var(--fg)]">
          Pupils in each year group, {first} to {last}
        </div>
        <div className="flex items-end gap-[6px]" style={{ height }} role="img" aria-label="Pupils by year group">
          {s.yearGroups.map((y) => (
            <div key={y.age} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${y.label} (age ${y.age}): ${fmt(y.total, "pupils")} (${fmt(y.female, "pupils")} girls, ${fmt(y.male, "pupils")} boys)`}>
              <span data-level-age={inLevel(y.age, h) ? "on" : undefined} className="w-full rounded-t-[3px]" style={{ height: `${(y.total / max) * 100}%`, background: !h || inLevel(y.age, h) ? (y.age >= 16 ? "rgba(var(--accent-rgb),0.62)" : "var(--accent)") : "var(--adm-grey-bar)" }} />
            </div>
          ))}
        </div>
        <div className="flex gap-[6px]">
          {s.yearGroups.map((y) => (
            <span key={y.age} className={cx("flex-1 text-center text-[10.5px]", inLevel(y.age, h) ? "font-bold text-[var(--fg)]" : "text-[var(--muted)]")}>
              {y.label}
            </span>
          ))}
        </div>
        <div className="text-[12.5px] leading-[1.45] text-[var(--chip-fg)]">
          <b className="text-[var(--fg)]">Shape: {shapeName(s.label)}.</b> {s.was ? `Since ${periodLabel(s.sinceYear ?? CENSUS_FIRST_PERIOD)} (was ${shapeName(s.was)}).` : `Unchanged since ${periodLabel(s.sinceYear ?? CENSUS_FIRST_PERIOD)}.`}
        </div>
        {h && <div className="text-[11px] text-[var(--muted2)]">{SMT_NOTES.levelAges}</div>}
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 border-t border-[var(--panel-border)] pt-3 lg:w-[300px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <Lbl>Shapes around you</Lbl>
        {s.around.la && (
          <div className="flex justify-between gap-2 text-[12.5px]">
            <span className="text-[var(--chip-fg)]">{s.around.la.label}</span>
            <span className="font-bold text-[var(--fg)]" title={`${s.around.la.schools} of ${s.around.la.of} nearby schools of the same age range`}>
              {shapeName(s.around.la.shape)}
            </span>
          </div>
        )}
        <div className="flex justify-between gap-2 text-[12.5px]">
          <span className="text-[var(--chip-fg)]">{p.set.label}</span>
          <span className="text-right font-bold text-[var(--fg)]">{s.around.set.map((x) => `${x.schools} ${shapeName(x.shape)}`).join(" · ") || "—"}</span>
        </div>
        <div className="flex justify-between gap-2 text-[12.5px]">
          <span className="text-[var(--chip-fg)]">Staying on at 16, {p.set.label}</span>
          <span className="font-bold text-[var(--fg)]" title={`The middle of the set's ${s.around.stayingOnSet.schools} schools with a sixth form`}>
            {s.around.stayingOnSet.pct === null ? "—" : `${Math.round(s.around.stayingOnSet.pct)}%`}
          </span>
        </div>
        <div className="text-[11.5px] leading-snug text-[var(--muted2)]">{SMT_NOTES.shapesAround}</div>
        <Link href="/teacher/admissions" className="mt-auto text-[11.5px] font-bold text-[var(--adm-accent-text)]">
          Open in Admissions &rarr;
        </Link>
      </div>
    </div>
  );
}

export function EntryPoints({ p }: { p: Pupils }) {
  const e = p.entries;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Entry points at a glance</div>
      {e.status === "empty" ? (
        <Empty>{e.reason}</Empty>
      ) : (
        <div className="rounded-[9px] border border-[var(--panel-border)]">
          <table className="w-full border-collapse">
            <thead className="border-b border-[var(--panel-border)]">
              <tr>
                <Th>Entry point</Th>
                <Th>Cohort now</Th>
                <Th>The pool, next entry</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r) => (
                <tr key={r.entry} className="border-b border-[var(--panel-border)] last:border-0">
                  <Td className="font-bold text-[var(--fg)]">{r.label}</Td>
                  <Td>{fmt(r.cohort, "pupils")}</Td>
                  <Td title={r.poolSource ? `${r.poolSource === "counted" ? ADMISSIONS_NOTES.counted : ADMISSIONS_NOTES.births}` : undefined}>
                    {fmt(r.pool, "pupils")} {r.poolYear ? <span className="text-[var(--muted2)]">· {r.poolYear} entry{r.poolSource === "births" ? ", from births" : ""}</span> : null}
                  </Td>
                  <Td>
                    <Link href={`/teacher/admissions?entry=${encodeURIComponent(r.entry)}`} className="whitespace-nowrap text-[11.5px] font-bold text-[var(--adm-accent-text)]">
                      Open in Admissions &rarr;
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-auto text-[11px] leading-[1.4] text-[var(--muted2)]">{ADMISSIONS_NOTES.pool}</div>
      {e.status === "empty" && (
        <Link href="/teacher/admissions" className="text-[11.5px] font-bold text-[var(--adm-accent-text)]">
          Open in Admissions &rarr;
        </Link>
      )}
    </>
  );
}

export function LeavingAt16({ p, school }: { p: Pupils; school: SmtSchool }) {
  if (!p.leaving.length) return <Empty>{school.phases.post16 ? "No Year 11 to follow: this school has no GCSE years." : `${school.name} has no sixth form, so nobody stays on at 16 here.`}</Empty>;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Leaving at 16: Year 11 to Year 12, year by year</div>
      <div className="min-h-0 overflow-y-auto rounded-[9px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--panel-border)]">
            <tr>
              <Th>Year 12 in</Th>
              <Th>Year 11 the year before</Th>
              <Th>Year 12</Th>
              <Th>Staying on</Th>
              <Th>Net leavers</Th>
            </tr>
          </thead>
          <tbody>
            {p.leaving.map((r) => (
              <tr key={r.year} className="border-b border-[var(--panel-border)] last:border-0">
                <Td>{periodLabel(r.year)}</Td>
                <Td>{fmt(r.year11, "pupils")}</Td>
                <Td>{fmt(r.year12, "pupils")}</Td>
                <Td className="font-bold text-[var(--fg)]">{r.stayingPct === null ? "—" : `${Math.round(r.stayingPct)}%`}</Td>
                <Td>{r.leaving === null ? "—" : r.leaving < 0 ? `${fmt(-r.leaving, "pupils")} more joined` : fmt(r.leaving, "pupils")}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-auto text-[11px] leading-[1.4] text-[var(--muted2)]">{ADMISSIONS_NOTES.leaving16}</div>
    </>
  );
}
