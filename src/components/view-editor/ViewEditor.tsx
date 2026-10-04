"use client";

// VicData 0.6.1 S4: the Add a view and Edit view screens
// (docs/wireframes/v0.6/AddView1-3, AddView2Table / Rank / Bar / Spread, EditView,
// EditWide; docs/v0.6/vicdata_0_6_view_editor_rebuild_claude_code_prompt_v1.md, S4).
//
//   1 · Data     decides the numbers (DataStep)
//   2 · View     decides only how they are drawn (ViewTiles + LookBox)
//   3 · Preview  the live preview at the real panel unit; Show this view for (a tick per
//                Results measure, each with a mini preview, greyed with the reason where it
//                can't be honestly drawn); rail icon; title with placeholders
//
// Add walks the three steps; Edit is the same three as tabs, opening on Preview, with a
// yellow "N changes · Undo" line and Cancel / Save (no Remove: removal is the rail menu's).
// On a phone (and any narrow window) one scrolling column at the chooser's 390 panel; on a
// desktop (EditWide) the preview sits at the real panel unit on the left, with a school ▾
// and a measure ▾, and the steps are tabs on the right.
//
// The output is a ViewInstance with a full ViewSpec (model.ts buildInstance); the caller
// applies it through editor-ops, so undo and autosave work. Every preview is a v2 render
// (SpecPreview: renderView(spec, frame) through the page's own hosts).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dataviewById } from "@/catalogue";
import { presetSpec } from "@/catalogue/viewspec";
import { dataviewResults } from "@/catalogue/results";
import { resolveTitle } from "@/catalogue/pick";
import type { ResultsMeasure } from "@/catalogue/types";
import { VIEW_LABEL, changeLabel, measureWord, showForOptions, SHORT_KIND } from "@/catalogue/honest";
import { pinFromContext, type PinSchool } from "@/lib/pin-context";
import { PANEL_UNIT } from "@/catalogue/config";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { ChooserStyles } from "@/components/teacher/chooser/ui";
import { MenuDivider, MenuHeading, MenuRow, PanelMenu, useDismiss } from "@/components/teacher/PanelMenu";
import { ChevronDown } from "@/components/teacher/PanelIcons";
import SchoolSearch from "@/components/SchoolSearch";
import type { SubjectSource } from "@/components/chooser-v06/StepScreens";
import { BackGlyph, CloseGlyph, glyph, TickGlyph, Tokens, VeStyles } from "./bits";
import { DataStep } from "./DataStep";
import { LookBox, ViewTiles } from "./ViewStep";
import { SpecPreview, type PreviewPin } from "./SpecPreview";
import { viewKindRegistered } from "@/components/views";
import { buildInstance, describeChanges, draftProblems, ICONS_FOR, startDraft, titleOf, type Draft, type EditorEnv, type ViewInstance } from "./model";

export type ViewEditorProps = {
  mode: "add" | "edit";
  env: EditorEnv;
  // Edit: the instance as it is.
  instance?: ViewInstance;
  school: PinSchool;
  subjects?: Partial<Record<"ks4" | "ks5", SubjectSource>>;
  theme: "dark" | "light";
  // Context's Compare against and selected subjects (the editor's pill), for its previews.
  contextState?: { against?: string; selected?: string[] };
  onClose: () => void;
  onSave: (instance: ViewInstance) => void;
  // "Something else? Plan it" (Add only): the placeholder form.
  onPlan?: () => void;
};

const STEPS = ["1 · Data", "2 · View", "3 · Preview"] as const;
const BODY = { width: PANEL_UNIT.width - 24, height: 300 };

