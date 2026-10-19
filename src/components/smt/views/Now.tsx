"use client";

// VicData 0.8 SMT r1: Overview, column 1 -- "The school now" (Main.dc.html, LeightonLight.dc.html,
// Phone.dc.html). Roll and its change since 2019/20; girls · boys (or day · boarding at a boarding
// school); each phase's headline with its national rank; A-level value added; Progress 8 or the
// reason it isn't there (R-SMT-P8-REASON); the school page's XS-XL by phase. R-SMT-VIEW-NOW.
import { BADGE_ORDER, comparisonCaption } from "@/components/dashboard/PhaseBreakdownCard";
import { Lbl, PairTile, Tile, cx } from "@/components/admissions/ui";
import { CENSUS_FIRST_PERIOD, periodLabel } from "@/catalogue/years";
import { SMT_NOTES } from "@/catalogue/notes";
import type { Overview, SmtSchool } from "../api";
import { NoteTile, fmt, ord, yearOf } from "../ui";
import { arrowed, signedDelta } from "@/lib/signed-delta";
import type { EntryTile } from "@/lib/smt/entry-net";

/** F-8: one entry tile, kept very simple (Guy): "Net change at 16  +14,  +40% since 2019/20". */
export function EntryTileView({ t }: { t: EntryTile }) {
  const value = t.key === "join11" ? fmt(t.value, "pupils") : signedDelta(t.value, (x) => Math.abs(Math.round(x)).toLocaleString("en-GB"), { zero: "±" });
  // 0.8 SMT feedback round 2: the % says which year group it is about.
  const group = t.key === "net16" ? "Year 12" : "Year 7";
  const sub = t.since ? `${group} ${signedDelta(t.since.pct, (x) => `${Math.abs(x).toFixed(0)}%`, { zero: "±" })} since ${periodLabel(t.since.base)}` : "—";
  return (
    <div data-entry-tile={t.key}>
      <Tile small label={t.label} value={value} sub={sub} />
    </div>
  );
}

export function SizeByPhase({ sizes, school, caption = true }: { sizes: Overview["now"]["sizes"]; school: SmtSchool; caption?: boolean }) {
  if (!sizes.length) return null;
  return (
    <div className="flex flex-col gap-[6px] border-t border-[var(--panel-border)] pt-2">
      <Lbl>Size by phase &middot; XS to XL</Lbl>
      {sizes.map((b) => (
        <div key={b.key} className="flex items-center gap-2" title={b.laMean !== null && b.englandMean !== null ? comparisonCaption(b.total, b.laMean, school.laName, b.englandMean) : "Not enough data yet to compare"}>
          <span className="w-[78px] truncate text-[12px] font-semibold text-[var(--fg)]">{b.label === "Sixth Form" ? "16+" : b.label === "Secondary" ? "Senior" : b.label}</span>
          <span className="flex gap-[3px]">
            {BADGE_ORDER.map((s) => (
              <span key={s} className={cx("inline-flex items-center rounded-[6px] px-[7px] py-[2px] text-[11px] font-bold", s === b.badge ? "bg-[var(--accent)] text-[var(--adm-on-accent)]" : "bg-[var(--adm-rail-on)] text-[var(--muted)]")}>
                {s}
              </span>
            ))}
          </span>
          <span className="grow" />
          <span className="text-[13px] font-bold tabular-nums text-[var(--fg)]">{fmt(b.total, "pupils")}</span>
        </div>
      ))}
      {caption && <div className="text-[12px] leading-[1.4] text-[var(--chip-fg)]">Against schools of that phase in {school.laName ?? "the LA"} and nationally (the school page&rsquo;s Roll by phase).</div>}
    </div>
  );
}

/** 0.8 SMT feedback round 2 (F-10): size by phase against the selected set -- each phase's pupils, the
 * school's place by size among the set's schools with that phase, and the set's median. (Pupils keeps the
 * school page's XS to XL, SizeByPhase above.) */
export function SetSizeByPhase({ sizes, setShort }: { sizes: Overview["now"]["setSizes"]; setShort: string }) {
  if (!sizes.length) return null;
  return (
    <div className="flex flex-col gap-[6px] border-t border-[var(--panel-border)] pt-2" data-set-sizes="">
      <Lbl>Size by phase &middot; in {setShort}</Lbl>
      {sizes.map((b) => (
        <div key={b.key} className="flex items-center gap-2" data-set-size={b.key}>
          <span className="w-[62px] truncate text-[12px] font-semibold text-[var(--fg)]">{phaseWord(b.label)}</span>
          <span className="text-[13px] font-bold tabular-nums text-[var(--fg)]">{fmt(b.total, "pupils")}</span>
          <span className="grow" />
          <span className="text-[11.5px] text-[var(--chip-fg)]">{b.schools ? `${ord(b.rank)} largest of ${b.of}` : "no other school in the set has this phase"}</span>
          {b.median !== null && <span className="w-[86px] text-right text-[11px] text-[var(--muted2)]">median {fmt(b.median, "pupils")}</span>}
        </div>
      ))}
    </div>
  );
}

