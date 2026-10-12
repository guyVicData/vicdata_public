"use client";

// VicData 0.7 admissions r2 (D4): Rivals' momentum (RivalMomentum.dc.html) -- a scatter of each
// rival's change in pupils at the entry age (x, census, %) against its results change (y, the
// whole-school headline in points), both since 2022/23, in four quadrants; and the flag list. Each
// flag shows its figures on hover. With the national thresholds missing it says "flags not
// available yet" and never guesses (R-ADM-VIEW-MOMENTUM, R-ADM-VIEW-FLAGS, R-ADM-FLAG-MOMENTUM).
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { SHAPE_LABELS } from "@/components/dashboard/ShapeIcon";
import type { ShapeLabel } from "@/lib/shape-classifier";
import type { MarketView, RivalsView } from "../api";
import { Empty, FlagPill, Muted, cx, fmtSigned, yearLabel, type FlagTone } from "../ui";
import { useWidth } from "./charts";

type Flag = RivalsView["rows"][number]["momentum"][number];
const TONE: Record<string, FlagTone> = { results_rising_fast: "up", gaining_pupils: "up", losing_pupils_3y: "down", entry_year_shrinking: "down", new_sixth_form: "note", shape_changed: "note" };
const MARK: Record<string, string> = { results_rising_fast: "▲ ", gaining_pupils: "▲ ", losing_pupils_3y: "▼ ", entry_year_shrinking: "▼ " };

