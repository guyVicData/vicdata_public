"use client";

// VicData 0.6 S4: "Add a view" (scope brief §3; combinations doc; boards Ch3Pick,
// Ch3Adjust, Ch3Empty, PickEither, Ch1Data, Ch2Focus, Ch2Subject, Ch2Custom).
//
// Self-contained: the editor (S5) and meetings (S7) open it with the panel's resolved
// context and get back a DataviewInstance (plus a PanelOverride when what was picked
// doesn't follow the panel's column/row), a placeholder (super-admin), or an ask.
//
//   opens on Pick (pre-filled from the panel) -- "Change" -> Step 1 Data -> Step 2 Focus
//   (-> 2a subject / 2b custom area / the comparator chooser) -> back to Pick;
//   Pick -> Customise (forks to a custom view); Pick empty -> loosen / placeholder / ask;
//   Pick's second tab, Browse VicData dashboards -> any view, marked overridden if needed.
//
// Shell: TeacherModal's "chooser" size and the comparator chooser's Panel, header, body,
// footer and buttons (src/components/teacher/chooser/ui.tsx) -- one modal language.
import { useMemo, useState } from "react";
import { DATAVIEWS, relaxations as relaxationsOf } from "@/catalogue";
import { DASHBOARDS } from "@/catalogue/dashboards";
import type { CustomViewParams, PickPanelContext, PlaceholderRequest } from "@/catalogue/pick";
import { browseContext, customiseCandidates, newInstanceId, overrideBetween, pickResults, readyMadeInstance, toPickContext, viewTitle } from "@/catalogue/pick";
import type { DataId, Dataview, DataviewInstance, PanelOverride } from "@/catalogue/types";
import { ComparatorSetChooser, type ChooserChoice } from "@/components/teacher/ComparatorSetChooser";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { Panel } from "@/components/teacher/chooser/ui";
import type { SavedSetsPayload } from "@/lib/teacher-view-saved-sets";
import { pinFromContext, type PinSchool } from "@/lib/pin-context";
import { AvStyles } from "./bits";
import { CustomiseScreen } from "./CustomiseScreen";
import { EmptyScreen, type EmptyDraft, type Relaxation } from "./EmptyScreen";
import { PickScreen, type BrowsePick, type PickTab } from "./PickScreen";
import { logViewRequest } from "./requests";
import { ChooserWordsContext, COLUMN_WORDS, SLOT_WORDS } from "./words";
import { AreaStep, DataStep, FocusStep, SubjectStep, focusOptions, type SubjectSource } from "./StepScreens";

export type AddViewChooserProps = {
  open: boolean;
  onClose: () => void;
  // The panel's resolved context (column + row + override): build it with
  // contextFromPanel() from src/catalogue/pick.ts.
  context: PickPanelContext;
  superAdmin: boolean;
  // The role's palette (catalogue §4.4): which data families may be ADDED. Absent = all.
  palette?: DataId[];
  // `override` is set when the pick doesn't follow the panel's own context (changed via
  // Steps 1-2, a loosening, or a view taken from Browse). It is a PanelOverride, plus
  // `time` when a loosening changed the row's Time.
  // `ctx` (0.6 integration): the context the pick was made in, already resolved -- what a
  // meeting pins from.
  onAdd: (instance: DataviewInstance, override?: PanelOverride, ctx?: PickPanelContext) => void;
  onPlaceholder?: (p: PlaceholderRequest) => void;
  // Called after "Ask for this view" (the request is also written to view_requests).
  onAsk?: (context: PickPanelContext) => void;
  // --- optional extras ---
  // Theme for the reused pickers; default: #teacher-root's data-theme.
  theme?: "dark" | "light";
  // C16: a column with no data yet opens at Step 1. Snag 1 / 03: the editor's view menu
  // opens "Edit this view…" on Customise, or a placeholder's form ("placeholder"), for
  // the instance in `editing`, pre-filled with its current choices.
  startAt?: "pick" | "data" | "customise" | "placeholder";
  editing?: DataviewInstance;
  // The primary button's words (default "Add to panel" / "Add to slide").
  addLabel?: string;
  // 0.6 integration: no column to inherit from (a meeting slot, scope brief §7.5).
  columnless?: boolean;
  // The school's subjects per phase, for 2a / 2b (absent: those screens say so).
  subjects?: Partial<Record<"ks4" | "ks5", SubjectSource>>;
  // The comparator chooser's inputs (absent: "Choose other schools…" is disabled).
  comparators?: { payload: SavedSetsPayload; targetUrn: string; targetName: string; onSetsChanged: () => Promise<void> };
  // Write "Ask for this view" to view_requests (default true).
  persistAsk?: boolean;
  // 0.6 integration: a school to draw Pick's previews live for (LiveViewPreview); absent,
  // the previews stay data-free.
  school?: PinSchool;
};

