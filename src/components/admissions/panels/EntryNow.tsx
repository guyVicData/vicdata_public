"use client";

// VicData 0.7 admissions r2 (D3): Pipelines, row 1, column 1 -- the entry point now (Main.dc.html).
// Four tiles (the entry cohort, its change since 2019/20, girls and boys, day and boarding for
// the whole school -- the census has no boarders by age; a day school's reads Day only, r3 F2), size by phase on the school page's
// XS-XL badges with its own caption (PhaseBreakdownCard: BADGE_ORDER, comparisonCaption; never
// new words), the shape line and the mini profile. R-ADM-VIEW-NOW. Every figure is the route's.
import { BADGE_ORDER, comparisonCaption } from "@/components/dashboard/PhaseBreakdownCard";
import { SHAPE_LABELS } from "@/components/dashboard/ShapeIcon";
import type { ShapeLabel } from "@/lib/shape-classifier";
import type { PipelineOk, ShapeView } from "../api";
import { Lbl, Tile, cx, fmtN, fmtPct, yearLabel } from "../ui";
import { arrowed } from "@/lib/signed-delta";

const yearWord = (age: number) => (age === 4 ? "Reception" : age >= 5 && age <= 17 ? `Year ${age - 4}` : `Age ${age}`);
export const cohortWord = (age: number) => (age === 4 ? "Reception" : `Year ${age - 4}`);

export function shapeLine(shape: ShapeView): string | null {
  const ys = shape.shapeByYear.filter((y) => y.shape);
  const now = ys.at(-1);
  if (!now?.shape) return null;
  const label = SHAPE_LABELS[now.shape as ShapeLabel] ?? now.shape;
  const changed = [...ys].reverse().find((y) => y.shape !== now.shape);
  return changed ? `${label}, since ${yearLabel(changed.year + 1)} (was ${SHAPE_LABELS[changed.shape as ShapeLabel] ?? changed.shape})` : `${label}, unchanged since ${yearLabel(ys[0].year)}`;
}

export function SizeRows({ shape, highlight }: { shape: ShapeView; highlight?: string }) {
  return (
    <>
      {shape.bands.map((b) => (
        <div key={b.key} className="flex items-center gap-2" title={b.distribution ? comparisonCaption(b.total, b.distribution.regionalMean, shape.laName, b.distribution.nationalMean) : "Not enough data yet to compare"}>
          <span className="w-[78px] truncate text-[12px] font-semibold text-[var(--fg)]">{b.label}</span>
          <span className="flex gap-[3px]">
            {BADGE_ORDER.map((s) => (
              <span key={s} className={cx("inline-flex items-center rounded-[6px] px-[7px] py-[2px] text-[11px] font-bold", s === b.badge ? "bg-[var(--accent)] text-[var(--adm-on-accent)]" : "bg-[var(--adm-rail-on)] text-[var(--muted)]", highlight === b.key && s === b.badge && "ring-1 ring-[var(--fg)]")}>
                {s}
              </span>
            ))}
          </span>
          <span className="grow" />
          <span className="text-[13px] font-bold tabular-nums text-[var(--fg)]">{fmtN(b.total)}</span>
        </div>
      ))}
    </>
  );
}