export const figuresOf = (f: Flag) =>
  `${f.label}\n` +
  Object.entries(f.figures)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : (v ?? "—")}`)
    .join("\n");

const shapeWord = (s: unknown) => SHAPE_LABELS[s as ShapeLabel] ?? String(s);
const flagText = (f: Flag) => (f.id === "shape_changed" ? `Shape changed: ${shapeWord(f.figures.from)} → ${shapeWord(f.figures.to)}` : f.label);

export function FlagList({ m, r, limit, notPlotted = [] }: { m: MarketView; r: RivalsView; limit?: number; notPlotted?: RivalsView["rows"] }) {
  const rows = r.rows.filter((x) => !x.isSchool);
  const sorted = [...rows].sort((a, b) => b.momentum.length - a.momentum.length);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <div className="flex min-w-0 grow flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_54px_54px] gap-[6px] border-b border-[var(--panel-border)] px-1 py-[6px] text-[10.5px] text-[var(--muted)]">
        <span>Rival &middot; flags</span>
        <span className="text-right">Pupils</span>
        <span className="text-right">Results</span>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {shown.map((x) => {
          const e = m.extras.find((q) => q.urn === x.urn);
          const rc = r.resultsChange[x.urn];
          return (
            <div key={x.urn} className="grid grid-cols-[minmax(0,1fr)_54px_54px] items-center gap-[6px] border-b border-[var(--panel-border)] px-1 py-[6px] text-[12px] text-[var(--chip-fg)]">
              <span className="min-w-0">
                <span className="block truncate">{x.name}</span>
                {r.thresholds === "not_loaded" && x.momentum.length === 0 ? null : x.momentum.length === 0 ? (
                  <Muted>No change worth flagging</Muted>
                ) : (
                  <span className="flex flex-wrap">
                    {x.momentum.map((f) => (
                      <span key={f.id} className="mr-1 mt-[3px]">
                        <FlagPill tone={TONE[f.id] ?? "note"} small figures={figuresOf(f)}>
                          {MARK[f.id] ?? ""}
                          {flagText(f)}
                        </FlagPill>
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="text-right tabular-nums" title={e ? `${e.entryBase ?? "—"} → ${e.entryNow ?? "—"} aged ${m.entry.age}, ${yearLabel(2022)} to ${yearLabel(m.summary.latest)}` : undefined}>
                {fmtSigned(e?.entryChangePct, 0)}
              </span>
              <span className="text-right tabular-nums" title={rc ? `${rc.from ?? "—"} → ${rc.to ?? "—"}` : undefined}>
                {x.results.note === "igcse_not_ranked" ? "IGCSE" : fmtSigned(rc?.points, 1, "")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10.5px] leading-[1.4] text-[var(--muted2)]">
        {r.thresholds === "not_loaded" ? ADMISSIONS_NOTES.flagsMissing : ADMISSIONS_NOTES.flagsRule}
        {notPlotted.length > 0 && (
          <span title={notPlotted.map((x) => `${x.name}${x.results.note === "igcse_not_ranked" ? " (IGCSE)" : x.results.note === "no_published_results" ? " (no published results)" : ""}`).join("\n")}>
            {" "}Not on the scatter: {notPlotted.length} (no change to plot).
          </span>
        )}
      </div>
    </div>
  );
}

export function Momentum({ m, r, fullscreen }: { m: MarketView; r: RivalsView; fullscreen: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const pts = r.rows
    .map((x) => ({ x, e: m.extras.find((q) => q.urn === x.urn), rc: r.resultsChange[x.urn] }))
    .filter((p) => p.e?.entryChangePct != null && p.rc?.points != null);
  const left = r.rows.filter((x) => !pts.some((p) => p.x.urn === x.urn));
  const H = fullscreen ? 480 : 360;
  const maxX = Math.max(5, ...pts.map((p) => Math.abs(p.e!.entryChangePct!))) * 1.15;
  const maxY = Math.max(1, ...pts.map((p) => Math.abs(p.rc!.points!))) * 1.15;
  const W = Math.max(w, 10);
  const sx = (v: number) => 12 + ((v + maxX) / (2 * maxX)) * (W - 24);
  const sy = (v: number) => 12 + ((maxY - v) / (2 * maxY)) * (H - 50);
  const labelTop = new Map<string, number>();
  const results = r.stage === "ks4" ? "Attainment 8" : r.stage === "ks5" ? "A-level points per entry" : "KS2 expected standard (%)";
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-[var(--fg)]">Who is gaining pupils, and whose results are rising?</span>
      </div>
      <div className="flex min-h-0 grow gap-[18px]">
        <div ref={ref} className="relative shrink-0 basis-[470px] rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)]" style={{ height: H }}>
          {w > 0 && (
            <>
              <span className="absolute bottom-[26px] top-2 w-px bg-[var(--panel-border2)]" style={{ left: sx(0) }} />
              <span className="absolute left-2 right-2 h-px bg-[var(--panel-border2)]" style={{ top: sy(0) }} />
              <span className="absolute right-[10px] top-[10px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--adm-quadrant)]">Growing &middot; improving</span>
              <span className="absolute left-[10px] top-[10px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--adm-quadrant)]">Shrinking &middot; improving</span>
              <span className="absolute bottom-8 right-[10px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--adm-quadrant)]">Growing &middot; slipping</span>
              <span className="absolute bottom-8 left-[10px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--adm-quadrant)]">Shrinking &middot; slipping</span>
              {(() => {
                // Labels nudged down until they clear the one above them (same columns only).
                const placed: { l: number; t: number; w: number }[] = [];
                labelTop.clear();
                for (const p of [...pts].sort((a, b) => sy(a.rc!.points!) - sy(b.rc!.points!))) {
                  const l = sx(p.e!.entryChangePct!) + 10;
                  const w = Math.min(150, (p.x.isSchool ? 3 : Math.min(22, p.x.name.length)) * 6 + 8);
                  let t = sy(p.rc!.points!) - 7;
                  while (placed.some((q) => Math.abs(q.t - t) < 12 && l < q.l + q.w && q.l < l + w)) t += 12;
                  placed.push({ l, t, w });
                  labelTop.set(p.x.urn, t);
                }
                return null;
              })()}
              {pts.map(({ x, e, rc }) => {
                const me = x.isSchool;
                const up = x.momentum.some((f) => TONE[f.id] === "up");
                const down = x.momentum.some((f) => TONE[f.id] === "down");
                const size = me ? 14 : 11;
                return (
                  <span key={x.urn} title={`${x.name}: pupils aged ${m.entry.age} ${fmtSigned(e!.entryChangePct, 1)}, ${results} ${fmtSigned(rc!.points, 1, " pts")} (since ${yearLabel(2022)})${x.momentum.length ? `\n${x.momentum.map(flagText).join(" · ")}` : ""}`}>
                    <span
                      className={cx("absolute rounded-full", me && "border-2 border-white")}
                      style={{ left: sx(e!.entryChangePct!) - size / 2, top: sy(rc!.points!) - size / 2, width: size, height: size, boxSizing: "border-box", background: me ? "var(--accent)" : up ? "var(--adm-amber)" : down ? "var(--adm-down-fg)" : "var(--adm-grey-line)" }}
                    />
                    <span className={cx("absolute whitespace-nowrap text-[10.5px]", me ? "font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]")} style={{ left: sx(e!.entryChangePct!) + size / 2 + 3, top: labelTop.get(x.urn) ?? sy(rc!.points!) - 7 }}>
                      {me ? "You" : x.name.length > 22 ? `${x.name.slice(0, 21)}…` : x.name}
                    </span>
                  </span>
                );
              })}
              <div className="absolute bottom-[6px] left-[10px] right-[10px] flex justify-between text-[10.5px] text-[var(--muted)]">
                <span>&larr; losing pupils</span>
                <span>pupils aged {m.entry.age}, % change</span>
                <span>gaining &rarr;</span>
              </div>
              <div className="absolute whitespace-nowrap text-[10.5px] text-[var(--muted)]" style={{ left: 9, top: "50%", transform: "translate(-50%, -50%) rotate(-90deg)" }}>
                results change &uarr;
              </div>
            </>
          )}
        </div>
        <FlagList m={m} r={r} notPlotted={left} />
      </div>
    </>
  );
}

export function momentumChips(m: MarketView, r: RivalsView | null) {
  return { pupils: `Pupils: aged ${m.entry.age}`, results: `Results: ${r?.stage === "ks5" ? "A-level points" : r?.stage === "ks2" ? "KS2 expected" : "Attainment 8"}` };
}

export function NoRivals() {
  return <Empty>No rivals in this set.</Empty>;
}
