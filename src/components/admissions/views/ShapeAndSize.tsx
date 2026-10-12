"use client";

// VicData 0.7 admissions r2 (D3): Shape and size (ShapeView.dc.html) -- your profile by gender
// with the entry ages highlighted and the XS-XL badges, the LOCAL shape of the feeder set, and the
// rivals' shapes as small multiples: described, NOT ranked (R-ADM-SHAPE-NOT-RANKED,
// R-ADM-VIEW-SHAPES). The rivals stay in the set's own order; nothing sorts them by shape or size.
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { SHAPE_LABELS } from "@/components/dashboard/ShapeIcon";
import type { ShapeLabel } from "@/lib/shape-classifier";
import type { ShapeView } from "../api";
import { Empty, Lbl, Muted, fmtN } from "../ui";
import { shapeLine } from "../panels/EntryNow";

const label = (s: string | null) => (s ? (SHAPE_LABELS[s as ShapeLabel] ?? s) : "No census");

function Bars({ rows, highlight, colour = "var(--adm-grey-bar)", ages }: { rows: { age: number; female: number; male: number }[]; highlight: number[]; colour?: string; ages: [number, number] }) {
  const shown = rows.filter((r) => r.age >= ages[0] && r.age <= ages[1]).sort((a, b) => b.age - a.age);
  const max = Math.max(1, ...shown.map((r) => r.female + r.male));
  return (
    <div className="mt-1 flex flex-col gap-[3px]">
      {shown.map((r, i) => (
        <div key={r.age} className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-[6px] text-[10.5px] text-[var(--muted)]" title={`Age ${r.age}: ${fmtN(r.female + r.male)} (${fmtN(r.female)} girls · ${fmtN(r.male)} boys)`}>
          <span>{i === 0 ? `age ${r.age}` : r.age}</span>
          <span className="flex h-[11px]" style={{ width: `${((r.female + r.male) / max) * 100}%` }}>
            <span className="h-full rounded-l-[2px]" style={{ width: `${(r.female / Math.max(1, r.female + r.male)) * 100}%`, background: highlight.includes(r.age) ? "var(--accent)" : colour, opacity: 0.85 }} />
            <span className="h-full rounded-r-[2px]" style={{ width: `${(r.male / Math.max(1, r.female + r.male)) * 100}%`, background: highlight.includes(r.age) ? "var(--accent)" : colour }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Mini({ profile }: { profile: { age: number; female: number; male: number }[] }) {
  const rows = profile.filter((r) => r.female + r.male > 0);
  if (!rows.length) return null;
  // Four bands down the school's own range, oldest first, as the board's mini shapes.
  const lo = rows[0].age;
  const hi = rows[rows.length - 1].age;
  const step = Math.max(1, Math.ceil((hi - lo + 1) / 4));
  const bands = Array.from({ length: Math.ceil((hi - lo + 1) / step) }, (_, i) => rows.filter((r) => r.age >= lo + i * step && r.age < lo + (i + 1) * step).reduce((a, r) => a + r.female + r.male, 0)).reverse();
  const max = Math.max(1, ...bands);
  return (
    <div className="flex flex-col items-center gap-[2px]">
      {bands.map((b, i) => (
        <span key={i} className="block h-[6px] bg-[var(--adm-grey-2)]" style={{ width: `${(b / max) * 80}%` }} />
      ))}
    </div>
  );
}

// 0.7 admissions editor s2: `columns` -- the rivals' shapes in 1, 2 or 3 columns (full screen one
// more, up to 3). Shapes stay in the route's order, never ranked (R-ADM-SHAPE-NOT-RANKED).
export function ShapeAndSize({ s, entryAge, showLocal = true, fullscreen, columns = 2 }: { s: ShapeView; entryAge: number; showLocal?: boolean; fullscreen: boolean; columns?: 1 | 2 | 3 }) {
  if (!s.profile.some((r) => r.female + r.male > 0)) return <Empty>No census for this school: no shape to describe.</Empty>;
  const own = s.profile.filter((r) => r.female + r.male > 0);
  const ages: [number, number] = [own[0].age, own[own.length - 1].age];
  const entries = [entryAge, ...(entryAge < 16 && own.some((r) => r.age === 16) ? [16] : [])];
  const local = s.localProfile.filter((r) => r.female + r.male > 0);
  return (
    <div className="flex min-h-0 grow gap-[18px]">
      <div className="flex shrink-0 basis-[300px] flex-col gap-2">
        <Lbl>Your school</Lbl>
        <div className="text-[13px] font-bold text-[var(--fg)]">
          {label(s.shapeByYear.at(-1)?.shape ?? null)} <Muted size={13}>&middot; {shapeLine(s)?.replace(/^[^,]+, /, "") ?? ""}</Muted>
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {s.bands.map((b) => (
            <span key={b.key} className="inline-flex rounded-[6px] px-[7px] py-[2px] text-[11px] font-bold" style={b.key === s.entrySize.band ? { background: "var(--accent)", color: "var(--adm-on-accent)" } : { background: "var(--adm-rail-on)", color: "var(--chip-fg)" }}>
              {b.label} &middot; {b.badge ?? "—"}
            </span>
          ))}
        </div>
        <Muted>Bars by gender (girls lighter), as the school page&rsquo;s Shape card</Muted>
        <Bars rows={s.profile} highlight={entries} ages={ages} />
        <Muted className="leading-[1.4]">Entry ages highlighted. XS&ndash;XL against schools of that phase in {s.laName ?? "the LA"} and nationally (quintiles), as the school page; a phase can differ from the whole school.</Muted>
      </div>
      {showLocal && (
        <div className="flex shrink-0 basis-[210px] flex-col gap-2 border-l border-[var(--panel-border)] pl-4">
          <Lbl>Local shape</Lbl>
          <div className="text-[13px] font-bold text-[var(--fg)]">
            {label(s.localShape.shape)} <Muted size={13}>&middot; your feeders&rsquo; area</Muted>
          </div>
          <Muted className="leading-[1.4]">
            All pupils aged 4&ndash;{Math.max(4, entryAge - 1)} in your {s.localShape.schools} feeder schools, together. {ADMISSIONS_NOTES.localShape}
          </Muted>
          {local.length > 0 && <Bars rows={s.localProfile} highlight={[]} colour="var(--adm-grey-2)" ages={[Math.max(4, local[0].age), Math.max(4, Math.min(local[local.length - 1].age, entryAge - 1))]} />}
        </div>
      )}
      <div className="flex min-w-0 grow flex-col gap-2 border-l border-[var(--panel-border)] pl-4">
        <Lbl>Rivals&rsquo; shapes and sizes</Lbl>
        <Muted>{ADMISSIONS_NOTES.shapesShort}</Muted>
        <div className={`grid gap-2 ${GRID_COLS[Math.min(3, fullscreen ? columns + 1 : columns)]} overflow-y-auto`} style={fullscreen ? undefined : { maxHeight: 330 }}>
          {s.rivals.map((r) => (
            <div key={r.urn} className="flex flex-col gap-[5px] rounded-[9px] border border-[var(--panel-border)] bg-[var(--box-bg)] p-2" title={ADMISSIONS_NOTES.shape}>
              <span className="truncate text-[11.5px] font-bold text-[var(--fg)]">{r.name}</span>
              <Muted>
                {label(r.shape)} &middot; {r.size ?? "—"}
              </Muted>
              <Mini profile={r.profile} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

export const SHAPES_NOTE = "Shape labels use the shared classifier (Tube, Pyramid, Top step, Funnel, Mushroom, Wineglass, Irregular), the same for schools and areas.";
