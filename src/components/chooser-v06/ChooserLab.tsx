"use client";

// /platform/chooser-lab (0.6 S4): open "Add a view" for any VicData panel's context, or a
// hand-built one, and see exactly what it hands back (onAdd / onPlaceholder / onAsk) as
// JSON -- how Guy clicks through the chooser before the editor (S5) exists. Platform
// admins only; everyone else gets the plain 404, as on /platform.
import { useEffect, useMemo, useState } from "react";
import { DASHBOARDS } from "@/catalogue/dashboards";
import type { PickPanelContext } from "@/catalogue/pick";
import { AVERAGE_LABEL, DATA_LABEL, FOCUS_LABEL, PHASE_LABEL, compareFromSpec, contextFromPanel, resultsLabel, summaryLine } from "@/catalogue/pick";
import type { CompareKind, DataId, FocusKind, Phase, ResultsMeasure, RowTime } from "@/catalogue/types";
import { ThemeToggle, useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchSavedSets, type SavedSetsPayload } from "@/lib/teacher-view-saved-sets";
import { AddViewChooser } from "./AddViewChooser";
import { LAB_SUBJECTS } from "./labFixtures";

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

export function ChooserLabScreen() {
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
  return <ChooserLab />;
}

const box = "rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4";
const label = "text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--muted3)]";
const input = "rounded-lg border border-[var(--panel-border2)] bg-[var(--box-bg)] px-2.5 py-1.5 text-[13px] text-[var(--fg)]";
const btn = (on: boolean) =>
  `rounded-full border px-3 py-1 text-[12px] font-semibold ${on ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--panel-border2)] text-[var(--muted2)] hover:border-[var(--fg)]"}`;

type Labels = { subject: string; category: string; school: string; setLabel: string; la: string; region: string; results: ResultsMeasure };
type Custom = { data: DataId; phase: Phase; results: ResultsMeasure; focus: FocusKind; compare: CompareKind[]; time: RowTime; dashboard: string; column: string; row: string };

