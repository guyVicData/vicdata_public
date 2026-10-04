"use client";

// VicData 0.6 S2/S3: the Catalogue page (catalogue doc §2.5; scope brief §6), super-admin
// only. One page, three jobs:
//   - the documentation you browse: every rule, measure, renderer and dataview card, read
//     straight from src/catalogue (the same objects the chooser and docs/catalogue use);
//   - the parity check: for a chosen school and phase, the hand-coded dashboard and the
//     config-rendered one side by side, live (both through Platform's read-only look-as);
//   - where each dataview is placed on the VicData dashboards.
//
// Night 1 renders views live through their dashboards: each registered view is drawn by
// its column host, so parity is checked panel by panel in the two frames rather than as
// isolated tiles (logged in OPEN_QUESTIONS.md; the chooser's isolated live preview is
// night 2).
import { peekHref } from "@/lib/view-as";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ATTENTION_ACCENT, ATTENTION_INK } from "@/lib/teacher-view-theme";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { DATAVIEWS, MEASURES, RENDERERS, RULES, measureById, placements, type Dataview } from "@/catalogue";
import { DASHBOARDS } from "@/catalogue/dashboards";

// The two schools night 1's parity walk names (build report): one state, one independent,
// both with GCSE and Post-16 data.
const PARITY_SCHOOLS = [
  { urn: "100053", name: "Acland Burghley School", sector: "State" },
  { urn: "117037", name: "The King's School, Worcester", sector: "Independent" },
];

type Tab = "parity" | "dataviews" | "rules" | "measures" | "renderers";

const TABS: { id: Tab; label: string }[] = [
  { id: "parity", label: "Parity" },
  { id: "dataviews", label: `Dataviews · ${DATAVIEWS.length}` },
  { id: "rules", label: `Rules · ${RULES.length}` },
  { id: "measures", label: `Measures · ${MEASURES.length}` },
  { id: "renderers", label: `Renderers · ${RENDERERS.length}` },
];

function NotFound() {
  return (
    <main className="flex flex-grow items-center justify-center py-32">
      <p className="text-[14px]">
        <span className="mr-4 border-r border-current pr-4 text-[24px] font-medium">404</span>
        This page could not be found.
      </p>
    </main>
  );
}

export function CatalogueScreen() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await createBrowserSupabaseClient().rpc("is_platform_admin");
        setAllowed(!error && data === true);
      } catch {
        setAllowed(false);
      }
    })();
  }, []);
  if (allowed === null) return <main className="flex-grow" />;
  if (!allowed) return <NotFound />;
  return <Catalogue />;
}

const label = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted3)]";
const ebtn = "rounded-lg border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-[7px] text-xs font-semibold text-[var(--fg)]";