const phaseWord = (label: string) => (label === "Sixth Form" ? "16+" : label === "Secondary" ? "Senior" : label);
const setRankSub = (r: { set: { rank: number; of: number } | null; value: number | null } | undefined, short: string) => (r?.set ? `${ord(r.set.rank)} of ${r.set.of} in ${short}` : r && r.value !== null ? `not ranked in ${short}` : "no published results");

export function SchoolNow({ o, school, compact = false }: { o: Overview; school: SmtSchool; compact?: boolean }) {
  const n = o.now;
  const row = (key: string) => o.rows.find((r) => r.key === key);
  const a8 = row("attainment8_average");
  const aps = row("A level::aps_per_entry");
  const ks2 = o.rows.find((r) => r.stage === "ks2");
  const change = n.changePct === null ? "—" : `${arrowed(n.changePct, (x) => `${x.toFixed(0)}%`, 0)} since ${periodLabel(CENSUS_FIRST_PERIOD)}`;
  const tiles = [
    <Tile key="roll" label="Roll" value={fmt(n.roll, "pupils")} sub={change} accent />,
    n.boarding ? (
      <PairTile key="db" pairs={[{ label: "Day", value: fmt(n.boarding.day, "pupils") }, { label: "Boarding", value: fmt(n.boarding.boarders, "pupils") }]} sub="in whole school" />
    ) : (
      <PairTile key="gb" pairs={[{ label: "Girls", value: n.girls !== null && n.boys !== null && n.roll ? `${Math.round((n.girls / (n.girls + n.boys)) * 100)}%` : "—" }, { label: "Boys", value: n.girls !== null && n.boys !== null && n.roll ? `${Math.round((n.boys / (n.girls + n.boys)) * 100)}%` : "—" }]} sub={`${school.gender === "Mixed" ? "mixed" : (school.gender ?? "").toLowerCase()}${school.low !== null && school.high !== null ? `, ages ${school.low}–${school.high}` : ""}`} />
    ),
  ];
  if (school.phases.gcse) {
    tiles.push(
      o.igcse ? (
        <NoteTile key="a8" label="GCSE" title="IGCSE school" sub="no comparable GCSE results" />
      ) : (
        <Tile key="a8" small label="Attainment 8 · GCSE" value={fmt(a8?.value, "points")} sub={setRankSub(a8, o.set.short)} />
      ),
    );
  }
  if (school.phases.post16) tiles.push(<Tile key="aps" small label="Points per entry · A level" value={fmt(aps?.value, "points", aps?.key)} sub={setRankSub(aps, o.set.short)} />);
  if (ks2) tiles.push(<Tile key="ks2" small label="KS2 · reading, writing, maths" value={fmt(ks2.value, "pct")} sub={setRankSub(ks2, o.set.short)} />);
  if (school.phases.post16) tiles.push(o.va ? <Tile key="va" small label="A-level value added" value={fmt(o.va.value, "va")} sub={`DfE, ${yearOf(o.va.period)}`} /> : <NoteTile key="va" label="A-level value added" title="Not published" sub={SMT_NOTES.vaNotPublished} />);
  if (school.phases.gcse) tiles.push(o.p8.status === "published" ? <Tile key="p8" small label="Progress 8" value={fmt(o.p8.value, "va")} sub={`${yearOf(o.p8.period)}; none since (no KS2 baseline)`} /> : <NoteTile key="p8" label="Progress 8" title="Not published" sub={o.p8.status === "independent" ? "for independent schools" : o.p8.status === "no_baseline" ? o.p8.text.replace(/^Progress 8 is not published /, "") : o.p8.text} />);
  // F-8 (R-INDEP-ENTRY-TILES): an independent school's GCSE note and Progress 8 note give way to its entry
  // tiles -- the label, this year's number and one change since 2019/20; the arithmetic is in the (i).
  if (n.entry) {
    const drop = new Set(["p8", ...(o.igcse || !a8?.england ? ["a8"] : [])]);
    for (let i = tiles.length - 1; i >= 0; i--) if (drop.has(String(tiles[i].key))) tiles.splice(i, 1);
    for (const t of n.entry) tiles.push(<EntryTileView key={t.key} t={t} />);
  }
  if (compact) {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">{tiles.slice(0, 4)}</div>
        <div className="text-[11px] text-[var(--muted2)]">{(n.setSizes ?? []).map((b) => `${phaseWord(b.label)} ${b.schools ? `${ord(b.rank)} of ${b.of}` : "—"}`).join(" · ")}{n.setSizes?.length ? ` in ${o.set.short}` : ""}</div>
      </>
    );
  }
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">The school now</div>
      <div className="grid grid-cols-2 gap-2">{tiles}</div>
      <SetSizeByPhase sizes={o.now.setSizes ?? []} setShort={o.set.short} />
    </>
  );
}
