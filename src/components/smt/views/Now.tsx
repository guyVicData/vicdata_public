"use client";

// VicData 0.8 SMT r1: Overview, column 1 -- "The school now" (Main.dc.html, LeightonLight.dc.html,
// Phone.dc.html). Roll and its change since 2019/20; girls · boys (or day · boarding at a boarding
// school); each phase's headline with its national rank; A-level value added; Progress 8 or the
// reason it isn't there (R-SMT-P8-REASON); the school page's XS-XL by phase. R-SMT-VIEW-NOW.
import { BADGE_ORDER, comparisonCaption } from "@/components/dashboard/PhaseBreakdownCard";
import { Lbl, Tile, cx } from "@/components/admissions/ui";
import { CENSUS_FIRST_PERIOD, periodLabel } from "@/catalogue/years";
import { SMT_NOTES } from "@/catalogue/notes";
import type { Overview, SmtSchool } from "../api";
import { NoteTile, fmt, rankText, yearOf } from "../ui";

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

export function SchoolNow({ o, school, compact = false }: { o: Overview; school: SmtSchool; compact?: boolean }) {
  const n = o.now;
  const row = (key: string) => o.rows.find((r) => r.key === key);
  const a8 = row("attainment8_average");
  const aps = row("A level::aps_per_entry");
  const ks2 = o.rows.find((r) => r.stage === "ks2");
  const change = n.changePct === null ? "—" : `${n.changePct >= 0 ? "▲" : "▼"} ${Math.abs(n.changePct).toFixed(0)}% since ${periodLabel(CENSUS_FIRST_PERIOD)}`;
  const tiles = [
    <Tile key="roll" label="Roll" value={fmt(n.roll, "pupils")} sub={change} accent />,
    n.boarding ? (
      <Tile key="db" small label="Day · boarding" value={`${fmt(n.boarding.day, "pupils")} · ${fmt(n.boarding.boarders, "pupils")}`} sub="whole school" />
    ) : (
      <Tile key="gb" small label="Girls · boys" value={n.girls !== null && n.boys !== null && n.roll ? `${Math.round((n.girls / (n.girls + n.boys)) * 100)}% · ${Math.round((n.boys / (n.girls + n.boys)) * 100)}%` : "—"} sub={`${school.gender === "Mixed" ? "mixed" : (school.gender ?? "").toLowerCase()}${school.low !== null && school.high !== null ? `, ages ${school.low}–${school.high}` : ""}`} />
    ),
  ];
  if (school.phases.gcse) {
    tiles.push(
      a8?.note === "igcse" ? (
        <NoteTile key="a8" label="GCSE" title="IGCSE school" sub="no comparable GCSE results" />
      ) : (
        <Tile key="a8" small label="Attainment 8 · GCSE" value={fmt(a8?.value, "points")} sub={a8?.england ? `national rank ${rankText(a8.england)}` : `no published results`} />
      ),
    );
  }
  if (school.phases.post16) tiles.push(<Tile key="aps" small label="Points per entry · A level" value={fmt(aps?.value, "points", aps?.key)} sub={aps?.england ? `national rank ${rankText(aps.england)}` : "no published results"} />);
  if (ks2) tiles.push(<Tile key="ks2" small label="KS2 · reading, writing, maths" value={fmt(ks2.value, "pct")} sub={ks2.england ? `national rank ${rankText(ks2.england)}` : "no published results"} />);
  if (school.phases.post16) tiles.push(o.va ? <Tile key="va" small label="A-level value added" value={fmt(o.va.value, "va")} sub={`DfE, ${yearOf(o.va.period)}`} /> : <NoteTile key="va" label="A-level value added" title="Not published" sub={SMT_NOTES.vaNotPublished} />);
  if (school.phases.gcse) tiles.push(o.p8.status === "published" ? <Tile key="p8" small label="Progress 8" value={fmt(o.p8.value, "va")} sub={`${yearOf(o.p8.period)}; none since (no KS2 baseline)`} /> : <NoteTile key="p8" label="Progress 8" title="Not published" sub={o.p8.status === "independent" ? "for independent schools" : o.p8.status === "no_baseline" ? o.p8.text.replace(/^Progress 8 is not published /, "") : o.p8.text} />);
  if (compact) {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">{tiles.slice(0, 4)}</div>
        <div className="text-[11px] text-[var(--muted2)]">{n.sizes.map((b) => `${b.label === "Sixth Form" ? "16+" : b.label === "Secondary" ? "Senior" : b.label} ${b.badge ?? "—"}`).join(" · ")}</div>
      </>
    );
  }
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">The school now</div>
      <div className="grid grid-cols-2 gap-2">{tiles}</div>
      <SizeByPhase sizes={o.now.sizes} school={school} />
    </>
  );
}