function Catalogue() {
  const [theme] = useTeacherTheme();
  const [tab, setTab] = useState<Tab>("parity");
  return (
    <main id="teacher-root" data-theme={theme} className="flex min-h-screen flex-col gap-3.5 bg-[var(--bg)] px-6 py-5 text-[var(--fg)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full px-[9px] py-[3px] text-[10.5px] font-extrabold tracking-[0.08em]" style={{ background: ATTENTION_ACCENT.hex, color: ATTENTION_INK }}>SUPER-ADMIN</span>
        <h1 className="text-lg font-bold">Catalogue</h1>
        <span className="flex-grow" />
        <Link href="/platform" className={ebtn}>Schools</Link>
      </div>
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-[5px] text-xs font-bold ${tab === t.id ? "bg-[var(--fg)] text-[var(--bg)]" : "border border-[var(--panel-border2)] text-[var(--muted)] hover:text-[var(--fg)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "parity" && <Parity />}
      {tab === "dataviews" && <Dataviews />}
      {tab === "rules" && <Rules />}
      {tab === "measures" && <Measures />}
      {tab === "renderers" && <Renderers />}
    </main>
  );
}

function Parity() {
  const [urn, setUrn] = useState(PARITY_SCHOOLS[0].urn);
  const [phase, setPhase] = useState<"ks4" | "ks5">("ks4");
  const [scale, setScale] = useState(0.5);
  // The read-only peek (src/lib/view-as.ts readPeek), never View as: View as would force
  // the config renderer and is the whole browser's, not one frame's.
  const base = peekHref(urn, phase);
  const frames = [
    { title: "Hand-coded (today)", src: base },
    { title: "Config renderer (?renderer=config)", src: `${base}&renderer=config` },
  ];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
        <label className="flex flex-col gap-1">
          <span className={label}>School</span>
          <input
            value={urn}
            onChange={(e) => setUrn(e.target.value.trim())}
            aria-label="School URN"
            className="w-28 rounded-lg border border-[var(--panel-border2)] bg-[var(--box-bg)] px-2.5 py-1.5 text-[13px] text-[var(--fg)]"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PARITY_SCHOOLS.map((s) => (
            <button key={s.urn} type="button" onClick={() => setUrn(s.urn)} className={`${ebtn} ${urn === s.urn ? "border-[var(--fg)]" : ""}`}>
              {s.name} · {s.sector}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Phase">
          {(["ks4", "ks5"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={phase === p} onClick={() => setPhase(p)} className={`${ebtn} ${phase === p ? "border-[var(--fg)]" : ""}`}>
              {p === "ks4" ? "GCSE" : "Post-16"}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className={label}>Scale</span>
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className="rounded-lg border border-[var(--panel-border2)] bg-[var(--box-bg)] px-2 py-1.5 text-[13px] text-[var(--fg)]">
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
          </select>
        </label>
      </div>
      <p className="text-xs leading-relaxed text-[var(--muted2)]">
        Both frames are the same school through Platform&rsquo;s read-only look-as, at the 1280px board width. Switch Candidates / Results,
        the Results pill, the subject chip and each panel&rsquo;s rail in both, and compare panel by panel. Ticked subjects and open panels are
        your own preferences for that school, shared by both frames, so a change in one shows in the other on reload.
      </p>
      <div className="flex flex-wrap gap-4">
        {frames.map((f) => (
          <figure key={f.title} className="flex flex-col gap-1.5">
            <figcaption className="flex items-center gap-2 text-xs font-semibold text-[var(--muted2)]">
              {f.title}
              <a href={f.src} target="_blank" rel="noreferrer" className="underline">open</a>
            </figcaption>
            <div className="overflow-hidden rounded-lg border border-[var(--panel-border)]" style={{ width: 1280 * scale, height: 1800 * scale }}>
              <iframe
                key={f.src}
                src={f.src}
                title={f.title}
                style={{ width: 1280, height: 1800, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }}
              />
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Card({ title, sub, rows, tone }: { title: string; sub?: string; rows: [string, ReactNode][]; tone?: "draft" }) {
  return (
    <article className={`flex flex-col gap-2 rounded-xl border bg-[var(--panel-bg)] p-3.5 ${tone === "draft" ? "border-dashed border-[var(--panel-border2)]" : "border-[var(--panel-border)]"}`}>
      <div>
        <h3 className="text-[13.5px] font-bold">{title}</h3>
        {sub && <p className="text-[11.5px] text-[var(--muted2)]">{sub}</p>}
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[12px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--muted3)]">{k}</dt>
            <dd className="min-w-0 break-words text-[var(--fg)]">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

const grid = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]";
const list = (xs: readonly string[]) => (xs.length ? xs.join(", ") : "—");

function Dataviews() {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return DATAVIEWS.filter((d) => !s || `${d.id} ${d.label} ${d.titleTemplate}`.toLowerCase().includes(s));
  }, [q]);
  return (
    <section className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search dataviews"
        aria-label="Search dataviews"
        className="w-[282px] rounded-lg border border-[var(--panel-border2)] bg-[var(--box-bg)] px-2.5 py-1.5 text-[13px] text-[var(--fg)]"
      />
      <div className={grid}>
        {shown.map((d) => (
          <DataviewCard key={d.id} d={d} />
        ))}
      </div>
    </section>
  );
}

function DataviewCard({ d }: { d: Dataview }) {
  const usedOn = placements(DASHBOARDS, d.id, null).map((p) => `${p.dashboard.name} · ${p.column}`);
  const s = d.supports;
  return (
    <Card
      title={`${d.label}`}
      sub={`${d.id} · ${d.status}`}
      tone={d.status === "draft" ? "draft" : undefined}
      rows={[
        ["Measures", d.measures.map((m) => measureById(m)?.name ?? m).join(", ")],
        ["Data", `${list(s.data)}${s.results ? ` (${s.results.join(", ")})` : ""} · ${s.phases.join(", ")}`],
        ["Focus", list(s.focus)],
        ["Compares", s.compare.length ? s.compare.join(" + ") : "nothing"],
        ["Numbers", list(s.numberType)],
        ["Date · look", `${s.dateMode} · ${s.viewType}`],
        ["Title", d.titleTemplate],
        ["Host", `${d.host.id} · ${d.host.panel}${d.host.rail ? ` · rail "${d.host.rail}"` : ""}`],
        ["Rules", list(d.rules)],
        ["Used on", usedOn.length ? [...new Set(usedOn)].join("; ") : "not placed"],
        ["Verified at", d.verifiedAt.length ? d.verifiedAt.join("; ") : "not yet"],
        ...(d.requires ? ([["Requires", d.requires]] as [string, string][]) : []),
        ...(d.note ? ([["Note", d.note]] as [string, string][]) : []),
      ]}
    />
  );
}

function Rules() {
  return (
    <div className={grid}>
      {RULES.map((r) => (
        <Card
          key={r.id}
          title={r.id}
          sub={r.status === "superseded" ? `superseded by ${r.supersededBy}` : r.lift ? (r.lift.lifted ? "lifted into the data layer" : "must lift") : undefined}
          tone={r.status === "superseded" ? "draft" : undefined}
          rows={[
            ["Statement", r.statement],
            ["Why", r.why],
            ["Applies to", r.appliesTo],
            ["Enforced in", list(r.enforcedIn)],
            ["Test case", r.testCase ? `${r.testCase.school} (${r.testCase.urn}): ${r.testCase.expect}${r.testCase.check ? "" : " [manual]"}` : "none yet"],
            ["Origin", r.origin],
            ...(r.openIssue ? ([["Open issue", r.openIssue]] as [string, string][]) : []),
          ]}
        />
      ))}
    </div>
  );
}

function Measures() {
  return (
    <div className={grid}>
      {MEASURES.map((m) => (
        <Card
          key={m.id}
          title={m.name}
          sub={`${m.id} · ${m.data}${m.phase ? ` · ${m.phase}` : ""}`}
          rows={[
            ["Definition", m.definition],
            ["Grain", m.grain],
            ["Years", `${m.years.from} to ${m.years.to}${m.years.note ? ` (${m.years.note})` : ""}`],
            ["Geographies", Object.entries(m.geographies).map(([g, a]) => `${g} ${a.ok ? "✓" : "✗"}${a.reason ? ` (${a.reason})` : ""}`).join("; ")],
            ["Numbers", list(m.numberTypes)],
            ["Rules", list(m.rules)],
            ["Fetched by", list(m.fetchedBy)],
            ["Citation", m.citation],
            ["Known gaps", list(m.knownGaps)],
          ]}
        />
      ))}
    </div>
  );
}

function Renderers() {
  return (
    <div className={grid}>
      {RENDERERS.map((r) => (
        <Card
          key={r.id}
          title={r.component}
          sub={`${r.id} · ${r.file}`}
          rows={[
            ["Accepts", r.accepts],
            ["Empty", r.states.empty ?? "—"],
            ["Suppressed", r.states.suppressed ?? "—"],
            ["Min height", r.minHeight],
            ["Fullscreen", r.fullscreen],
            ["Phone", r.phone],
          ]}
        />
      ))}
    </div>
  );
}