export function ChooserLab() {
  const [theme, setTheme] = useTeacherTheme();
  const [source, setSource] = useState<"panel" | "custom">("panel");
  const [dashId, setDashId] = useState(DASHBOARDS[1]?.id ?? DASHBOARDS[0].id);
  const dash = DASHBOARDS.find((d) => d.id === dashId) ?? DASHBOARDS[0];
  const [panelId, setPanelId] = useState(`${dash.id}.c3.trends`);
  const [labels, setLabels] = useState<Labels>({ subject: "Maths (General)", category: "Sciences & Maths", school: "The Chase", setLabel: "10 nearest", la: "Surrey", region: "South East", results: "points" });
  const [custom, setCustom] = useState<Custom>({ data: "rolls", phase: "ks4", results: "points", focus: "school", compare: ["schools"], time: "over_time", dashboard: "Admissions overview", column: "Our roll", row: "Trends" });
  const [superAdmin, setSuperAdmin] = useState(true);
  const [teacherPalette, setTeacherPalette] = useState(false);
  const [open, setOpen] = useState<null | "pick" | "data">(null);
  const [output, setOutput] = useState<unknown>(null);
  const [urn, setUrn] = useState("");
  const [sets, setSets] = useState<{ payload: SavedSetsPayload; urn: string } | null>(null);
  const [setsMsg, setSetsMsg] = useState<string | null>(null);

  const panelOk = dash.panels.some((p) => p.id === panelId);
  const context: PickPanelContext = useMemo(() => {
    const l = { subject: { label: labels.subject, key: `gcse:${labels.subject}` }, category: labels.category, school: labels.school, setLabel: labels.setLabel, la: labels.la, region: labels.region, results: labels.results };
    if (source === "panel") return contextFromPanel(dash, panelOk ? panelId : dash.panels[0].id, l);
    const compare = compareFromSpec(
      custom.compare.length ? { kinds: custom.compare, subjects: "category", schools: "10-nearest", averages: ["la", "region", "england"] } : null,
      l,
    );
    return {
      data: custom.data,
      phase: custom.phase,
      results: custom.data === "academic.results" ? custom.results : undefined,
      focus: custom.focus === "subject" ? { kind: "subject", subject: { mode: "follow-chips", label: labels.subject, key: `gcse:${labels.subject}` } } : { kind: custom.focus },
      compare,
      time: custom.time,
      labels: { dashboard: custom.dashboard, column: custom.column, row: custom.row, school: labels.school, category: labels.category, la: labels.la, region: labels.region },
    };
  }, [source, dash, panelId, panelOk, labels, custom]);

  const loadSets = async () => {
    setSetsMsg(null);
    const payload = await fetchSavedSets(createBrowserSupabaseClient(), urn.trim(), context.phase).catch(() => null);
    if (payload) {
      setSets({ payload, urn: urn.trim() });
      setSetsMsg(`Loaded ${payload.sets.length} saved sets.`);
    } else {
      setSets(null);
      setSetsMsg("Couldn't load saved sets for that school (the route admits members only); Choose other schools… stays disabled.");
    }
  };

  const setL = (patch: Partial<Labels>) => setLabels({ ...labels, ...patch });
  const setC = (patch: Partial<Custom>) => setCustom({ ...custom, ...patch });

  return (
    <main id="teacher-root" data-theme={theme} className="flex min-h-screen flex-col gap-4 bg-[var(--bg)] px-6 py-5 text-[var(--fg)]">
      <div className="flex items-center gap-3">
        <h1 className="text-[18px] font-bold">Add a view &mdash; lab</h1>
        <span className="text-[12.5px] text-[var(--muted2)]">0.6 S4 · open the chooser for any panel context and see what it returns</span>
        <span className="ml-auto">
          <ThemeToggle theme={theme} onTheme={setTheme} />
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className={box}>
            <div className="mb-3 flex gap-2">
              <button type="button" className={btn(source === "panel")} onClick={() => setSource("panel")}>A VicData panel</button>
              <button type="button" className={btn(source === "custom")} onClick={() => setSource("custom")}>A custom context</button>
            </div>
            {source === "panel" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {DASHBOARDS.map((d) => (
                    <button key={d.id} type="button" className={btn(d.id === dash.id)} onClick={() => { setDashId(d.id); setPanelId(`${d.id}.${panelId.split(".").slice(-2).join(".")}`); }}>
                      {d.name}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `80px repeat(${dash.columns.length}, minmax(0, 1fr))` }}>
                  <span />
                  {dash.columns.map((c) => <span key={c.id} className={label}>{c.title}</span>)}
                  {dash.rows.map((r) => (
                    <div key={r.id} className="contents">
                      <span className="self-center text-[12.5px] text-[var(--muted2)]">{r.name}</span>
                      {dash.columns.map((c) => {
                        const p = dash.panels.find((x) => x.row === r.id && x.column === c.id);
                        if (!p) return <span key={c.id} />;
                        const on = p.id === panelId;
                        return (
                          <button key={c.id} type="button" onClick={() => setPanelId(p.id)} className={`rounded-lg border px-2 py-2 text-left text-[12px] ${on ? "border-[var(--fg)] bg-[var(--box-bg)]" : "border-[var(--panel-border)] hover:border-[var(--fg)]"}`}>
                            <span className="block font-semibold">{p.dataviews.length} views</span>
                            {p.override && <span className="block text-[11px] text-[var(--muted2)]">{p.override.badge}</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                <label className="flex flex-col gap-1"><span className={label}>Data</span>
                  <select className={input} value={custom.data} onChange={(e) => setC({ data: e.target.value as DataId })}>
                    {(Object.keys(DATA_LABEL) as DataId[]).map((d) => <option key={d} value={d}>{DATA_LABEL[d]}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1"><span className={label}>Phase</span>
                  <select className={input} value={custom.phase} onChange={(e) => setC({ phase: e.target.value as Phase })}>
                    {(["ks4", "ks5"] as Phase[]).map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1"><span className={label}>Focus</span>
                  <select className={input} value={custom.focus} onChange={(e) => setC({ focus: e.target.value as FocusKind })}>
                    {(Object.keys(FOCUS_LABEL) as FocusKind[]).map((f) => <option key={f} value={f}>{FOCUS_LABEL[f]}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1"><span className={label}>Row time</span>
                  <select className={input} value={custom.time} onChange={(e) => setC({ time: e.target.value as RowTime })}>
                    <option value="latest">Latest year</option><option value="over_time">Over time</option><option value="either">Either</option>
                  </select>
                </label>
                <div className="col-span-2 flex flex-wrap items-center gap-2"><span className={label}>Compare</span>
                  {(["subjects", "schools", "averages"] as CompareKind[]).map((k) => (
                    <button key={k} type="button" className={btn(custom.compare.includes(k))} onClick={() => setC({ compare: custom.compare.includes(k) ? custom.compare.filter((x) => x !== k) : [...custom.compare, k] })}>{k}</button>
                  ))}
                </div>
                {(["dashboard", "column", "row"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1"><span className={label}>{k} name</span>
                    <input className={input} value={custom[k]} onChange={(e) => setC({ [k]: e.target.value })} />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className={`${box} grid grid-cols-2 gap-2 text-[12.5px]`}>
            <label className="flex flex-col gap-1"><span className={label}>Results pill</span>
              <select className={input} value={labels.results} onChange={(e) => { setL({ results: e.target.value as ResultsMeasure }); setC({ results: e.target.value as ResultsMeasure }); }}>
                {(["points", "threshold", "bands", "counts"] as ResultsMeasure[]).map((r) => <option key={r} value={r}>{resultsLabel(r, context.phase)}</option>)}
              </select>
            </label>
            {(
              [
                ["subject", "Subject chip"],
                ["category", "Its category"],
                ["school", "School"],
                ["setLabel", "Column's school set"],
                ["la", `${AVERAGE_LABEL.la} name`],
                ["region", "Region name"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex flex-col gap-1"><span className={label}>{l}</span>
                <input className={input} value={labels[k]} onChange={(e) => setL({ [k]: e.target.value })} />
              </label>
            ))}
            <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={superAdmin} onChange={(e) => setSuperAdmin(e.target.checked)} /> Super-admin (placeholders, draft views, unbuilt focus options)</label>
            <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={teacherPalette} onChange={(e) => setTeacherPalette(e.target.checked)} /> Teacher palette (academic only)</label>
            <div className="col-span-2 flex flex-wrap items-center gap-2">
              <input className={input} placeholder="School URN for Choose other schools… (optional)" value={urn} onChange={(e) => setUrn(e.target.value)} />
              <button type="button" className={btn(false)} onClick={loadSets} disabled={!urn.trim()}>Load saved sets</button>
              {setsMsg && <span className="text-[12px] text-[var(--muted2)]">{setsMsg}</span>}
            </div>
            <p className="col-span-2 text-[11.5px] text-[var(--muted3)]">2a / 2b use a SAMPLE subject list (not a real school&apos;s); on a dashboard the editor passes the school&apos;s own.</p>
          </section>

          <div className="flex gap-2">
            <button type="button" className={btn(true)} onClick={() => setOpen("pick")}>Open Add a view</button>
            <button type="button" className={btn(false)} onClick={() => setOpen("data")}>Open at Step 1 (column with no data)</button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className={box}>
            <p className={label}>Context passed in</p>
            <p className="mt-1 text-[13px]">{summaryLine(context, true)}</p>
            <pre className="mt-2 max-h-[18rem] overflow-auto whitespace-pre-wrap text-[11.5px] text-[var(--muted2)]">{JSON.stringify(context, null, 2)}</pre>
          </section>
          <section className={box}>
            <p className={label}>Last output</p>
            <pre data-testid="lab-output" className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap text-[11.5px]">{output ? JSON.stringify(output, null, 2) : "Nothing yet: add a view, add a placeholder or ask."}</pre>
          </section>
        </div>
      </div>

      <AddViewChooser
        key={`${open}-${JSON.stringify(context)}`}
        open={open !== null}
        startAt={open === "data" ? "data" : "pick"}
        onClose={() => setOpen(null)}
        context={context}
        superAdmin={superAdmin}
        palette={teacherPalette ? ["academic.candidates", "academic.results"] : undefined}
        theme={theme}
        subjects={LAB_SUBJECTS}
        comparators={sets ? { payload: sets.payload, targetUrn: sets.urn, targetName: labels.school, onSetsChanged: loadSets } : undefined}
        onAdd={(instance, override) => {
          setOutput({ onAdd: { instance, override: override ?? null } });
          setOpen(null);
        }}
        onPlaceholder={(p) => {
          setOutput({ onPlaceholder: p });
          setOpen(null);
        }}
        onAsk={(c) => setOutput({ onAsk: { context: c } })}
      />
    </main>
  );
}
