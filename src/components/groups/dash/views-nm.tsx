"use client";

// VicData 0.8 non-mainstream groups, M6: a special and AP trust's or nursery federation's Group pages --
// the group now (its schools by kind, roll, same-schools change and FSM), against others (its peer set and
// its kinds' state-funded pools, or a set of groups side by side), its mainstream line, FSM over the years
// and the "no results compared" state (R-NM-NO-RESULTS). Nothing here computes a figure: every value and
// n is production's, worded by src/lib/groups/dash-nm.ts; the views only lay them out.
import type { ReactNode } from "react";
import { Empty, Lbl, LineSwatch, Tile, fillHeight } from "@/components/admissions/ui";
import { LineChart } from "@/components/admissions/views/charts";
import { periodLabel } from "@/catalogue/years";
import { POOL_MIN_NOTE, tooFewWords, type GroupOverview } from "@/lib/groups/dash";
import type { NmRow } from "@/lib/groups/dash-nm";
import { arrowOf, dirClass, Td, Th } from "@/components/smt/ui";
import { arrowed } from "@/lib/signed-delta";
import { SetKey } from "./views";
import { SetTrend } from "./views-sets";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);
const change = (v: number | null | undefined) => (v === null || v === undefined ? "—" : arrowed(v, (x) => `${x.toFixed(1)}%`, 1, 0.5));
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-GB"));

export function NmNow({ o, compact }: { o: GroupOverview; compact: boolean }) {
  const nm = o.nm!;
  const peer = nm.against.find((r) => r.kind === "peer_band");
  const c1 = o.now.change["1"];
  return (
    <div className="flex flex-col gap-2.5" data-nm-now={nm.family}>
      {!compact && <div className="text-[13px] font-bold text-[var(--fg)]">The group now</div>}
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Schools" accent value={<span className="text-[var(--accent)]">{o.now.notCounted ? <>{o.now.schools} <span className="text-[13px] font-semibold text-[var(--muted2)]">of {o.now.notCounted.total}</span></> : o.now.schools}</span>} sub={o.now.notCounted ? o.now.notCounted.words : nm.byKind} />
        <Tile label="Roll" value={n(o.now.roll)} sub={<>{change(c1.sameSchools)} since {periodLabel(c1.from)}, same schools</>} />
        <Tile label="FSM" value={pct(nm.fsm.pct)} sub={peer ? `${peer.label}: ${pct(peer.fsm)}` : " "} />
        <Tile label="Areas" value={`${o.now.las.length} LA${o.now.las.length === 1 ? "" : "s"}`} sub={o.now.regions.filter((r) => r.code !== "outside_england").map((r) => r.name).join(", ") || " "} />
      </div>
      {!compact && (
        <>
          <div className="flex flex-col gap-0.5 border-t border-[var(--panel-border)] pt-2 text-[11.5px]">
            <Lbl>Its schools</Lbl>
            <div>{nm.countedByKind} in its own figures</div>
            {o.now.notCounted && <div className="text-[var(--muted2)]">{o.now.notCounted.words}: compared with mainstream schools, in Against others</div>}
          </div>
          <div className="flex flex-col gap-0.5 text-[11.5px]">
            <Lbl>Change in the roll, same schools</Lbl>
            {(["1", "3", "5"] as const).map((k) => (
              <div key={k} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--muted2)]">Since {periodLabel(o.now.change[k].from)}</span>
                <span>
                  <b className={dirClass(o.now.change[k].sameSchools, 0.5)}>{o.now.change[k].sameSchools === null ? "—" : `${arrowOf(o.now.change[k].sameSchools!, 0.5)} ${Math.abs(o.now.change[k].sameSchools!).toFixed(1)}%`}</b>
                  <span className="text-[var(--muted2)]"> · {o.now.change[k].of} schools with both years</span>
                </span>
              </div>
            ))}
          </div>
          {nm.places.length > 0 && (
            <div className="flex flex-col gap-0.5 text-[11.5px]" data-nm-places="">
              <Lbl>Among its peers</Lbl>
              {nm.places.map((p) => <div key={p.key} className="font-semibold text-[var(--group-strong)]">{p.text}</div>)}
            </div>
          )}
          {nm.notes.nurseryFsm && <div className="text-[11px] text-[var(--muted2)]" data-nm-nursery-fsm="">{nm.notes.nurseryFsm}</div>}
        </>
      )}
    </div>
  );
}

