"use client";

// VicData 0.8 SMT round 1 (B6; the Home board): the SMT home's first card, "The school" -- the SMT
// dashboards as shortcut chips (Overview and Academic live; Pupils and Context shown as coming, SMT
// round 2) and a one-line summary from the Overview's own figures: the roll's change, the headline
// rank in the comparison set, the number of flags. The same reads as the dashboard (the member's
// remembered set), so the line and the page agree.
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { productAccent } from "@/components/shell/accent";
import { SMT_COMING } from "@/catalogue/dashboards/smt";
import { CENSUS_FIRST_PERIOD, periodLabel } from "@/catalogue/years";
import { setPhaseOf } from "@/lib/smt/levels";
import { useSmt, type Overview, type SmtSchool } from "./api";
import { loadSmtMember, type SmtMember } from "./member";
import { useSmtSet } from "./useSmtSet";

const S = productAccent("smt")!;

const SchoolGlyph = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

/** "Roll ▲ 16% · Attainment 8 2nd of 11 · 1 flag": the Overview's own figures, never new ones. */
export function summaryLine(o: Overview): string {
  const parts: string[] = [];
  if (o.now.changePct !== null) parts.push(`Roll ${o.now.changePct >= 0 ? "▲" : "▼"} ${Math.abs(o.now.changePct).toFixed(0)}% since ${periodLabel(CENSUS_FIRST_PERIOD)}`);
  const head = o.rows.find((r) => r.stage && r.stage !== "ks2" && r.unit === "points" && r.set);
  if (head?.set) parts.push(`${head.label === "A level: points per entry" ? "A-level points" : head.label} ${head.set.rank} of ${head.set.of}`);
  parts.push(o.flags.length === 1 ? "1 flag" : `${o.flags.length} flags`);
  return parts.join(" · ");
}

function Summary({ member }: { member: SmtMember }) {
  const school = useSmt<SmtSchool>(`/api/smt/school?urn=${member.schoolUrn}`, null);
  const s = school.status === "ready" ? school.data : null;
  const sets = useSmtSet(member.schoolUrn, s ? setPhaseOf(s.phases) : null);
  const o = useSmt<Overview>(s && sets.set ? "/api/smt/overview" : null, sets.set ? { urn: member.schoolUrn, set: sets.set, filters: { sex: "all", boarding: "all" } } : null);
  return <p className="mt-2.5 text-[12.5px] text-[var(--muted2)]" data-smt-summary="">{o.status === "ready" ? summaryLine(o.data) : o.status === "error" ? "" : "…"}</p>;
}

export function SchoolTile() {
  const [member, setMember] = useState<SmtMember | null>(null);
  useEffect(() => {
    loadSmtMember().then((m) => setMember(m.status === "ready" && m.member.access !== "none" ? m.member : null));
  }, []);
  const chip = "rounded-full px-3 py-[5px] text-[12px] font-bold";
  return (
    <div style={{ "--tile": S.hex, "--tile-rgb": S.rgb } as CSSProperties} className="rounded-[14px] border-[1.5px] border-[rgba(var(--tile-rgb),0.45)] bg-[var(--panel-bg)] p-4">
      <Link href="/teacher/smt" className="flex items-center gap-3">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--tile-rgb),0.14)] text-[var(--tile)]">{SchoolGlyph}</div>
        <div className="min-w-0 flex-grow">
          <p className="text-[15px] font-bold">The school</p>
          <p className="mt-0.5 text-[13px] text-[var(--muted2)]">How are we doing, and what&rsquo;s changing around us?</p>
        </div>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/teacher/smt" className={`${chip} bg-[rgba(var(--tile-rgb),0.14)] text-[var(--fg)] hover:bg-[rgba(var(--tile-rgb),0.24)]`}>
          Overview
        </Link>
        <Link href="/teacher/smt/academic" className={`${chip} bg-[rgba(var(--tile-rgb),0.14)] text-[var(--fg)] hover:bg-[rgba(var(--tile-rgb),0.24)]`}>
          Academic
        </Link>
        {SMT_COMING.map((d) => (
          <span key={d.id} className={`${chip} border border-dashed border-[var(--panel-border2)] text-[var(--muted3,var(--muted))]`} title="Coming in SMT round 2">
            {d.name}
          </span>
        ))}
      </div>
      {member && <Summary member={member} />}
    </div>
  );
}