function useWide(): boolean {
  const q = "(min-width: 1100px) and (min-height: 720px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

export function ViewEditor({ mode, env, instance, school, subjects, theme, contextState, onClose, onSave, onPlan }: ViewEditorProps) {
  const wide = useWide();
  const original = useMemo(() => startDraft(env, instance), [env, instance]);
  const [draft, setDraftRaw] = useState<Draft>(original);
  const [past, setPast] = useState<Draft[]>([]);
  const [step, setStep] = useState(mode === "edit" ? 2 : 0);
  const set = (fn: (d: Draft) => Draft) =>
    setDraftRaw((d) => {
      const n = fn(d);
      if (n !== d) setPast((p) => [...p, d]);
      return n;
    });
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setDraftRaw(prev);
  };
  const out = useMemo(() => buildInstance(draft, env, instance), [draft, env, instance]);
  const dv = dataviewById(out.dataview)!;
  const changes = mode === "edit" ? describeChanges(original, draft, env.phase, env.measure) : [];
  const problems = draftProblems(draft, env);
  const template = titleOf(draft, env);
  // Honest about the renderer too: a View it doesn't draw yet shows its host's view.
  const notYet = !viewKindRegistered(draft.spec.view.kind) && !(out.spec.preset && JSON.stringify(out.spec.view) === JSON.stringify(dataviewSpecView(out.dataview)))
    ? <div className="note warn" style={{ fontSize: 11 }}>The new renderer doesn&rsquo;t draw a {VIEW_LABEL[draft.spec.view.kind].toLowerCase()} here yet: until it does, the panel shows its {dv.label.toLowerCase()}.</div>
    : null;

  // ------------------------------------------------------------- the preview's school
  const [pvSchool, setPvSchool] = useState<PinSchool>(school);
  const [pvSubject, setPvSubject] = useState<{ key: string; label: string } | null>(null);
  const [pvMeasure, setPvMeasure] = useState<ResultsMeasure | null>(env.measure === "entries" ? null : env.measure);
  const ctxFor = (m: ResultsMeasure | null) => ({
    ...env.ctx,
    ...(m ? { results: m } : {}),
    labels: { ...env.ctx.labels, ...(pvSchool ? { school: pvSchool.name } : {}) },
    ...(pvSubject && env.ctx.focus.kind === "subject" ? { focus: { ...env.ctx.focus, subject: { mode: "follow-chips" as const, label: pvSubject.label, key: pvSubject.key } } } : {}),
  });
  const pinFor = (m: ResultsMeasure | null): PreviewPin | null => {
    if (!pvSchool) return null;
    const p = pinFromContext(ctxFor(m), dv, pvSchool);
    const params: Record<string, unknown> = { ...(p.params ?? {}) };
    if (env.columnHost === "teacher.c2.context" && contextState?.against) {
      params.against = contextState.against;
      if (contextState.against === "selected" && contextState.selected) params.selected = contextState.selected;
    }
    return { ...p, ...(m ? { results: m } : {}), params, schoolUrn: pvSchool.urn };
  };
  const resolved = (m: ResultsMeasure | null) => resolveTitle(template, dv, ctxFor(m));
  const subjectWord = pvSubject?.label ?? env.ctx.focus.subject?.label ?? null;

  const showFor = env.followsPill ? showForOptions(out.spec, { phase: env.phase, host: env.columnHost }, dv.host.id, dataviewResults(dv)) : [];

  const preview = (m: ResultsMeasure | null, width: number, box: { width: number; height: number } = BODY, idSuffix = "main") => {
    const pin = pinFor(m);
    if (!pin)
      return (
        <div style={{ width, height: Math.max(46, (box.height * width) / box.width), display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 11, color: "var(--muted)", padding: 8, boxSizing: "border-box" }}>
          A live preview needs a school: look as a school to see it drawn.
        </div>
      );
    return <SpecPreview id={`${idSuffix}.${m ?? "x"}`} dataview={dv} spec={out.spec} params={out.params} pinned={pin} box={box} width={width} />;
  };

  // ------------------------------------------------------------------ words
  const lines = draft.spec.compare === "follows-page" ? "follows the page" : draft.spec.compare.map((c) => (c.kind === "self" ? "this school" : SHORT_KIND[c.kind] + (c.average ? " average" : ""))).join(" + ");
  const yearsWord = "latest" in draft.spec.data.years ? "latest year" : "over time";
  const shownWord = draft.spec.data.shownAs === "change" ? changeLabel(env.measure).toLowerCase() : draft.spec.data.shownAs;
  const fromWord = "from" in draft.spec.data.years ? (draft.spec.data.years.from === "first" ? "first year" : `${draft.spec.data.years.from}/${String((draft.spec.data.years.from + 1) % 100).padStart(2, "0")}`) : null;
  const labels = env.ctx.labels;
  const where = `${labels.dashboard} · ${labels.column} column · ${labels.row} row`;
  const addSub = [where, `${subjectWord ?? "This subject"} · ${lines} · ${yearsWord}`, `${VIEW_LABEL[draft.spec.view.kind]} · ${shownWord} · ${fromWord ? `${fromWord} → latest` : "latest year"}`][step];
  const editSub = `${resolved(pvMeasure)} · ${labels.column} · ${labels.row}`;
  const measureLabel = pvMeasure ? measureWord(env.phase, pvMeasure) : "Entries";

  // ------------------------------------------------------------------ parts
  const stepProps = { draft, set, env, theme, wide, school: pvSchool?.name ?? null };
  const changeLine =
    mode === "edit" && changes.length > 0 ? (
      <div className="changes">
        <span style={{ flex: "1 1 auto" }}>
          <b>
            {changes.length} change{changes.length === 1 ? "" : "s"}:
          </b>{" "}
          {changes.join(" · ")}
        </span>
        <button type="button" onClick={undo}>
          Undo
        </button>
      </div>
    ) : null;

  const viewStep = (
    <>
      <ViewTiles {...stepProps} />
      {draft.spec.view.kind !== "line" && !wide && (
        <div className="pv" style={{ padding: "8px 9px", gap: 4 }}>
          <div className="pvh">
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Preview &middot; {resolved(pvMeasure)}</span>
          </div>
          {preview(pvMeasure, 310, { width: BODY.width, height: 190 }, "view")}
        </div>
      )}
      {!wide && notYet}
      <LookBox {...stepProps} />
      {mode === "add" && onPlan && (
        <button type="button" className="quiet" onClick={onPlan}>
          Something else? Plan it
        </button>
      )}
    </>
  );

  const showForBox = env.followsPill ? (
    <div className="box">
      <div className="label">Show this view for</div>
      {mode === "edit" && <div style={{ fontSize: 11, color: "var(--cc-sub)", marginTop: -4 }}>Untick to take it off one result type. To delete it, use Remove everywhere in the rail icon menu.</div>}
      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "1fr 1fr", gap: 7 }}>
        {showFor.map((o) => {
          const on = o.ok && draft.ticks.includes(o.measure);
          return (
            <button
              key={o.measure}
              type="button"
              className={`res${on ? " on" : ""}${o.ok ? "" : " no"}`}
              disabled={!o.ok}
              aria-pressed={on}
              onClick={() => set((d) => ({ ...d, ticks: on ? d.ticks.filter((m) => m !== o.measure) : [...d.ticks, o.measure] }))}
            >
              <span className="rh" style={o.ok ? undefined : { color: "var(--cc-faint)" }}>
                <span className={`tick${on ? "" : " offb"}`}>{on ? <TickGlyph /> : null}</span>
                {o.label}
              </span>
              {o.ok ? <MiniBox>{(w) => preview(o.measure, w, { width: BODY.width, height: Math.round((46 * BODY.width) / w) }, "mini")}</MiniBox> : <span className="mini cant">Can&rsquo;t draw</span>}
              <span className={`note${o.ok && o.note && /only:/.test(o.note) ? " warn" : ""}`}>{o.ok ? o.note : o.reason}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const iconBox = (
    <div className="box">
      <div className="label">Rail icon</div>
      <div style={{ display: "flex", gap: 6 }}>
        {ICONS_FOR[draft.spec.view.kind].map((name) => (
          <button key={name} type="button" className={`ri${draft.spec.icon === name ? " on" : ""}`} aria-label={`${name.replace(/Icon$/, "")} icon`} aria-pressed={draft.spec.icon === name} onClick={() => set((d) => ({ ...d, spec: { ...d.spec, icon: name } }))}>
            {glyph(name)}
          </button>
        ))}
      </div>
    </div>
  );

  const titleBox = <TitleBox template={template} reads={resolved(pvMeasure)} onChange={(t) => set((d) => ({ ...d, title: t }))} />;

  const problemNote = problems.length ? <div style={{ fontSize: 11.5, color: "var(--cc-danger)", lineHeight: 1.4 }}>{problems[0]}</div> : null;

  const previewStep = (
    <>
      {!wide && (
        <div className="pv" style={{ padding: "9px 10px 8px" }}>
          <div className="pvh">
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Live preview &middot; {pvSchool?.name ?? "no school"}
              {subjectWord ? ` · ${subjectWord}` : ""}
            </span>
            <b style={{ whiteSpace: "nowrap" }}>{measureLabel}</b>
          </div>
          {preview(pvMeasure, 308)}
        </div>
      )}
      {!wide && notYet}
      {showForBox}
      {iconBox}
      {titleBox}
      {problemNote}
    </>
  );

  const body = [<DataStep key="d" {...stepProps} />, viewStep, previewStep][step];

  // ------------------------------------------------------------------ chrome
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const closeBtn = (
    <button ref={closeRef} type="button" className="iconbtn" aria-label="Close" onClick={onClose} style={wide ? { width: 32, height: 32 } : undefined}>
      <CloseGlyph />
    </button>
  );
  const tabs = (
    <div className="tabs" role="tablist" aria-label={mode === "edit" ? "Edit steps" : "Add steps"}>
      {STEPS.map((s, i) => (
        <button key={s} type="button" role="tab" aria-selected={step === i} onClick={() => setStep(i)}>
          {s}
        </button>
      ))}
    </div>
  );
  const save = () => {
    if (problems.length) return;
    onSave(out);
  };
  const primary = (label: string, onClick: () => void, disabled = false) => (
    <button type="button" className="btn primary" onClick={onClick} disabled={disabled} title={disabled ? problems[0] : undefined}>
      {label}
    </button>
  );
  const secondary = (label: string, onClick: () => void) => (
    <button type="button" className="btn secondary" onClick={onClick}>
      {label}
    </button>
  );
  const draftWords = <span style={{ fontSize: wide ? 12 : 11.5, color: "var(--cc-sub)" }}>Edits stay in your draft until you Publish</span>;
  const footer =
    mode === "edit" ? (
      <>
        {draftWords}
        <div style={{ display: "flex", alignItems: "center", gap: wide ? 10 : 8 }}>
          {wide && changes.length > 0 && (
            <span className="changepill">
              {changes.length} change{changes.length === 1 ? "" : "s"} &middot;{" "}
              <button type="button" onClick={undo}>
                Undo
              </button>
            </span>
          )}
          {secondary("Cancel", onClose)}
          {primary("Save", save, problems.length > 0)}
        </div>
      </>
    ) : (
      <>
        {step === 0 ? secondary("Cancel", onClose) : secondary("Back", () => setStep(step - 1))}
        {step < 2 ? primary(step === 0 ? "Next: view" : "Next: preview", () => setStep(step + 1)) : primary("Add to panel", save, problems.length > 0)}
      </>
    );

  if (wide)
    return (
      <TeacherModal label={mode === "edit" ? "Edit view" : "Add a view"} backdropLabel="Close" onClose={onClose} size="wide" initialFocusRef={closeRef}>
        <div className="cc-root ve wide" style={{ width: "100%", height: "100%", background: "var(--cc-panel)", borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--cc-ink)", fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` }}>
          <ChooserStyles />
        <VeStyles />
          <div style={{ padding: "16px 22px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--cc-ink)" }}>{mode === "edit" ? `Edit view · ${resolved(pvMeasure)}` : "Add a view"}</div>
              <div style={{ fontSize: 12, color: "var(--cc-sub)", marginTop: 2 }}>{where}</div>
            </div>
            {closeBtn}
          </div>
          <div style={{ flex: "1 1 auto", display: "flex", gap: 22, padding: "14px 22px 0", minHeight: 0 }}>
            <div style={{ flex: "0 0 380px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="label">Live preview &middot; real panel size</div>
              <div className="pv" style={{ width: PANEL_UNIT.width, height: PANEL_UNIT.height, boxSizing: "border-box", borderRadius: 14, padding: 12, gap: 6 }}>
                <div className="pvh">
                  <SchoolMenu school={pvSchool} subject={subjectWord} subjects={subjects?.[env.phase]} onSchool={(s) => { setPvSchool(s); setPvSubject(null); }} onSubject={setPvSubject} />
                  {env.followsPill ? <MeasureMenu value={pvMeasure} options={showFor} phase={env.phase} onPick={setPvMeasure} /> : <b>{measureLabel}</b>}
                </div>
                {preview(pvMeasure, BODY.width, { width: BODY.width, height: PANEL_UNIT.height - 24 - 22 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--cc-sub)" }}>Preview another school or result type from the two menus on the panel.</div>
              {notYet}
            </div>
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
              {tabs}
              <div className="scroll" style={{ flex: "1 1 auto", padding: "14px 0", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0 }}>
                {body}
              </div>
            </div>
          </div>
          <div style={{ padding: "12px 22px", borderTop: "1px solid var(--cc-line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>{footer}</div>
        </div>
      </TeacherModal>
    );

  return (
    <TeacherModal label={mode === "edit" ? "Edit view" : "Add a view"} backdropLabel="Close" onClose={onClose} size="chooser" initialFocusRef={closeRef}>
      <div className="cc-root ve" style={{ width: "100%", height: "100%", background: "var(--cc-panel)", borderRadius: 14, boxShadow: "var(--cc-shadow)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--cc-ink)", fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` }}>
        <ChooserStyles />
        <VeStyles />
        <div style={{ padding: mode === "add" && step > 0 ? "14px 14px 10px 8px" : "14px 14px 10px 18px", display: "flex", alignItems: "center", gap: mode === "add" && step > 0 ? 4 : 8, flex: "0 0 auto" }}>
          {mode === "add" && step > 0 && (
            <button type="button" className="iconbtn" aria-label="Back" style={{ background: "none" }} onClick={() => setStep(step - 1)}>
              <BackGlyph />
            </button>
          )}
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cc-ink)" }}>{mode === "edit" ? "Edit view" : "Add a view"}</div>
            <div style={{ fontSize: 11.5, color: "var(--cc-sub)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mode === "edit" ? editSub : addSub}</div>
          </div>
          {closeBtn}
        </div>
        <div style={{ padding: "0 18px 10px", borderBottom: "1px solid var(--cc-line)", display: "flex", flexDirection: "column", gap: 7, flex: "0 0 auto" }}>
          {mode === "edit" ? (
            tabs
          ) : (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {STEPS.map((s, i) => (
                  <span key={s} className={`seg${i <= step ? " done" : ""}`} />
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cc-ink)" }}>
                {["1 Data", "2 View", "3 Preview"].map((s, i) => (
                  <span key={s} style={i === step ? undefined : { color: "var(--cc-faint)", fontWeight: 600 }}>
                    {i > 0 ? " · " : ""}
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="scroll" style={{ flex: "1 1 auto", overflowY: "auto", padding: "12px 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {changeLine}
          {body}
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--cc-line)", display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto", gap: 8 }}>{footer}</div>
      </div>
    </TeacherModal>
  );
}

// A mini preview fills its cell: measured once on mount (synchronously, so it draws first
// time), then on resize.
function MiniBox({ children }: { children: (width: number) => ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(Math.floor(el.getBoundingClientRect().width));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={ref} className="mini" style={{ display: "block" }}>
      {w > 0 ? children(w - 2) : null}
    </span>
  );
}

function TitleBox({ template, reads, onChange }: { template: string; reads: string; onChange: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const boxStyle = { fontSize: 12.5, color: "var(--cc-ink)", lineHeight: 1.8, border: "1px solid var(--cc-border2)", borderRadius: 8, padding: "6px 9px", background: "var(--cc-panel)", width: "100%", boxSizing: "border-box" as const, textAlign: "left" as const, fontFamily: "inherit" };
  return (
    <div className="box" style={{ background: "var(--cc-panel)" }}>
      <div className="label">Title</div>
      {editing ? (
        <input
          autoFocus
          aria-label="Title, with placeholders in square brackets"
          defaultValue={template}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== template) onChange(v);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
          style={{ ...boxStyle, outline: "none", borderColor: "var(--cc-primary)" }}
        />
      ) : (
        <button type="button" aria-label="Edit the title" onClick={() => setEditing(true)} style={{ ...boxStyle, cursor: "text" }}>
          <Tokens text={template} />
        </button>
      )}
      <div style={{ fontSize: 11, color: "var(--cc-sub)" }}>Reads: {reads}</div>
    </div>
  );
}

function SchoolMenu({ school, subject, subjects, onSchool, onSubject }: { school: PinSchool; subject: string | null; subjects?: SubjectSource; onSchool: (s: PinSchool) => void; onSubject: (s: { key: string; label: string }) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative", minWidth: 0 }}>
      <button type="button" className="pvmenu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {school?.name ?? "No school"}
        {subject ? ` · ${subject}` : ""} {ChevronDown}
      </button>
      {open && (
        <PanelMenu label="Preview for" width={280} tall>
          {subjects && subjects.items.length > 0 && (
            <>
              <MenuHeading>Subject</MenuHeading>
              {subjects.items.slice(0, 40).map((i) => (
                <MenuRow key={i.key} label={i.label} selected={i.label === subject} onClick={() => { onSubject({ key: i.key, label: i.label }); setOpen(false); }} />
              ))}
              <MenuDivider />
            </>
          )}
          <MenuHeading>Another school</MenuHeading>
          <div style={{ padding: "2px 4px 4px" }}>
            <SchoolSearch allowRequest={false} placeholder="Search schools" onSelect={(s) => { onSchool({ urn: s.urn, name: s.current_name }); setOpen(false); }} />
          </div>
        </PanelMenu>
      )}
    </div>
  );
}

function MeasureMenu({ value, options, phase, onPick }: { value: ResultsMeasure | null; options: { measure: ResultsMeasure; ok: boolean; reason?: string }[]; phase: "ks4" | "ks5"; onPick: (m: ResultsMeasure) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="pvmenu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ color: "var(--fg)", fontWeight: 600 }}>
        {value ? measureWord(phase, value) : "Entries"} {ChevronDown}
      </button>
      {open && (
        <PanelMenu label="Preview on" width={236} align="right">
          <MenuHeading>Preview on</MenuHeading>
          {options.map((o) => (
            <MenuRow key={o.measure} label={measureWord(phase, o.measure)} selected={o.measure === value} disabled={!o.ok} tag={o.ok ? undefined : "can't draw"} onClick={() => { onPick(o.measure); setOpen(false); }} />
          ))}
        </PanelMenu>
      )}
    </div>
  );
}

const dataviewSpecView = (id: `DV-${string}`) => {
  try {
    return presetSpec(id).view;
  } catch {
    return null;
  }
};
