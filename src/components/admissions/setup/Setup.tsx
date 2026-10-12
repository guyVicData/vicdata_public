"use client";

// VicData 0.7 admissions r2 (D5): setup, the lead's (Onboard1-4.dc.html) -- 1 entry points (one or
// several, a custom age; day and boarding, or day only), 2 day feeders, 3 boarding feeders, 4
// rivals -- and the two editors the dashboards open: the LA birth blend and a 16+ rung's list.
// Saving writes admissions_entry_points and admissions_lists (with la_blend) through
// /api/admissions/lists: RLS allows the Admissions lead alone (round 1), and the screen says
// "last changed by [name], [date]". Anyone else reaching it sees it read-only and why.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import SchoolSearch from "@/components/SchoolSearch";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { CUSTOM_AGE_MAX, CUSTOM_AGE_MIN, entryPoint } from "@/lib/admissions/entry-points";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchSavedSets } from "@/lib/teacher-view-saved-sets";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import type { Theme } from "@/components/teacher/TeacherChrome";
import { getJson, sendJson, query, DEFAULT_FILTERS, type CandidateRow, type CandidatesAnswer, type ListRow, type ListsAnswer, type PipelineView } from "../api";
import type { AdmissionsMember } from "../member";
import { FeederFlag } from "../views/Tables";
import { cx, fmtN } from "../ui";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });

export type SetupStep = "entry" | "day" | "boarding" | "rivals" | "blend" | `rung:${number}-${number}`;

const STD = [
  { id: "4+", t: "4+ · Reception", s: "Births in your area, then nurseries" },
  { id: "11+", t: "11+ · Year 7", s: "Children in nearby primaries and preps" },
  { id: "16+", t: "16+ · Year 12", s: "Nearby secondaries, especially 11–16 schools" },
];
const chip = (id: string) => entryPoint(id)?.label.replace(/ \(.*\)$/, "") ?? id;
const ageOf = (id: string) => entryPoint(id)?.age ?? 11;