function NmTable({ rows, first, compact = false }: { rows: NmRow[]; first: string; compact?: boolean }) {
  return (
    <div className="min-h-0 overflow-auto rounded-[10px] border border-[var(--panel-border)]">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 bg-[var(--panel-bg)]">
          <tr className="border-b border-[var(--panel-border)] text-left">
            <Th>{first}</Th>
            {!compact && <Th>Schools</Th>}
            {!compact && <Th>Pupils</Th>}
            <Th>Roll, 1 year</Th>
            <Th>FSM</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} data-nm-row={r.key} className="border-b border-[var(--panel-border)] last:border-0" style={r.ours ? { background: "var(--adm-tint)" } : undefined}>
              <Td className={r.ours ? "font-bold text-[var(--adm-accent-text)]" : ""}>{r.label}</Td>
              {!compact && <Td>{n(r.schools)}</Td>}
              {!compact && <Td>{n(r.pupils)}</Td>}
              {r.tooFew ? (
                <td colSpan={2} title={POOL_MIN_NOTE} className="px-2 py-[7px] text-[12.5px] text-[var(--muted2)]">
                  <i>{tooFewWords(r.schools ?? 0)}</i>
                </td>
              ) : (
                <>
                  <Td className={`whitespace-nowrap ${dirClass(r.change1, 0.5, 1)}`}>{change(r.change1)}</Td>
                  <Td className="font-semibold">{pct(r.fsm)}</Td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Against others: its peer set, the same kinds in its regions and its kinds' state-funded pools; or a
 * set of groups side by side (its own family's only, R-NM-SETS), with the set's median. */
export function NmAgainst({ o, compact = false }: { o: GroupOverview; compact?: boolean }) {
  const nm = o.nm!;
  const t = o.sideBySide;
  if (t) {
    const rows: NmRow[] = t.rows.map((r) => ({ key: r.key, label: r.label, kind: r.ours ? "group" : "peer_named", schools: r.schools, pupils: r.pupils, change1: r.nm?.change1 ?? null, change3: null, fsm: r.nm?.fsm ?? null, fsmN: null, tooFew: false, ours: r.ours }));
    rows.push({ key: "median", label: t.median.label, kind: "median", schools: t.median.schools, pupils: t.median.pupils, change1: t.median.nm?.change1 ?? null, change3: null, fsm: t.median.nm?.fsm ?? null, fsmN: null, tooFew: false, ours: false });
    return (
      <div className="flex min-h-0 flex-col gap-2" data-nm-side-by-side="">
        <NmTable rows={rows} first="Group" compact={compact} />
        {o.picker.set?.refused ? <div className="text-[11.5px] font-semibold" data-set-refused="">{o.picker.set.refused} group{o.picker.set.refused === 1 ? "" : "s"} in this set {o.picker.set.refused === 1 ? "is" : "are"} left out: {nm.family === "nursery" ? "nursery federations are compared only with nursery federations" : "special and AP trusts are compared only with special and AP trusts"}.</div> : null}
        <div className="text-[11px] text-[var(--muted2)]">Each row is a group&rsquo;s own figures over its special, AP and nursery schools; the median is one vote per group with a figure.</div>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-col gap-2" data-nm-against="">
      <NmTable rows={nm.against} first="Set" compact={compact} />
      <div className="text-[11px] text-[var(--muted2)]">{nm.notes.stateFunded} {POOL_MIN_NOTE}</div>
    </div>
  );
}

/** NM2: the group's own mainstream schools, against mainstream schools (its LAs and regions, non-group
 * schools, single-academy trusts, England), as any mainstream group is. No results in this version. */
export function NmLine({ o, compact = false }: { o: GroupOverview; compact?: boolean }) {
  const line = o.nm?.line;
  if (!line) return <Empty>{o.group.name} has no mainstream schools.</Empty>;
  return (
    <div className="flex min-h-0 flex-col gap-2" data-nm-line="">
      <div className="text-[13px] font-bold text-[var(--fg)]">Its mainstream line: {line.schools} school{line.schools === 1 ? "" : "s"}, {n(line.pupils)} pupils</div>
      <NmTable rows={line.rows} first="Set" compact={compact} />
      <div className="text-[11px] text-[var(--muted2)]">{line.note}</div>
    </div>
  );
}

/** FSM over the years: the group, the set compared against, and England's state-funded schools of its main
 * kind (R-NM-FSM-NURSERY: a nursery federation's lines are nursery figures only). */
export function NmFsmTrend({ o, fullscreen, room }: { o: GroupOverview; fullscreen: boolean; room?: number }) {
  const nm = o.nm!;
  const lines = nm.fsmTrend.lines;
  if (!lines.length || lines[0].pts.filter((p) => p.value !== null).length < 2) return <Empty>Not enough census years to draw a trend.</Empty>;
  const foot: ReactNode = <>{nm.notes.fsm}{nm.notes.nurseryFsm ? ` ${nm.notes.nurseryFsm}` : ""}</>;
  if (o.sideBySide) {
    const named = lines.filter((l) => l.key === "group" || l.key.startsWith("peer_named:"));
    return <SetTrend lines={named} title="FSM, pupil-weighted" format={(v) => `${v.toFixed(0)}%`} fullscreen={fullscreen} room={room} footnote={foot} />;
  }
  const years = lines[0].pts.map((p) => p.year);
  const colour = (i: number) => (i === 0 ? "var(--accent)" : i === 1 ? "var(--adm-grey-1,#a1a1aa)" : "var(--adm-grey-2,#71717a)");
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">FSM, pupil-weighted</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 150, 300) : 150}
        yFormat={(v) => `${v.toFixed(0)}%`}
        xLabels={[periodLabel(years[0]), periodLabel(years[years.length - 1])]}
        series={lines.map((l, i) => ({ id: l.key, label: l.label, colour: colour(i), width: i === 0 ? 2.6 : 1.8, dashed: i > 1 ? "5 4" : undefined, points: l.pts.map((p) => ({ x: p.year, y: p.value })), title: (pt) => `${l.label} ${periodLabel(pt.x)}: ${pt.y?.toFixed(1)}%` }))}
      />
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
        {lines.map((l, i) => <SetKey key={l.key} swatch={<LineSwatch colour={colour(i)} width={14} dashed={i > 1} />} label={l.label} />)}
      </div>
      <div className="text-[10.5px] leading-snug text-[var(--muted)]">{foot}</div>
    </>
  );
}

/** R-NM-NO-RESULTS: in place of every results tile and trend. */
export function NmNoResults({ o }: { o: GroupOverview }) {
  const r = o.nm!.noResults;
  return (
    <div className="flex flex-col gap-2" data-nm-no-results="">
      <div className="text-[14px] font-bold text-[var(--fg)]">{r.title}</div>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[12px] text-[var(--muted)]">
        {r.reason.map((x) => <li key={x}>{x}</li>)}
      </ul>
      <div className="text-[11.5px] text-[var(--muted2)]">Compared instead: roll, its change for the same schools and FSM, in The group now and Against others.</div>
    </div>
  );
}