type Screen = "pick" | "customise" | "data" | "focus" | "subject" | "area" | "placeholder";

export function AddViewChooser(props: AddViewChooserProps) {
  if (!props.open) return null;
  return <Chooser {...props} />;
}

function readTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.getElementById("teacher-root")?.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function Chooser({ onClose, context, superAdmin, palette, onAdd, onPlaceholder, onAsk, theme: themeProp, startAt, subjects, comparators, persistAsk = true, school = null, columnless = false, editing, addLabel }: AddViewChooserProps) {
  const [theme] = useState<"dark" | "light">(() => themeProp ?? readTheme());
  const original = context;
  const opts = useMemo(() => ({ palette, superAdmin }), [palette, superAdmin]);

  const editDv = editing?.kind === "view" ? DATAVIEWS.find((d) => d.id === editing.dataview) : undefined;
  const [screen, setScreen] = useState<Screen>(startAt === "data" ? "data" : startAt === "placeholder" && editing?.kind === "placeholder" ? "placeholder" : startAt === "customise" && editDv ? "customise" : "pick");
  // Editing a view: Customise starts on that view, whether or not Pick would list it.
  const [editBase, setEditBase] = useState<Dataview | null>(startAt === "customise" ? (editDv ?? null) : null);
  const [working, setWorking] = useState<PickPanelContext>(context);
  const [draft, setDraft] = useState<PickPanelContext>(context);
  const [compareOn, setCompareOn] = useState(context.compare.kinds.length > 0);
  const [tab, setTab] = useState<PickTab>("suggested");
  const [selected, setSelected] = useState<string | null>(editDv?.id ?? null);
  const [browse, setBrowse] = useState<BrowsePick | null>(null);
  const [emptyDraft, setEmptyDraft] = useState<EmptyDraft>(
    editing?.kind === "placeholder" ? { description: editing.description, shape: editing.shape, notes: editing.notes ?? "" } : { description: "", shape: "graph", notes: "" },
  );
  const [asked, setAsked] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [subjectPick, setSubjectPick] = useState<{ key: string; label: string } | null>(null);
  const [area, setArea] = useState<{ ticked: string[]; name: string }>({ ticked: [], name: "" });
  const [comparatorOpen, setComparatorOpen] = useState(false);

  const results = useMemo(() => pickResults(working, opts), [working, opts]);
  const sel = results.some((r) => r.dataview.id === selected) ? selected : (results[0]?.dataview.id ?? null);
  const selectedDv = sel ? DATAVIEWS.find((d) => d.id === sel) : undefined;
  const relax = useMemo(() => relaxationsOf(DATAVIEWS, toPickContext(working, opts), DASHBOARDS) as Relaxation[], [working, opts]);
  const reason = (how: string) => `${how} in Add a view (${original.labels.dashboard}, ${original.labels.column} · ${original.labels.row})`;

  const add = (instance: DataviewInstance, ctx: PickPanelContext, how: string) => onAdd(instance, overrideBetween(original, ctx, reason(how)), ctx);
  const liveFor = useMemo(
    () => (school ? (dv: Dataview, ctx: PickPanelContext) => ({ ...pinFromContext(ctx, dv, school), schoolUrn: school.urn }) : undefined),
    [school],
  );

  const startChange = () => {
    setDraft(working);
    setCompareOn(working.compare.kinds.length > 0);
    setScreen("data");
  };
  const toFocus = () => {
    // Data changed: keep the focus if it is still offered, else the nearest sensible one.
    const offered = focusOptions(draft, superAdmin);
    if (!offered.some((o) => o.kind === draft.focus.kind)) {
      const pick = offered.find((o) => o.kind === "subject") ?? offered.find((o) => o.kind === "school") ?? offered.find((o) => o.kind === "around_school") ?? offered[0];
      if (pick) setDraft({ ...draft, focus: pick.kind === "subject" ? { kind: "subject", subject: original.focus.subject ?? { mode: "follow-chips", label: null } } : { kind: pick.kind } });
    }
    setScreen("focus");
  };
  const commitSteps = () => {
    setWorking(compareOn ? draft : { ...draft, compare: { kinds: [] } });
    setTab("suggested");
    setBrowse(null);
    setAsked(false);
    setAskError(null);
    setScreen("pick");
  };

  const onBrowsePick = (cell: BrowsePick["cell"], dv: Dataview) => {
    const { ctx, fits } = browseContext(cell, dv, working, opts);
    const o = overrideBetween(original, ctx, reason("Taken from Browse VicData dashboards"));
    setBrowse({ cell, dv, fits, badge: o?.badge ?? null, title: viewTitle(dv, ctx) });
  };

  const addFromPick = () => {
    if (tab === "browse" && browse) {
      const { ctx } = browseContext(browse.cell, browse.dv, working, opts);
      add(readyMadeInstance(browse.dv, ctx), ctx, `Taken from ${browse.cell.dashboard.name}, ${browse.cell.column.title} · ${browse.cell.rowName}`);
      return;
    }
    if (selectedDv) add(readyMadeInstance(selectedDv, working), working, "Picked");
  };

  const addCustom = (dv: Dataview, params: CustomViewParams | null) => {
    const instance: DataviewInstance = params
      ? { id: newInstanceId(working, dv.id, true), kind: "view", dataview: dv.id, params: { ...params }, title: params.title }
      : readyMadeInstance(dv, working);
    add(instance, working, params ? "Customised" : "Picked");
  };

  const submitEmpty = async () => {
    if (superAdmin) {
      onPlaceholder?.({ description: emptyDraft.description.trim(), shape: emptyDraft.shape, notes: emptyDraft.notes.trim(), context: working });
      return;
    }
    setBusy(true);
    setAskError(null);
    if (persistAsk) {
      const r = await logViewRequest(emptyDraft.description, working);
      if (!r.ok) setAskError(r.message);
    }
    onAsk?.(working);
    setAsked(true);
    setBusy(false);
  };

  const onRelax = (id: Relaxation["id"]) => {
    setWorking(id === "no-compare" ? { ...working, compare: { kinds: [] } } : { ...working, time: id === "over-time" ? "over_time" : "latest" });
    setSelected(null);
  };

  const onComparatorDone = (choice: ChooserChoice) => {
    const label =
      choice.kind === "saved" ? (comparators?.payload.sets.find((s) => s.id === choice.id)?.name ?? "A saved set") : choice.label;
    const spec = choice.kind === "saved" ? { savedSetId: choice.id } : ("saved-or-chooser" as const);
    setDraft({ ...draft, compare: { ...draft.compare, kinds: [...new Set([...draft.compare.kinds, "schools" as const])], schools: { spec, label, choice } } });
    setCompareOn(true);
    setComparatorOpen(false);
  };

  let body;
  const customBase = editBase ?? selectedDv;
  if (screen === "customise" && customBase) {
    const initialParams = editBase && editing?.kind === "view" && editing.params && "numberType" in editing.params ? (editing.params as CustomViewParams) : null;
    body = (
      <CustomiseScreen
        ctx={working}
        base={customBase}
        initialParams={initialParams}
        candidates={customiseCandidates(working, opts)}
        where={columnless ? "meeting" : "dashboard"}
        onBack={() => { setEditBase(null); setScreen("pick"); }}
        onClose={onClose}
        onAdd={addCustom}
      />
    );
  } else if (screen === "placeholder") {
    body = (
      <EmptyScreen
        ctx={working}
        superAdmin={superAdmin}
        relaxations={[]}
        draft={emptyDraft}
        onDraft={setEmptyDraft}
        asked={false}
        askError={null}
        busy={false}
        onRelax={onRelax}
        onChangeData={startChange}
        onBack={onClose}
        onClose={onClose}
        onSubmit={submitEmpty}
        editing
      />
    );
  } else if (screen === "data") {
    body = <DataStep draft={draft} original={original} palette={palette} superAdmin={superAdmin} theme={theme} onDraft={setDraft} onBack={() => setScreen("pick")} onClose={onClose} onNext={toFocus} columnless={columnless} />;
  } else if (screen === "focus") {
    body = (
      <FocusStep
        draft={draft}
        original={original}
        superAdmin={superAdmin}
        compareOn={compareOn}
        onCompareOn={setCompareOn}
        canChooseSchools={!!comparators}
        onDraft={setDraft}
        onSubject={() => {
          const s = draft.focus.subject;
          setSubjectPick(s?.label ? { key: s.key ?? s.label, label: s.label } : null);
          setScreen("subject");
        }}
        onCustomArea={() => {
          setArea({ ticked: draft.focus.area?.subjects ?? [], name: draft.focus.area?.name ?? "" });
          setScreen("area");
        }}
        onChooseSchools={() => setComparatorOpen(true)}
        onBack={() => setScreen("data")}
        onClose={onClose}
        onNext={commitSteps}
      />
    );
  } else if (screen === "subject") {
    body = (
      <SubjectStep
        phase={draft.phase}
        school={draft.labels.school}
        source={subjects?.[draft.phase]}
        picked={subjectPick}
        theme={theme}
        onPick={setSubjectPick}
        onBack={() => setScreen("focus")}
        onClose={onClose}
        onDone={() => {
          if (subjectPick) {
            const same = draft.focus.subject?.key === subjectPick.key || draft.focus.subject?.label === subjectPick.label;
            setDraft({ ...draft, focus: { kind: "subject", subject: { mode: same ? (draft.focus.subject?.mode ?? "follow-chips") : "always", label: subjectPick.label, key: subjectPick.key } } });
          }
          setScreen("focus");
        }}
      />
    );
  } else if (screen === "area") {
    body = (
      <AreaStep
        source={subjects?.[draft.phase]}
        ticked={area.ticked}
        name={area.name}
        theme={theme}
        onTicked={(ticked) => setArea({ ...area, ticked })}
        onName={(name) => setArea({ ...area, name })}
        onBack={() => setScreen("focus")}
        onClose={onClose}
        onDone={() => {
          setDraft({ ...draft, focus: { kind: "custom_area", area: { name: area.name.trim() || "Custom area", subjects: area.ticked } } });
          setScreen("focus");
        }}
      />
    );
  } else if (results.length === 0) {
    body = (
      <EmptyScreen
        ctx={working}
        superAdmin={superAdmin}
        relaxations={relax}
        draft={emptyDraft}
        onDraft={setEmptyDraft}
        asked={asked}
        askError={askError}
        busy={busy}
        onRelax={onRelax}
        onChangeData={startChange}
        onBack={() => {
          setDraft(working);
          setScreen("focus");
        }}
        onClose={onClose}
        onSubmit={submitEmpty}
      />
    );
  } else {
    body = (
      <PickScreen
        ctx={working}
        results={results}
        tab={tab}
        onTab={setTab}
        selected={sel}
        onSelect={setSelected}
        browse={browse}
        onBrowse={onBrowsePick}
        onChange={startChange}
        onBack={() => {
          setDraft(working);
          setCompareOn(working.compare.kinds.length > 0);
          setScreen("focus");
        }}
        onClose={onClose}
        onCustomise={() => selectedDv && setScreen("customise")}
        onAdd={addFromPick}
        liveFor={liveFor}
      />
    );
  }

  return (
    <>
      <TeacherModal label="Add a view" backdropLabel="Close Add a view" size="chooser" onClose={() => { if (!comparatorOpen) onClose(); }}>
        <Panel>
          <div className="av-root" style={{ display: "contents" }}>
            <AvStyles />
            <ChooserWordsContext.Provider value={addLabel ? { ...(columnless ? SLOT_WORDS : COLUMN_WORDS), add: addLabel } : columnless ? SLOT_WORDS : COLUMN_WORDS}>{body}</ChooserWordsContext.Provider>
          </div>
        </Panel>
      </TeacherModal>
      {comparatorOpen && comparators && (
        <ComparatorSetChooser
          payload={comparators.payload}
          phase={draft.phase}
          theme={theme}
          targetUrn={comparators.targetUrn}
          targetName={comparators.targetName}
          initialEdit={null}
          onClose={() => setComparatorOpen(false)}
          onDone={onComparatorDone}
          onSetsChanged={comparators.onSetsChanged}
        />
      )}
    </>
  );
}
