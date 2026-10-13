"use client";

// VicData 0.8 SMT r1: the tables behind row 2's charts -- a row per year, the figures the chart draws
// (R-SMT-VIEW-TRENDS, R-SMT-VIEW-MIX). Nothing new is computed.
import { Empty } from "@/components/admissions/ui";
import { periodLabel } from "@/catalogue/years";
import type { Overview } from "../api";
import type { StagePart } from "@/lib/smt/academic";
import { Td, Th, fmt, type Unit } from "../ui";

type Pt = { year: number; value: number | null };
type Band = { year: number; p25: number | null; p75: number | null; n: number };

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 overflow-y-auto rounded-[9px] border border-[var(--panel-border)]">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function RollTable({ o }: { o: Overview }) {
  const lines = o.trends.roll.lines;
  if (!lines.length) return <Empty>No census years.</Empty>;
  const years = lines[0].pts.map((p) => p.year);
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Roll, indexed ({o.trends.roll.base !== null ? periodLabel(o.trends.roll.base) : "first year"} = 100)</div>
      <Frame>
        <thead className="border-b border-[var(--panel-border)]">
          <tr>
            <Th>Year</Th>
            {lines.map((l) => (
              <Th key={l.key}>{l.label}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((y, i) => (
            <tr key={y} className="border-b border-[var(--panel-border)] last:border-0">
              <Td>{periodLabel(y)}</Td>
              {lines.map((l) => (
                <Td key={l.key}>{l.pts[i]?.value === null || l.pts[i]?.value === undefined ? "—" : l.pts[i].value!.toFixed(0)}</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Frame>
    </>
  );
}

export function BandTable({ title, school, band, unit, setLabel, valueKey }: { title: string; school: Pt[]; band: Band[]; unit: Unit; setLabel: string; valueKey?: string }) {
  if (!school.length) return <Empty>No published years.</Empty>;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">{title}</div>
      <Frame>
        <thead className="border-b border-[var(--panel-border)]">
          <tr>
            <Th>Year</Th>
            <Th>You</Th>
            <Th>{setLabel}: middle half</Th>
            <Th>Schools</Th>
          </tr>
        </thead>
        <tbody>
          {school.map((p) => {
            const b = band.find((x) => x.year === p.year);
            return (
              <tr key={p.year} className="border-b border-[var(--panel-border)] last:border-0">
                <Td>{periodLabel(p.year)}</Td>
                <Td className="font-bold text-[var(--fg)]">{fmt(p.value, unit, valueKey)}</Td>
                <Td>{b && b.p25 !== null && b.p75 !== null ? `${fmt(b.p25, unit, valueKey)} – ${fmt(b.p75, unit, valueKey)}` : "—"}</Td>
                <Td>{b?.n ?? 0}</Td>
              </tr>
            );
          })}
        </tbody>
      </Frame>
    </>
  );
}

export function MarketTable({ o }: { o: Overview }) {
  const m = o.trends.market;
  if (m.status === "empty") return <Empty>{m.reason}</Empty>;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Market share at 11+, year by year</div>
      <Frame>
        <thead className="border-b border-[var(--panel-border)]">
          <tr>
            <Th>Year</Th>
            <Th>You</Th>
            <Th>{m.rivalName ?? "Largest rival"}</Th>
          </tr>
        </thead>
        <tbody>
          {m.school.map((p) => (
            <tr key={p.year} className="border-b border-[var(--panel-border)] last:border-0">
              <Td>{periodLabel(p.year)}</Td>
              <Td className="font-bold text-[var(--fg)]">{fmt(p.value, "share")}</Td>
              <Td>{fmt(m.rival.find((r) => r.year === p.year)?.value, "share")}</Td>
            </tr>
          ))}
        </tbody>
      </Frame>
    </>
  );
}

export function MixTable({ part }: { part: StagePart }) {
  const { keys, years } = part.mix;
  if (!years.length) return <Empty>No entries.</Empty>;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Entries mix, year by year</div>
      <Frame>
        <thead className="border-b border-[var(--panel-border)]">
          <tr>
            <Th>Year</Th>
            {keys.map((k) => (
              <Th key={k.key}>{k.label}</Th>
            ))}
            <Th>Entries</Th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.year} className="border-b border-[var(--panel-border)] last:border-0">
              <Td>{periodLabel(y.year)}</Td>
              {keys.map((k) => (
                <Td key={k.key}>{fmt(y.shares[k.key] ?? 0, "pct")}</Td>
              ))}
              <Td>{fmt(y.total, "pupils")}</Td>
            </tr>
          ))}
        </tbody>
      </Frame>
    </>
  );
}
