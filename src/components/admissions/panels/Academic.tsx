"use client";

// VicData 0.7 admissions r2 (D4): Market share, row 2, column 2 -- the academic panel by entry point
// (4+ → KS2, 11+ → GCSE, 16+ → Post-16): the overall rank among the rivals, then where the school
// leads and trails (subject areas, R-ADM-FLAG-STRENGTHS); rivals that aren't ranked say why.
// R-ADM-VIEW-ACADEMIC. Rail: Ranking · Numbers · % change.
import Link from "next/link";
import type { RivalsView } from "../api";
import { Empty, Muted, cx, fmtSigned, ordinal, arrow } from "../ui";
import { DivergingBar } from "../views/charts";
import { overallLine } from "../views/Strengths";

export const STAGE_WORD = { ks2: "KS2", ks4: "GCSE", ks5: "Post-16" } as const;

const unrankedLine = (r: RivalsView) => {
  const u = r.overall?.unranked ?? r.rows.filter((x) => x.results.note !== null).map((x) => ({ urn: x.urn, name: x.name, note: x.results.note }));
  if (!u.length) return null;
  const why = Array.from(new Set(u.map((x) => (x.note === "igcse_not_ranked" ? "IGCSE school" : "no published results"))));
  return `${u.length} rival${u.length === 1 ? "" : "s"} not ranked: ${why.join("; ")}`;
};

const ROW = "grid grid-cols-[30px_minmax(0,1fr)_46px_52px] gap-[6px] rounded-[5px] px-1 py-[3px] text-[11.5px] text-[var(--chip-fg)]";

export function AcademicRanking({ r }: { r: RivalsView }) {
  const line = overallLine(r);
  if (!line && !r.rows.some((x) => x.results.value !== null)) return <Empty>No published {STAGE_WORD[r.stage]} results for this school or its rivals{r.stage === "ks2" ? ": most preps don't sit SATs" : ""}.</Empty>;
  const lead = r.areas.filter((a) => a.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
  const trail = r.areas.filter((a) => a.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 2);
  return (
    <div className="flex min-w-0 grow flex-col gap-[2px]">
      <div className="mb-[2px] text-[12.5px] font-bold text-[var(--fg)]">{line?.split(" · ")[0] ?? `No ranked ${STAGE_WORD[r.stage]} headline for this school`}</div>
      <Muted className="mb-1">
        {r.overall?.national ? `${ordinal(r.overall.national.rank)} of ${r.overall.national.of.toLocaleString("en-GB")} in England` : "Not ranked in England"}
        {r.overall?.change != null ? ` · ${arrow(r.overall.change, 0.05)} ${Math.abs(r.overall.change).toFixed(1)} since 2022/23` : ""}
      </Muted>
      {r.stage !== "ks2" && lead.length > 0 && <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--adm-up-fg)]">Where you lead the rivals</div>}
      {lead.map((a) => (
        <div key={a.familyId} className={ROW}>
          <span>{ordinal(a.rank)}</span>
          <span className="truncate">{r.areaLabels[a.familyId] ?? a.familyId}</span>
          <span className="tabular-nums">{fmtSigned(a.gap, 2, "")}</span>
          <span>{arrow(a.gapSince2223, 0.05)}</span>
        </div>
      ))}
      {r.stage !== "ks2" && trail.length > 0 && <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--adm-down-fg)]">Where you trail</div>}
      {trail.map((a) => (
        <div key={a.familyId} className={ROW}>
          <span>{ordinal(a.rank)}</span>
          <span className="truncate">{r.areaLabels[a.familyId] ?? a.familyId}</span>
          <span className="tabular-nums">{fmtSigned(a.gap, 2, "")}</span>
          <span>{arrow(a.gapSince2223, 0.05)}</span>
        </div>
      ))}
      {r.stage === "ks2" && <Muted>KS2 has no subject areas: the headline is reading, writing and maths at the expected standard.</Muted>}
      {unrankedLine(r) && <Muted className="mt-[2px]">{unrankedLine(r)}</Muted>}
    </div>
  );
}

export function AcademicNumbers({ r }: { r: RivalsView }) {
  const rows = [...r.rows].sort((a, b) => (b.results.value ?? -1e9) - (a.results.value ?? -1e9));
  return (
    <div className="flex min-w-0 grow flex-col gap-[2px] overflow-y-auto">
      <div className="mb-1 text-[12.5px] font-bold text-[var(--fg)]">{r.overall?.measure ?? STAGE_WORD[r.stage]}: the rivals&rsquo; figures</div>
      {rows.map((x) => (
        <div key={x.urn} className={cx("grid grid-cols-[minmax(0,1fr)_48px_64px] gap-[6px] rounded-[5px] px-1 py-[3px] text-[11.5px]", x.isSchool ? "bg-[var(--adm-tint)] font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]")}>
          <span className="truncate">{x.name}</span>
          <span className="text-right tabular-nums">{x.results.note === "igcse_not_ranked" ? "IGCSE" : x.results.value === null ? "—" : x.results.value.toFixed(1)}</span>
          <span className="text-right">{x.results.national ? `${ordinal(x.results.national.rank)}` : "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function AcademicChange({ r }: { r: RivalsView }) {
  const rows = r.rows.map((x) => ({ x, c: r.resultsChange[x.urn]?.points ?? null })).sort((a, b) => (b.c ?? -1e9) - (a.c ?? -1e9));
  const max = Math.max(0.5, ...rows.map((q) => Math.abs(q.c ?? 0)));
  return (
    <div className="flex min-w-0 grow flex-col gap-1 overflow-y-auto">
      <div className="mb-1 text-[12.5px] font-bold text-[var(--fg)]">Change since 2022/23 ({r.overall?.measure ?? STAGE_WORD[r.stage]}, points)</div>
      {rows.map(({ x, c }) => (
        <div key={x.urn} className={cx("grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_44px] items-center gap-2 text-[11.5px]", x.isSchool ? "font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]")}>
          <span className="truncate">{x.name}</span>
          <DivergingBar value={c} max={max} positive={x.isSchool ? "var(--accent)" : "var(--adm-grey-soft)"} negative={x.isSchool ? "var(--adm-orange)" : "var(--adm-grey-2)"} />
          <span className="text-right tabular-nums">{x.results.note === "igcse_not_ranked" ? "IGCSE" : fmtSigned(c, 1, "")}</span>
        </div>
      ))}
    </div>
  );
}

export function AcademicFooter({ explorerHref }: { explorerHref: string | null }) {
  return (
    <span className="truncate text-[11px] text-[var(--muted2)]">
      4+ &rarr; KS2 &middot; 11+ &rarr; GCSE &middot; 16+ &rarr; Post-16 &middot;{" "}
      {explorerHref ? (
        <Link href={explorerHref} title="Open in the subject explorer with these rivals" className="hover:text-[var(--fg)]">
          subject explorer &rarr;
        </Link>
      ) : (
        "subject explorer →"
      )}
    </span>
  );
}