/** The mini profile: pupils by age across the school's own range, the entry age in the accent. */
export function MiniProfile({ shape, entryAge, height = 44 }: { shape: ShapeView; entryAge: number; height?: number }) {
  const ages = shape.profile.filter((a) => a.female + a.male > 0);
  if (!ages.length) return null;
  const max = Math.max(...ages.map((a) => a.female + a.male));
  return (
    <>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {ages.map((a) => (
          <span key={a.age} title={`Age ${a.age}: ${fmtN(a.female + a.male)} (${fmtN(a.female)} girls, ${fmtN(a.male)} boys)`} className="flex-1 rounded-[2px]" style={{ height: `${((a.female + a.male) / max) * 100}%`, background: a.age === entryAge ? "var(--accent)" : "var(--adm-grey-bar)" }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--muted)]">
        <span>age {ages[0].age}</span>
        <span>age {ages[ages.length - 1].age}</span>
      </div>
    </>
  );
}

export function EntryNow({ p, shape, compact = false }: { p: PipelineOk; shape: ShapeView | null; compact?: boolean }) {
  const n = p.now;
  const { girlsPct, boysPct, day } = n;
  const word = yearWord(p.entry.age);
  if (p.fe) {
    return (
      <>
        <div className="text-[12.5px] font-bold text-[var(--fg)]">Your {p.entry.label} entry point now</div>
        <div className="rounded-[9px] border border-[var(--panel-border)] p-3 text-[12px] leading-snug text-[var(--chip-fg)]">
          {p.fe.label}
          <div className="mt-2 flex gap-3">
            {p.fe.series.slice(-4).map((x) => (
              <span key={x.year} className="flex flex-col">
                <span className="text-[10.5px] text-[var(--muted2)]">{yearLabel(x.year)}</span>
                <span className="text-[16px] font-extrabold tabular-nums">{fmtN(x.value)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-[var(--muted2)]">A college has no school census: no Year 12 count, share or rank of its own is shown.</div>
      </>
    );
  }
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Your {p.entry.label.replace(/ \(.*\)$/, "")} entry point now</div>
      <div className="grid grid-cols-2 gap-2">
        <Tile label={`${word} now`} value={fmtN(n.cohort)} sub={`pupils aged ${p.entry.age}`} accent />
        <Tile label={`Since ${yearLabel(n.base.period)}`} value={n.changePct === null ? "—" : arrowed(n.changePct, (x) => `${x.toFixed(0)}%`, 0)} sub={`${word} cohort (${fmtN(n.base.cohort)} then)`} />
        {!compact && <Tile small label="Girls · boys" value={girlsPct === null ? "—" : `${girlsPct.toFixed(0)}% · ${(boysPct ?? 0).toFixed(0)}%`} sub={`in ${word}`} />}
        {/* 0.7 r3 (F2): one tile, the same place, either way. A boarding school sees day and
            boarding; a day school sees Day only -- the day count, no boarding half, no label. */}
        {!compact && (p.school.boarding ? <Tile small label="Day · boarding" value={`${fmtN(day)} · ${fmtN(n.boarders)}`} sub="whole school (no age split)" /> : <Tile small label="Day" value={fmtN(day ?? n.roll)} sub="whole school" />)}
      </div>
      {shape && !compact && (
        <div className="flex flex-col gap-[6px] border-t border-[var(--panel-border)] pt-2">
          <Lbl>Size by phase &middot; XS to XL</Lbl>
          <SizeRows shape={shape} />
          <div className="text-[12px] leading-[1.4] text-[var(--chip-fg)]">
            Against schools of that phase in {shape.laName ?? "the LA"} and nationally (the school page&rsquo;s Roll by phase).{shapeLine(shape) ? ` Shape: ${shapeLine(shape)}.` : ""}
          </div>
          <MiniProfile shape={shape} entryAge={p.entry.age} height={shape.bands.length >= 3 ? 26 : 44} />
        </div>
      )}
      {shape && compact && (
        <div className="text-[11px] text-[var(--muted2)]">
          {shape.bands.map((b) => `${b.label} ${b.badge ?? "—"}`).join(" · ")}
          {shapeLine(shape) ? ` · ${shapeLine(shape)}` : ""}
        </div>
      )}
    </>
  );
}

/** "LA context: Larger than the Worcestershire average" -- the school page's caption on the entry band. */
export function laContext(shape: ShapeView | null): string | null {
  const b = shape?.bands.find((x) => x.key === shape.entrySize.band) ?? shape?.bands[0];
  if (!shape || !b?.distribution) return null;
  // The school page's own caption, its first comparison only ("Larger than the Worcestershire …").
  const c = comparisonCaption(b.total, b.distribution.regionalMean, shape.laName, b.distribution.nationalMean);
  const first = c.split(" (")[0];
  return `LA context: ${first.replace(/ the$/, "")}${shape.laName && first.endsWith(shape.laName) ? " average" : ""}`;
}

export { fmtPct };