function lastChanged(row: { updated_by: string | null; updated_at: string | null } | undefined, names: Record<string, string> | undefined): string | null {
  if (!row?.updated_at) return null;
  const who = row.updated_by ? (names?.[row.updated_by] ?? "a colleague") : "VicData";
  return `Last changed by ${who}, ${new Date(row.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

// ------------------------------------------------------------------------ the board's frame
function Frame({ step, of = 4, entry, back, onSkip, title, intro, children, cta, ctaNote, readOnly }: { step: number | null; of?: number; entry: string | null; back: (() => void) | null; onSkip: () => void; title: string; intro: ReactNode; children: ReactNode; cta: ReactNode; ctaNote?: ReactNode; readOnly: string | null }) {
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-[18px]">
        {back ? (
          <button type="button" onClick={back} className="text-[13px] text-[var(--muted)] hover:text-[var(--fg)]">
            &larr; Back
          </button>
        ) : (
          <span className="text-[15px] font-bold">VicData</span>
        )}
        <button type="button" onClick={onSkip} className="text-[13px] text-[var(--muted)] hover:text-[var(--fg)]">
          {step === null ? "Close" : "Skip for now"}
        </button>
      </div>
      <div className="flex min-h-0 grow flex-col gap-3 px-5 pb-5 pt-[18px]">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--adm-accent-text)]">
            Admissions setup{step !== null ? ` · Step ${step} of ${of}` : ""}
            {entry && step !== 1 ? ` · ${chip(entry)}` : ""}
          </div>
          <h1 className="mt-[6px] text-[20px] font-bold leading-[1.25]">{title}</h1>
          <div className="mt-[6px] text-[13px] leading-[1.45] text-[var(--muted2)]">{intro}</div>
        </div>
        {readOnly && <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-2 text-[12px] text-[var(--chip-fg)]">{readOnly}</div>}
        {children}
        <div className="mt-auto flex flex-col gap-2">
          {ctaNote && <div className="text-center text-[11px] text-[var(--muted)]">{ctaNote}</div>}
          {cta}
        </div>
      </div>
    </div>
  );
}

const Cta = ({ children, onClick, disabled, busy }: { children: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled || busy} className="block w-full rounded-[12px] bg-[var(--accent)] p-[13px] text-center text-[14px] font-extrabold text-[var(--adm-on-accent)] disabled:opacity-50">
    {busy ? "Saving…" : children}
  </button>
);
const Pill = ({ on, onClick, children, title }: { on: boolean; onClick?: () => void; children: ReactNode; title?: string }) => (
  <button type="button" onClick={onClick} title={title} aria-pressed={on} className={cx("rounded-full border px-[11px] py-[5px] text-[12px] font-semibold", on ? "border-[var(--accent)] bg-[var(--adm-tint)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]")}>
    {children}
  </button>
);
const Box = ({ on }: { on: boolean }) => <span className={cx("flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[11px] font-extrabold text-[var(--adm-on-accent)]", on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--edge-strong)]")}>{on ? "✓" : ""}</span>;
const Lbl = ({ children }: { children: ReactNode }) => <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">{children}</span>;
const S = ({ children, className = "" }: { children: ReactNode; className?: string }) => <span className={cx("text-[11px] text-[var(--muted)]", className)}>{children}</span>;

// ------------------------------------------------------------------------ the root
export function Setup({ member, step, entry, lists, ages, theme, onStep, onDone, onSkip }: { member: AdmissionsMember; step: SetupStep; entry: string | null; lists: ListsAnswer | null; ages: { low: number | null; high: number | null } | null; theme: Theme; onStep: (s: SetupStep) => void; onDone: (firstEntry?: string) => void; onSkip: () => void }) {
  void theme;
  const readOnly = member.canEditLists
    ? null
    : member.access === "schoolAdmin"
      ? "As School-Admin you can see setup, but saving needs the Admissions lead flag: round 1's rules let only the lead change lists. Make a lead in People (or yourself, with the Admissions role)."
      : "Only the Admissions lead changes setup. You can see what is set.";
  const [chosen, setChosen] = useState<string[]>(() => lists?.entryPoints.map((e) => e.entry_point) ?? []);
  const [current, setCurrent] = useState<string | null>(entry);
  const [dayOnly, setDayOnly] = useState<boolean>(() => !(lists?.lists ?? []).some((l) => l.kind === "boarding_feeders" && (l.members?.length ?? 0) > 0));
  const ep = current ?? chosen[0] ?? entry ?? "11+";
  const listOf = (kind: ListRow["kind"], rung = "") => lists?.lists.find((l) => l.entry_point === entryPoint(ep)?.id && l.kind === kind && (l.rung ?? "") === rung);
  const nextEntry = () => {
    const i = chosen.indexOf(ep);
    return i >= 0 && i < chosen.length - 1 ? chosen[i + 1] : null;
  };
  const finish = () => {
    const n = nextEntry();
    if (n) {
      setCurrent(n);
      onStep("day");
    } else onDone(chosen[0]);
  };
  if (step === "entry") return <StepEntry member={member} readOnly={readOnly} ages={ages} chosen={chosen} setChosen={setChosen} dayOnly={dayOnly} setDayOnly={setDayOnly} lists={lists} onSkip={onSkip} onNext={(first) => { setCurrent(first); onStep("day"); }} />;
  if (step === "day") return <StepFeeders kind="day" ep={ep} readOnly={readOnly} list={listOf("day_feeders")} names={lists?.names} onBack={() => onStep("entry")} onSkip={onSkip} onNext={() => onStep(dayOnly ? "rivals" : "boarding")} member={member} />;
  if (step === "boarding") return <StepFeeders kind="boarding" ep={ep} readOnly={readOnly} list={listOf("boarding_feeders")} names={lists?.names} onBack={() => onStep("day")} onSkip={onSkip} onNext={() => onStep("rivals")} member={member} />;
  if (step === "rivals") return <StepRivals ep={ep} readOnly={readOnly} list={listOf("rivals")} names={lists?.names} onBack={() => onStep(dayOnly ? "day" : "boarding")} onSkip={onSkip} onFinish={finish} nextEntry={nextEntry()} member={member} />;
  if (step === "blend") return <BlendEditor ep={ep} readOnly={readOnly} list={listOf("day_feeders")} lists={lists} member={member} onClose={() => onDone()} />;
  const m = /^rung:(\d+)-(\d+)$/.exec(step);
  if (m) return <RungEditor ep={ep} from={Number(m[1])} to={Number(m[2])} readOnly={readOnly} lists={lists} member={member} onClose={() => onDone()} />;
  return null;
}

// ------------------------------------------------------------------------ 1 · entry points
function StepEntry({ member, readOnly, ages, chosen, setChosen, dayOnly, setDayOnly, lists, onSkip, onNext }: { member: AdmissionsMember; readOnly: string | null; ages: { low: number | null; high: number | null } | null; chosen: string[]; setChosen: (c: string[]) => void; dayOnly: boolean; setDayOnly: (d: boolean) => void; lists: ListsAnswer | null; onSkip: () => void; onNext: (first: string) => void }) {
  const [custom, setCustom] = useState<string>(() => chosen.find((c) => c.startsWith("age:")) ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (chosen.length || !ages) return;
    const d: string[] = [];
    if (ages.low !== null && ages.high !== null) {
      if (ages.low <= 4 && ages.high >= 4) d.push("4+");
      if (ages.low <= 11 && ages.high >= 12) d.push("11+");
      if (ages.low <= 16 && ages.high >= 17) d.push("16+");
    }
    setChosen(d.length ? d : ["11+"]);
  }, [ages]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id].sort((a, b) => ageOf(a) - ageOf(b)));
  const all = custom ? Array.from(new Set([...chosen.filter((c) => !c.startsWith("age:")), custom])).sort((a, b) => ageOf(a) - ageOf(b)) : chosen.filter((c) => !c.startsWith("age:"));
  const save = async () => {
    setErr(null);
    if (readOnly) return onNext(all[0] ?? "11+");
    setBusy(true);
    const r = await sendJson(`/api/admissions/lists?urn=${member.schoolUrn}`, "PUT", { entryPoints: all });
    setBusy(false);
    if (!r.ok) return setErr((r.body?.error as string) ?? "Couldn't save.");
    onNext(all[0]);
  };
  const changed = lastChanged(lists?.entryPoints[0], lists?.names);
  return (
    <Frame step={1} entry={null} back={null} onSkip={onSkip} readOnly={readOnly} title="Which entry points do you recruit for?" intro="Pick one or several. Each gets its own pipeline, feeders and rivals, and you switch between them at the top of the page." cta={<Cta onClick={save} busy={busy} disabled={!all.length}>{`Next: day feeders for ${chip(all[0] ?? "11+")}`}</Cta>} ctaNote={err ?? "You can change all of this later"}>
      {changed && <S>{changed}</S>}
      <div className="flex flex-col gap-2">
        {STD.map((o) => (
          <button key={o.id} type="button" disabled={!!readOnly} onClick={() => toggle(o.id)} className={cx("flex items-center gap-3 rounded-[12px] border px-[14px] py-3 text-left", chosen.includes(o.id) ? "border-[var(--accent)] bg-[var(--adm-tint)]" : "border-[var(--panel-border2)]")}>
            <Box on={chosen.includes(o.id)} />
            <span>
              <span className="block text-[14px] font-bold">{o.t}</span>
              <S>{o.s}</S>
            </span>
          </button>
        ))}
        <div className={cx("flex items-center gap-3 rounded-[12px] border px-[14px] py-3", custom ? "border-[var(--accent)] bg-[var(--adm-tint)]" : "border-[var(--panel-border2)]")}>
          <Box on={!!custom} />
          <span className="grow">
            <span className="block text-[14px] font-bold">Another age</span>
            <S>e.g. 7+, 8+, 13+</S>
          </span>
          <select disabled={!!readOnly} value={custom} onChange={(e) => setCustom(e.target.value)} className="rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-[10px] py-[5px] text-[12px] text-[var(--muted2)]" aria-label="Another entry age">
            <option value="">Age ▾</option>
            {Array.from({ length: CUSTOM_AGE_MAX - CUSTOM_AGE_MIN + 1 }, (_, i) => CUSTOM_AGE_MIN + i)
              .filter((a) => ![4, 11, 16].includes(a))
              .map((a) => (
                <option key={a} value={`age:${a}`}>
                  {a}+
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Lbl>Who do you take?</Lbl>
        <div className="flex gap-2">
          {[false, true].map((d) => (
            <button key={String(d)} type="button" disabled={!!readOnly} onClick={() => setDayOnly(d)} className={cx("flex-1 rounded-[10px] p-[10px] text-center text-[13px]", dayOnly === d ? "border-[1.5px] border-[var(--fg)] bg-[var(--box-bg)] font-bold" : "border border-[var(--panel-border2)] text-[var(--muted2)]")}>
              {d ? "Day only" : "Day and boarding"}
            </button>
          ))}
        </div>
        <S className="leading-[1.4]">Day and boarding get separate feeder lists in the next steps.</S>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------------ the school list
function SchoolRows({ rows, ticked, onTick, age, kind, readOnly }: { rows: CandidateRow[]; ticked: Set<string>; onTick: (u: string) => void; age: number; kind: "day" | "boarding" | "rivals"; readOnly: boolean }) {
  const third = kind === "boarding" ? "Boards" : "km";
  return (
    <div className="min-h-0 grow overflow-y-auto">
      <div className="grid grid-cols-[20px_minmax(0,1fr)_44px_38px] items-center gap-2 border-b border-[var(--border)] px-1 py-2 text-[10.5px] text-[var(--muted3)]">
        <span />
        <span>{kind === "boarding" ? "Prep" : "School"}</span>
        <span>Aged {age}</span>
        <span>{third}</span>
      </div>
      {rows.map((r) => (
        <button key={r.urn} type="button" disabled={readOnly} onClick={() => onTick(r.urn)} className="grid w-full grid-cols-[20px_minmax(0,1fr)_44px_38px] items-center gap-2 border-b border-[var(--border)] px-1 py-2 text-left text-[12.5px]">
          <Box on={ticked.has(r.urn)} />
          <span className="min-w-0">
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="truncate">{r.name}</span>
              {kind !== "rivals" && <span className="shrink-0"><FeederFlag flag={r.flag} compact /></span>}
            </span>
            <S className="block truncate">
              {kind === "boarding" ? r.laName ?? "" : r.sector === "state" ? "State" : "Independent"} &middot; {r.gender} &middot; {r.size ?? "—"}
            </S>
          </span>
          <span className="tabular-nums" title={r.before !== null ? `${fmtN(r.before)} two years ago` : undefined}>
            {fmtN(r.pupils)}
          </span>
          <span className="tabular-nums">{kind === "boarding" ? (r.boarding ? "Yes" : "No") : r.distanceKm === null ? "—" : r.distanceKm.toFixed(1)}</span>
        </button>
      ))}
    </div>
  );
}

function MiniMap({ answer, ticked }: { answer: CandidatesAnswer | null; ticked: Set<string> }) {
  const members: ConsortiumMapMember[] = useMemo(() => {
    if (!answer?.school) return [];
    const me = answer.school;
    const rows = answer.rows.filter((r) => r.easting !== null && r.northing !== null).map((r) => ({ urn: r.urn, name: r.name, easting: r.easting!, northing: r.northing!, roll: r.pupils }));
    return me.easting !== null && me.northing !== null ? [...rows, { urn: me.urn, name: me.name, easting: me.easting, northing: me.northing, roll: null }] : rows;
  }, [answer]);
  if (!members.length) return null;
  return (
    <div className="relative">
      <ConsortiumMap key={`${members.length}:${ticked.size}`} members={members} targetUrn={answer?.school?.urn} heightClass="h-[120px] w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]" fitPadding={8} colourOf={(m) => (m.urn === answer?.school?.urn ? "#22d3ee" : ticked.has(m.urn) ? "#22d3ee" : "#52525b")} onSelect={() => undefined} />
      <span className="pointer-events-none absolute bottom-[6px] right-2 z-[500] text-[10.5px] text-[var(--muted)]">Dot size = pupils aged {answer?.age}</span>
    </div>
  );
}

function useCandidates(member: AdmissionsMember, ep: string, kind: "day" | "boarding" | "rivals", params: Record<string, string>) {
  const url = `/api/admissions/candidates?${query(member.schoolUrn, entryPoint(ep)!.id, DEFAULT_FILTERS, { kind, ...params })}`;
  const [a, setA] = useState<{ url: string; answer: CandidatesAnswer | null; error: string | null }>({ url: "", answer: null, error: null });
  useEffect(() => {
    let live = true;
    getJson<CandidatesAnswer>(url).then((r) => live && setA({ url, answer: r.status === "ready" ? r.data : null, error: r.status === "error" ? r.message : null }));
    return () => {
      live = false;
    };
  }, [url]);
  return a.url === url ? a : { url, answer: null, error: null };
}

async function saveList(member: AdmissionsMember, ep: string, kind: ListRow["kind"], members: string[], extra: Record<string, unknown> = {}): Promise<string | null> {
  const r = await sendJson(`/api/admissions/lists?urn=${member.schoolUrn}`, "PUT", { list: { entry_point: entryPoint(ep)!.id, kind, members, confirmed: true, ...extra } });
  return r.ok ? null : ((r.body?.error as string) ?? "Couldn't save.");
}

// ------------------------------------------------------------------------ 2 · day, 3 · boarding
function StepFeeders({ kind, ep, readOnly, list, names, onBack, onSkip, onNext, member }: { kind: "day" | "boarding"; ep: string; readOnly: string | null; list: ListRow | undefined; names?: Record<string, string>; onBack: () => void; onSkip: () => void; onNext: () => void; member: AdmissionsMember }) {
  const age = Math.max(4, ageOf(ep) - 1);
  const [mode, setMode] = useState<"nearest" | "radius" | "la">("nearest");
  const [km, setKm] = useState(5);
  const [sector, setSector] = useState<"all" | "state" | "independent">("all");
  const [gender, setGender] = useState(false);
  const [extra, setExtra] = useState<string[]>([]);
  const [las, setLas] = useState<string[]>(() => ((list?.fuzzy as { las?: string[] } | null)?.las ?? []));
  const [tops, setTops] = useState<boolean>(() => !!(list?.fuzzy as { tops?: number[] } | null)?.tops);
  const [fuzzy, setFuzzy] = useState<boolean>(() => !!list?.fuzzy);
  const [ticked, setTicked] = useState<Set<string> | null>(list?.members?.length ? new Set(list.members) : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const params: Record<string, string> =
    kind === "boarding"
      ? { mode: las.length ? "la" : "nearest", n: "40", ...(las.length ? { las: las.join(",") } : {}), ...(tops ? { ages: "11,13" } : {}) }
      : { mode, ...(mode === "nearest" ? { n: "15" } : mode === "radius" ? { km: String(km) } : { las: las.join(",") }), ...(sector !== "all" ? { sector } : {}), ...(gender ? { gender: "same" } : {}) };
  const c = useCandidates(member, ep, kind, params);
  // Every school that is (or would be) ticked is listed: the saved list, names added, and the
  // round 1 defaults, even beyond the nearest shown.
  const [defaults, setDefaults] = useState<string[]>([]);
  const named = useCandidates(member, ep, kind, { mode: "urns", urns: Array.from(new Set([...extra, ...(list?.members ?? []), ...defaults])).join(",") });
  const rows = useMemo(() => {
    const base = c.answer?.rows ?? [];
    const more = (named.answer?.rows ?? []).filter((r) => !base.some((b) => b.urn === r.urn));
    return [...base, ...more];
  }, [c.answer, named.answer]);
  // Default ticks: the saved list, else the round 1 defaults (the pipeline's own feeder set).
  useEffect(() => {
    if (kind !== "day" || list?.members?.length) return;
    getJson<PipelineView>(`/api/admissions/pipeline?${query(member.schoolUrn, entryPoint(ep)!.id, DEFAULT_FILTERS)}`).then((r) => {
      if (r.status === "ready" && !("empty" in r.data)) setDefaults(r.data.feederTable.rows.map((x) => x.urn));
    });
  }, [ep, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const tick = ticked ?? new Set(kind === "day" ? defaults : fuzzy ? rows.map((r) => r.urn) : []);
  const onTick = (u: string) => {
    const n = new Set(tick);
    if (n.has(u)) n.delete(u);
    else n.add(u);
    setTicked(n);
  };
  const tickedRows = rows.filter((r) => tick.has(r.urn));
  const pupils = tickedRows.reduce((a, r) => a + (r.pupils ?? 0), 0);
  // The LAs on offer: those of the schools found near the school (a lead adds an area from them).
  const nearLas = useCandidates(member, ep, kind, { mode: "nearest", n: "60" });
  const laOptions = Array.from(new Map((nearLas.answer?.rows ?? []).filter((r) => r.laCode).map((r) => [r.laCode!, r.laName ?? r.laCode!])).entries());
  const save = async () => {
    setErr(null);
    if (readOnly) return onNext();
    setBusy(true);
    // The row is replaced whole: keep its LA blend (saved on the day list by the blend editor).
    const keep = { la_blend: list?.la_blend ?? null };
    const e = await saveList(member, ep, kind === "day" ? "day_feeders" : "boarding_feeders", kind === "boarding" && fuzzy ? rows.map((r) => r.urn) : [...tick], kind === "boarding" && fuzzy ? { ...keep, fuzzy: { sector: "independent", boarding: true, ...(tops ? { tops: [11, 13] } : {}), las } } : { ...keep, fuzzy: list?.fuzzy ?? null });
    setBusy(false);
    if (e) return setErr(e);
    onNext();
  };
  const changed = lastChanged(list, names);
  const isDay = kind === "day";
  return (
    <Frame
      step={isDay ? 2 : 3}
      entry={ep}
      back={onBack}
      onSkip={onSkip}
      readOnly={readOnly}
      title={isDay ? "Your day feeders" : "Your boarding feeders"}
      intro={isDay ? `We’ve listed the nearest schools with ${age}-year-olds. Tick the ones your day pupils come from; widen the net to see more.` : "Boarders come from further away. Build this list from preps by area and type rather than distance alone."}
      cta={<Cta onClick={save} busy={busy}>{isDay ? "Save day feeders · Next: boarding" : "Save boarding feeders · Next: rivals"}</Cta>}
      ctaNote={err ?? (isDay ? `${tickedRows.length} ticked · ${fmtN(pupils)} pupils aged ${age} · ${ADMISSIONS_NOTES.feederFlags.charAt(0).toLowerCase()}${ADMISSIONS_NOTES.feederFlags.slice(1, -1)}` : undefined)}
    >
      {changed && <S>{changed}</S>}
      {isDay ? (
        <>
          <div className="flex flex-wrap gap-[6px]">
            <Pill on={mode === "nearest"} onClick={() => setMode("nearest")}>Nearest 15</Pill>
            <Pill on={mode === "radius"} onClick={() => setMode("radius")}>
              Within{" "}
              <input type="number" min={1} max={80} value={km} onClick={(e) => e.stopPropagation()} onChange={(e) => { setKm(Number(e.target.value) || 5); setMode("radius"); }} className="w-9 bg-transparent text-center" aria-label="Kilometres" />
              km
            </Pill>
            <LaPicker las={las} setLas={(l) => { setLas(l); setMode("la"); }} options={laOptions} on={mode === "la"} label="By LA" />
          </div>
          <div className="flex flex-wrap gap-[6px]">
            <Pill on={sector === "all"} onClick={() => setSector(sector === "all" ? "state" : sector === "state" ? "independent" : "all")} title="State + independent / State / Independent">
              {sector === "all" ? "State + independent" : sector === "state" ? "State only" : "Independent only"}
            </Pill>
            <Pill on={gender} onClick={() => setGender(!gender)} title="Only schools with your gender intake">
              {gender ? "Same gender intake" : "Girls / boys / mixed"}
            </Pill>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-[6px]">
          <Lbl>Find preps</Lbl>
          <div className="flex flex-wrap gap-[6px]">
            <Pill on>Independent preps</Pill>
            <Pill on>With boarders</Pill>
            <Pill on={tops} onClick={() => setTops(!tops)}>Ages to 11 or 13</Pill>
          </div>
          <div className="flex flex-wrap gap-[6px]">
            {las.map((l) => (
              <Pill key={l} on onClick={() => setLas(las.filter((x) => x !== l))}>
                {laOptions.find((o) => o[0] === l)?.[1] ?? l} &times;
              </Pill>
            ))}
            <LaPicker las={las} setLas={setLas} options={laOptions} on={false} label="+ Area" />
          </div>
          <S>{rows.length} preps match. Tick the ones that send you boarders, or keep them all as a fuzzy set that updates itself.</S>
        </div>
      )}
      {!isDay && (
        <div className="flex gap-2">
          {[false, true].map((f) => (
            <button key={String(f)} type="button" onClick={() => setFuzzy(f)} className={cx("flex-1 rounded-[10px] p-[9px] text-center text-[12.5px]", fuzzy === f ? "border-[1.5px] border-[var(--fg)] bg-[var(--box-bg)] font-bold" : "border border-[var(--panel-border2)] text-[var(--muted2)]")}>
              {f ? "Keep as fuzzy set" : "Pick schools"}
            </button>
          ))}
        </div>
      )}
      {isDay && <MiniMap answer={c.answer} ticked={tick} />}
      {c.error ? <S>{c.error}</S> : !c.answer ? <S>Finding schools…</S> : <SchoolRows rows={rows} ticked={tick} onTick={onTick} age={age} kind={kind} readOnly={!!readOnly || (!isDay && fuzzy)} />}
      {isDay && !readOnly && (
        <div className="flex flex-col gap-1">
          <Lbl>+ Add by name</Lbl>
          <SchoolSearch allowRequest={false} placeholder="A school by name, town or postcode" onSelect={(s) => { setExtra([...extra, s.urn]); setTicked(new Set([...tick, s.urn])); }} />
        </div>
      )}
      {!isDay && <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-[10px] text-[12px] leading-[1.4] text-[var(--chip-fg)]">{ADMISSIONS_NOTES.boardingCensus}</div>}
    </Frame>
  );
}

function LaPicker({ las, setLas, options, on, label }: { las: string[]; setLas: (l: string[]) => void; options: [string, string][]; on: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <Pill on={on} onClick={() => setOpen(!open)}>
        {label}
      </Pill>
      {open && (
        <span className="absolute left-0 top-8 z-40 flex max-h-56 w-56 flex-col overflow-y-auto rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-1 shadow-lg">
          {options.length === 0 && <span className="px-2 py-1 text-[12px] text-[var(--muted)]">No nearby LAs found</span>}
          {options.map(([code, name]) => (
            <button key={code} type="button" onClick={() => { setLas(las.includes(code) ? las.filter((x) => x !== code) : [...las, code]); setOpen(false); }} className="rounded-[7px] px-2 py-1 text-left text-[12px] hover:bg-[var(--box-bg)]">
              {las.includes(code) ? "✓ " : ""}
              {name}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------------ 4 · rivals
function StepRivals({ ep, readOnly, list, names, onBack, onSkip, onFinish, nextEntry, member }: { ep: string; readOnly: string | null; list: ListRow | undefined; names?: Record<string, string>; onBack: () => void; onSkip: () => void; onFinish: () => void; nextEntry: string | null; member: AdmissionsMember }) {
  const age = ageOf(ep);
  const [source, setSource] = useState<"nearest" | "region" | "saved" | "custom">(list?.members?.length ? "custom" : "nearest");
  const [n, setN] = useState<10 | 15>(10);
  const [sector, setSector] = useState<"all" | "state" | "independent">("all");
  const [boarding, setBoarding] = useState(false);
  const [gender, setGender] = useState(false);
  const [sizes, setSizes] = useState(false);
  const [custom, setCustom] = useState<string[]>(list?.members ?? []);
  const [savedSets, setSavedSets] = useState<{ id: string; name: string; members: string[] }[]>([]);
  const [setId, setSetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetchSavedSets(createBrowserSupabaseClient(), member.schoolUrn, age >= 16 ? "ks5" : "ks4").then((p) => setSavedSets((p?.sets ?? []).map((s) => ({ id: s.id, name: s.name, members: s.members.map((m) => m.urn) }))));
  }, [member.schoolUrn, age]);
  const narrowing = { ...(sector !== "all" ? { sector } : {}), ...(boarding ? { boarding: "1" } : {}), ...(gender ? { gender: "same" } : {}), ...(sizes ? { sizes: "S,M,L" } : {}) };
  const params: Record<string, string> =
    source === "nearest" ? { mode: "nearest", n: String(n), ...narrowing } : source === "region" ? { mode: "region", ...narrowing } : { mode: "urns", urns: (source === "saved" ? (savedSets.find((s) => s.id === setId)?.members ?? []) : custom).join(","), ...narrowing };
  const c = useCandidates(member, ep, "rivals", params);
  const save = async () => {
    setErr(null);
    if (readOnly) return onFinish();
    setBusy(true);
    const e = await saveList(member, ep, "rivals", (c.answer?.rows ?? []).map((r) => r.urn).slice(0, 500), { fuzzy: { source, ...narrowing, ...(source === "nearest" ? { n } : {}), ...(source === "saved" ? { savedSetId: setId } : {}) } });
    setBusy(false);
    if (e) return setErr(e);
    onFinish();
  };
  const opt = (id: typeof source, t: string, s: string, after?: ReactNode) => (
    <div className={cx("flex items-center gap-3 rounded-[12px] border px-[14px] py-3", source === id ? "border-[var(--accent)] bg-[var(--adm-tint)]" : "border-[var(--panel-border2)]")}>
      <button type="button" onClick={() => setSource(id)} disabled={!!readOnly} className="flex grow items-center gap-3 text-left">
        <span className={cx("h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px]", source === id ? "border-[5px] border-[var(--accent)]" : "border-[var(--edge-strong)]")} />
        <span>
          <span className="block text-[14px] font-bold">{t}</span>
          <S>{s}</S>
        </span>
      </button>
      {after}
    </div>
  );
  const stage = age <= 10 ? "KS2" : age <= 15 ? "GCSE" : "Post-16";
  return (
    <Frame step={4} entry={ep} back={onBack} onSkip={onSkip} readOnly={readOnly} title="Who are you competing with?" intro={`Rivals drive Market share: your share of their ${age}-year-olds, how their rolls are moving, and how their results compare.`} cta={<Cta onClick={save} busy={busy}>{`Finish · open ${chip(ep)} pipeline`}</Cta>} ctaNote={err ?? (nextEntry ? `${chip(nextEntry)} is next: it starts its own feeder steps` : `${c.answer?.rows.length ?? "…"} rivals`)}>
      {lastChanged(list, names) && <S>{lastChanged(list, names)}</S>}
      <div className="flex flex-col gap-2">
        {opt("nearest", `${n} nearest with a Year ${age - 4}`, "Same as your Teacher comparisons, at this age", <Pill on onClick={() => setN(n === 10 ? 15 : 10)}>10 / 15</Pill>)}
        {opt("region", "Regional", `Every school taking ${age}-year-olds in your region`)}
        {opt(
          "saved",
          "My saved set",
          savedSets.length ? "From the comparison-set chooser" : "No saved sets yet (the comparison-set chooser)",
          source === "saved" && savedSets.length ? (
            <select value={setId ?? ""} onChange={(e) => setSetId(e.target.value)} className="rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 py-1 text-[12px]">
              <option value="">Choose…</option>
              {savedSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : undefined,
        )}
        {opt("custom", "Build a custom set", "Add schools by name")}
      </div>
      {source === "custom" && !readOnly && <SchoolSearch allowRequest={false} placeholder="Add a rival by name" onSelect={(s) => setCustom(Array.from(new Set([...custom, s.urn])))} />}
      <div className="flex flex-col gap-[6px]">
        <Lbl>Narrow to</Lbl>
        <div className="flex flex-wrap gap-[6px]">
          <Pill on={sector === "all"} onClick={() => setSector(sector === "all" ? "state" : sector === "state" ? "independent" : "all")}>
            {sector === "all" ? "State + independent" : sector === "state" ? "State only" : "Independent only"}
          </Pill>
          <Pill on={boarding} onClick={() => setBoarding(!boarding)}>Boarding only</Pill>
          <Pill on={gender} onClick={() => setGender(!gender)}>Same gender intake</Pill>
          <Pill on={sizes} onClick={() => setSizes(!sizes)}>Size: S&ndash;L</Pill>
        </div>
      </div>
      <div className="max-h-44 overflow-y-auto text-[12px] text-[var(--chip-fg)]">
        {(c.answer?.rows ?? []).map((r) => (
          <div key={r.urn} className="flex justify-between border-b border-[var(--border)] py-1">
            <span className="truncate">{r.name}</span>
            <span className="text-[var(--muted)]">{fmtN(r.pupils)} aged {age}</span>
          </div>
        ))}
      </div>
      <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-[10px] text-[12px] leading-[1.4] text-[var(--chip-fg)]">Academic comparison of rivals uses {stage} for {chip(ep)}. Schools sitting mostly IGCSEs, and schools with no published results, are listed but not ranked.</div>
    </Frame>
  );
}

// ------------------------------------------------------------------------ the LA birth blend
function BlendEditor({ ep, readOnly, list, lists, member, onClose }: { ep: string; readOnly: string | null; list: ListRow | undefined; lists: ListsAnswer | null; member: AdmissionsMember; onClose: () => void }) {
  const [p, setP] = useState<PipelineView | null>(null);
  useEffect(() => {
    getJson<PipelineView>(`/api/admissions/pipeline?${query(member.schoolUrn, entryPoint(ep)!.id, DEFAULT_FILTERS)}`).then((r) => r.status === "ready" && setP(r.data));
  }, [ep, member.schoolUrn]);
  const blend = p && !("empty" in p) ? p.blend : [];
  const [w, setW] = useState<Record<string, number> | null>(null);
  const weights = w ?? Object.fromEntries(blend.map((b) => [b.laCode, Math.round(b.weight * 100)]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (reset = false) => {
    if (readOnly) return onClose();
    setBusy(true);
    const e = await saveList(member, ep, "day_feeders", list?.members ?? [], { la_blend: reset ? null : weights, fuzzy: list?.fuzzy ?? null });
    setBusy(false);
    if (e) return setErr(e);
    onClose();
  };
  void lists;
  return (
    <Frame step={null} entry={ep} back={onClose} onSkip={onClose} readOnly={readOnly} title="Births: the LA blend" intro="Births are counted by local authority only. The pool's births are a blend of the LAs your feeders are in, weighted by their pupils; adjust the weights if your families come from elsewhere. Weights are rescaled to 100%." cta={<Cta onClick={() => save()} busy={busy}>Save the blend</Cta>} ctaNote={err ?? (p && !("empty" in p) ? (p.blendSource === "override" ? "This is the lead's blend." : "This is the automatic blend.") : undefined)}>
      {blend.map((b) => (
        <label key={b.laCode} className="flex items-center gap-3 text-[13px]">
          <span className="grow">{b.laName ?? b.laCode}</span>
          <input type="range" min={0} max={100} disabled={!!readOnly} value={weights[b.laCode] ?? 0} onChange={(e) => setW({ ...weights, [b.laCode]: Number(e.target.value) })} />
          <span className="w-10 text-right tabular-nums">{weights[b.laCode] ?? 0}</span>
        </label>
      ))}
      {!readOnly && (
        <button type="button" onClick={() => save(true)} className="self-start text-[12px] font-bold text-[var(--adm-accent-text)]">
          Back to the automatic blend
        </button>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------------ a 16+ rung's list
function RungEditor({ ep, from, to, readOnly, lists, member, onClose }: { ep: string; from: number; to: number; readOnly: string | null; lists: ListsAnswer | null; member: AdmissionsMember; onClose: () => void }) {
  const saved = lists?.lists.find((l) => l.entry_point === entryPoint(ep)?.id && l.kind === "rung" && l.rung === `age:${to}`);
  const [ticked, setTicked] = useState<Set<string> | null>(saved?.members?.length ? new Set(saved.members) : null);
  const [extra, setExtra] = useState<string[]>([]);
  const c = useCandidates(member, ep, "day", { mode: "nearest", n: "30", age: String(to) });
  const named = useCandidates(member, ep, "day", { mode: "urns", urns: [...extra, ...(saved?.members ?? [])].join(","), age: String(to) });
  const [p, setP] = useState<PipelineView | null>(null);
  useEffect(() => {
    getJson<PipelineView>(`/api/admissions/pipeline?${query(member.schoolUrn, entryPoint(ep)!.id, DEFAULT_FILTERS)}`).then((r) => r.status === "ready" && setP(r.data));
  }, [ep, member.schoolUrn]);
  const current = p && !("empty" in p) ? (p.sets.find((s) => s.age === to)?.urns ?? []) : [];
  const tick = ticked ?? new Set(current);
  const rows = [...(c.answer?.rows ?? []), ...(named.answer?.rows ?? []).filter((r) => !(c.answer?.rows ?? []).some((x) => x.urn === r.urn))];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (readOnly) return onClose();
    setBusy(true);
    // One rung list for every age the set holds, so the cohort is followed through the same schools.
    for (let a = from; a <= to; a++) {
      const r = await sendJson(`/api/admissions/lists?urn=${member.schoolUrn}`, "PUT", { list: { entry_point: entryPoint(ep)!.id, kind: "rung", rung: `age:${a}`, members: [...tick], confirmed: true } });
      if (!r.ok) {
        setBusy(false);
        return setErr((r.body?.error as string) ?? "Couldn't save.");
      }
    }
    setBusy(false);
    onClose();
  };
  return (
    <Frame step={null} entry={ep} back={onClose} onSkip={onClose} readOnly={readOnly} title={`Rung: ages ${to} → ${from}`} intro={`The schools whose pupils aged ${to} (and younger) make this stage of the ${chip(ep)} ladder. ${to >= 11 ? "11–16 schools come first: their pupils must move at 16." : "Primaries in the same area as the secondaries above."}`} cta={<Cta onClick={save} busy={busy}>Save this rung</Cta>} ctaNote={err ?? `${tick.size} ticked`}>
      {c.answer ? <SchoolRows rows={rows} ticked={tick} onTick={(u) => { const n = new Set(tick); if (n.has(u)) n.delete(u); else n.add(u); setTicked(n); }} age={to} kind="day" readOnly={!!readOnly} /> : <S>Finding schools…</S>}
      {!readOnly && <SchoolSearch allowRequest={false} placeholder="Add a school by name" onSelect={(s) => { setExtra([...extra, s.urn]); setTicked(new Set([...tick, s.urn])); }} />}
    </Frame>
  );
}
