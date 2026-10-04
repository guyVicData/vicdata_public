"use client";

// VicData 0.6 S5: the dashboard editor (docs/wireframes/v0.6/Editor.dc.html, with
// Skeleton, History, RowSettings, ColumnChange, SpanAsk and Assign as its dialogs and
// panels). Super-admin only (EditorScreen gates it).
//
//   edit bar      collapsible: [Export planned views] · Undo · Redo · History · Settings ·
//                 Rename · Assign · Save as · Publish · Exit, and the status line
//   switcher      the linked-dashboard switcher (the group's dashboards)
//   canvas        EditorCanvas: columns, rows, panels at the panel unit
//
// Every change is a pure op from src/lib/editor-ops.ts recorded on a 30-step undo stack
// (G8). The draft autosaves (debounced saveDraft); Publish makes a new immutable version
// with the generated change summary. Until the S2 tables exist (store `available: false`)
// it all works in memory and says "Saving needs the database update".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ComparatorState, CompareAgainstState, Dataview, DataviewInstance, DashboardConfig, PanelOverride, ResultsMeasure } from "@/catalogue/types";
import { dataviewById } from "@/catalogue";
import { followsResultsPill, showsOn, tagForPill } from "@/catalogue/results";
import { configAxes, panelState, showsOnState, type VariantAxis, type VariantState } from "@/catalogue/variants";
import { measuresFor } from "@/lib/teacher-view-panels";
import { PillMenu } from "@/components/teacher/PillMenu";
import { MenuHeading, MenuRow } from "@/components/teacher/PanelMenu";
import { SwitchButton } from "@/components/edit-mode/EditSwitch";
import { contextFromPanel, settingsOf, titleOverrideOf, type PanelLabels, type PickPanelContext, type PlaceholderRequest } from "@/catalogue/pick";
import { DASHBOARDS, groupOf } from "@/catalogue/dashboards";
import { AddViewChooser } from "@/components/chooser-v06/AddViewChooser";
import type { SubjectSource } from "@/components/chooser-v06/StepScreens";
import type { PinSchool } from "@/lib/pin-context";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { trackEditorWrite } from "@/lib/edit-mode";
import {
  createDashboard,
  discardDraft,
  listAssignments,
  listVersions,
  publish,
  saveDraft,
  setAssignments,
  updateDashboardRow,
  type DashboardRow,
  type Loaded,
  type VersionRow,
} from "@/lib/dashboards-store";
import { EC, EDITOR, accentVars, colourHex } from "@/lib/editor-layout";
import * as ops from "@/lib/editor-ops";
import { loadViewRequests, plannedMarkdown } from "@/lib/editor-export";
import { AssignDialog, assignedTo, type AssignDraft } from "./AssignDialog";
import { ChevronDown, ChevronUp, EBtn } from "./bits";
import { ContextStepsDialog, contextFromColumn } from "./ContextSteps";
import { ColumnChangeDialog, ExportDialog, PublishDialog, RowSettingsDialog, SaveAsDialog, SlotMapDialog, SpanAskDialog, TextDialog } from "./Dialogs";
import { EditorCanvas, canvasWidth, type CanvasHandlers } from "./EditorCanvas";
import { EditorVariantsContext, type EditorVariants, type PanelAction } from "./EditorPanel";
import { HistoryPanel } from "./HistoryPanel";
import { DataFreePreview, type PanelPreviewComponent } from "./PanelPreview";
import { SettingsDialog, type SettingsValue } from "./SettingsDialog";

// S6's "Copy this view to a dashboard…" dialog plugs in here. Absent: a stub that copies
// within this dashboard and says the rest comes with S6.
export type CopyViewHandler = (args: { config: DashboardConfig; panelId: string; instance: DataviewInstance }) => void;

export type DashboardEditorProps = {
  loaded: Loaded & { available: boolean };
  superAdmin: boolean;
  // The panel body. Default: the data-free stand-in; E's LiveViewPreview drops in here.
  Preview?: PanelPreviewComponent;
  onCopyView?: CopyViewHandler;
  // Title labels when the host has a school ("[subject]" -> "Maths (General)").
  labels?: PanelLabels;
  // 0.6 integration: the school Add a view previews live for, and its subjects (2a / 2b).
  school?: PinSchool;
  subjects?: Partial<Record<"ks4" | "ks5", SubjectSource>>;
  // 0.6 snag 2 (B), the editor shown in place on a VicData dashboard page (the footer's
  // or the trial banner's Edit switch): `top` above the edit bar (the trial banner),
  // `onExit` for Exit (the switch goes off) and `onSwitch` for the linked-dashboard
  // switcher (stays on the page). Save as then always saves as the signed-in person
  // (`writeAsSelf`), never into a trial.
  top?: ReactNode;
  onExit?: () => void;
  onSwitch?: (id: string) => void;
  writeAsSelf?: boolean;
  // 0.6 snag 4 / 02: the page's own Compare against and comparator kind, so the editor's
  // pills open on them (as the Results pill opens on labels.results).
  // `selected`: Context's selected subjects, for live previews on "Selected subjects".
  states?: { compareAgainst?: CompareAgainstState; comparator?: ComparatorState; selected?: string[] };
};

type DialogState =
  | null
  | { kind: "add"; target: ops.Target; ctx: PickPanelContext }
  // Snag 1 / 03: the view menu's "Edit this view…" (Customise, or a placeholder's form) and
  // "Swap for another view…" (Pick): the chooser's pick replaces the instance in place.
  | { kind: "replace"; mode: "edit" | "swap"; instance: DataviewInstance; ctx: PickPanelContext }
  | { kind: "row"; rowId: string }
  | { kind: "column"; columnId: string; ctx: PickPanelContext }
  | { kind: "column-change"; columnId: string; patch: ops.ColumnPatch; impact: ops.ColumnImpact }
  | { kind: "override"; panelId: string; ctx: PickPanelContext }
  | { kind: "span"; panelId: string; cols: number; options: ops.SpanOption[] }
  | { kind: "rename-panel"; panelId: string }
  | { kind: "slot"; mode: "move-view" | "copy-view" | "move-panel"; panelId: string; instanceId: string | null }
  | { kind: "settings" }
  | { kind: "assign" }
  | { kind: "publish" }
  | { kind: "save-as" }
  | { kind: "export"; markdown: string | null; note: string | null };

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

// Snag 1 / 03: a rail icon's hover / focus / open state (amber, with the "···" tab on its
// right edge centred on the rail divider) and, with no hover (touch), the tab always on the
// active icon. The tab is in the DOM (and the Tab order) whenever the rail is editable.
const AMBER_ICON = `color:${EC.amberText}!important;border:1px solid ${EC.amber}!important`;
const TAB_ON = "opacity:1;pointer-events:auto";
const RAIL_MENU_CSS =
  `.ed-rv{position:relative;display:flex;width:${EDITOR.railIcon}px;height:${EDITOR.railIcon}px}` +
  // 2.5px of transparent lead-in so the pointer can cross from the icon to the tab.
  `.ed-rv-tab{position:absolute;left:${EDITOR.railIcon}px;top:0;height:${EDITOR.railIcon}px;width:16.5px;padding:0 0 0 2.5px;margin:0;border:0;background:transparent;display:flex;align-items:center;cursor:pointer;opacity:0;pointer-events:none;z-index:2}` +
  `.ed-rv-tab>span{width:14px;height:14px;border-radius:4px;background:${EC.amber};color:${EC.amberInk};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;line-height:1;letter-spacing:-0.5px}` +
  `.ed-rv[data-open] .ed-rv-icon,.ed-rv:has(:focus-visible) .ed-rv-icon{${AMBER_ICON}}` +
  `.ed-rv[data-open] .ed-rv-tab,.ed-rv:has(:focus-visible) .ed-rv-tab{${TAB_ON}}` +
  `@media (hover:hover){.ed-rv:hover .ed-rv-icon{${AMBER_ICON}}.ed-rv:hover .ed-rv-tab{${TAB_ON}}}` +
  `@media (hover:none){.ed-rv[data-active] .ed-rv-tab{${TAB_ON}}}`;

const OWNER_WORD = { vicdata: "VicData", school: "School", user: "Personal" } as const;

export function DashboardEditor({ loaded, superAdmin, Preview = DataFreePreview, onCopyView, labels: hostLabels, school = null, subjects, top, onExit, onSwitch, writeAsSelf = false, states: hostStates }: DashboardEditorProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [theme] = useTeacherTheme();
  const available = loaded.available;
  const [row, setRow] = useState<DashboardRow>(loaded.row);
  const [history, setHistory] = useState(() => ops.initHistory(loaded.draft ?? loaded.config));
  const config = history.present;
  const [published, setPublished] = useState<{ version: VersionRow | null; config: DashboardConfig | null }>({ version: loaded.version, config: loaded.version?.config ?? null });
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [assign, setAssign] = useState<AssignDraft>([]);
  const [save, setSave] = useState<{ state: SaveState; at: number | null }>({ state: available ? "idle" : "offline", at: null });
  const [barOpen, setBarOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewing, setPreviewing] = useState<VersionRow | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 0.6 snag 3 / 03: a toast that offers Undo (a view leaving the pill's rail).
  // The toast text that offers it; any other toast doesn't.
  const [undoFor, setUndoFor] = useState<string | null>(null);
  const toastUndo = !!toast && toast === undoFor;
  // 0.6 snag 3 / 03: the Results pill (on a Results dashboard): the page's pill when the
  // editor opens in place, else Average points. Rails, previews and the view menu follow it.
  const [pill, setPill] = useState<ResultsMeasure>(hostLabels?.results ?? "points");
  // 0.6 snag 4 / 02: Context's Compare against and Comparisons' comparator kind, each with
  // its own pill, opening on the page's state.
  const [against, setAgainst] = useState<CompareAgainstState>(hostStates?.compareAgainst ?? "category");
  // Comparisons' comparator kind has no pill of its own (the band has no room for a third):
  // it is the page's, and Show all views reveals the views of the other kind.
  const comparator: ComparatorState = hostStates?.comparator ?? "schools";
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // ----------------------------------------------------------------- loading

  const refreshVersions = useCallback(async () => {
    if (!available) return;
    try {
      setVersions(await listVersions(supabase, row.id));
    } catch {
      setVersions([]);
    }
  }, [available, supabase, row.id]);

  useEffect(() => {
    if (!available) return;
    (async () => {
      await refreshVersions();
      try {
        setAssign((await listAssignments(supabase, row.id)).map(({ target_kind, role, team_id, profile_id, mode, is_key }) => ({ target_kind, role, team_id, profile_id, mode, is_key })));
      } catch {
        setAssign([]);
      }
    })();
  }, [available, supabase, row.id, refreshVersions]);

  // ----------------------------------------------------------------- edits

  const apply = useCallback((fn: (c: DashboardConfig) => DashboardConfig, key: string | null = null) => {
    setHistory((h) => {
      try {
        return ops.record(h, fn(h.present), key);
      } catch (e) {
        if (e instanceof ops.EditorError) {
          setToast(e.message);
          return h;
        }
        throw e;
      }
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toastUndo ? 6000 : 4000);
    return () => window.clearTimeout(t);
  }, [toast, toastUndo]);

  // Autosave the draft after the last edit. An edit still waiting when the editor closes
  // (Exit, or the Edit switch going off) is saved then, so nothing is lost.
  const first = useRef(true);
  const unsaved = useRef<{ id: string; config: DashboardConfig; base: string | null } | null>(null);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!available) return;
    unsaved.current = { id: row.id, config, base: published.version?.id ?? null };
    const t = window.setTimeout(async () => {
      unsaved.current = null;
      setSave({ state: "saving", at: null });
      try {
        const p = saveDraft(supabase, row.id, config, published.version?.id ?? null);
        trackEditorWrite(p);
        await p;
        setSave({ state: "saved", at: Date.now() });
      } catch {
        setSave({ state: "error", at: null });
      }
    }, EDITOR.autosaveMs);
    return () => window.clearTimeout(t);
  }, [config, available, supabase, row.id, published.version?.id]);
  useEffect(
    () => () => {
      const u = unsaved.current;
      if (u) trackEditorWrite(saveDraft(supabase, u.id, u.config, u.base).catch(() => undefined));
    },
    [supabase],
  );

  // Undo / redo from the keyboard (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      setHistory((h) => (e.shiftKey ? ops.redo(h) : ops.undo(h)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ----------------------------------------------------------------- derived

  const resultsPill = followsResultsPill(config);
  const pillMeasures = measuresFor(config.columns[0]?.data.phase ?? "ks4");
  const pillLabels = Object.fromEntries(pillMeasures.map((m) => [m.id, m.label])) as Record<ResultsMeasure, string>;
  const pillOn = resultsPill ? pill : null;
  // Titles and previews read the editor's pill, not the page's.
  const labels = useMemo(() => (resultsPill ? { ...hostLabels, results: pill } : hostLabels), [resultsPill, hostLabels, pill]);
  // 0.6 snag 4 / 02: one pill per variant axis the dashboard has (catalogue/variants.ts),
  // with the page's own words: Context's category option names the category.
  const axes = configAxes(config);
  const againstLabels: Record<CompareAgainstState, string> = { category: hostLabels?.category ? `${hostLabels.category} subjects` : "Subject category", whole: "All subjects", selected: "Selected subjects" };
  const comparatorLabels: Record<ComparatorState, string> = { schools: "A set of schools", ranking: "A ranking" };
  const editorState: VariantState = {
    ...(axes.includes("results") ? { results: pill } : {}),
    ...(axes.includes("compareAgainst") ? { compareAgainst: against } : {}),
    ...(axes.includes("comparator") ? { comparator } : {}),
  };
  const axisInfo: EditorVariants["axes"] = {
    results: { name: "Results", labels: pillLabels },
    compareAgainst: { name: "Compare against", labels: againstLabels },
    comparator: { name: "Compared against", labels: comparatorLabels },
  };
  const stateOfPanel = (panelId: string): VariantState | null => {
    const p = config.panels.find((x) => x.id === panelId);
    const st = p ? panelState(config, p, editorState) : {};
    return Object.keys(st).length ? st : null;
  };
  const variantsCtx: EditorVariants | null = axes.length
    ? {
        state: editorState,
        axes: axisInfo,
        contextSelected: hostStates?.selected,
        showAll,
        onShowOn: (panelId, instanceId, axis: VariantAxis, states) => {
          const inst = config.panels.flatMap((p) => p.dataviews).find((v) => v.id === instanceId);
          apply((c) => ops.setViewStates(c, instanceId, axis, states as never));
          const now = editorState[axis];
          const st = stateOfPanel(panelId);
          if (inst && now && st && showsOnState(inst, st) && !states.includes(now) && !showAll) {
            const name = inst.kind === "view" ? (titleOverrideOf(inst) ?? dataviewById(inst.dataview)?.label ?? inst.dataview) : inst.description;
            const text = `${name} no longer shows on ${axisInfo[axis]!.labels[now]}.`;
            setUndoFor(text);
            setToast(text);
          }
        },
      }
    : null;

  const ready = useMemo(() => ops.readyToSwap(config), [config]);
  const planned = useMemo(() => ops.plannedCount(config), [config]);
  const { empty } = useMemo(() => ops.validateConfig(config), [config]);
  const dirty = JSON.stringify(config) !== JSON.stringify(published.config);
  const hex = colourHex(config.colour);
  const assignedLine = assignedTo(assign);
  const audience = assign.some((a) => a.role === "teacher") ? "teachers" : assign.length ? assignedLine : "nobody yet";
  const nextVersion = (versions[0]?.version ?? published.version?.version ?? 0) + 1;
  const summary = ops.changeSummary(published.config, config);

  const statusParts = [
    `${OWNER_WORD[config.owner]} dashboard`,
    assign.length ? `assigned to ${assignedLine}` : "not assigned",
    published.version ? (dirty ? `draft: ${audience} still see version ${published.version.version}` : `${audience === "nobody yet" ? "live" : audience} see${audience === "nobody yet" ? "s" : ""} version ${published.version.version}`) : "draft, not published yet",
  ];
  if (planned.planned) statusParts.push(`${planned.planned} planned view${planned.planned === 1 ? "" : "s"}${planned.ready ? `, ${planned.ready} ready to swap in` : ""}`);
  const saveLine = !available
    ? "Saving needs the database update"
    : save.state === "saving"
      ? "Draft · saving…"
      : save.state === "error"
        ? "Draft · not saved"
        : save.state === "saved"
          ? "Draft · autosaved"
          : dirty
            ? "Draft"
            : "No changes";

  // The linked-dashboard switcher: the group's dashboards in order.
  const siblings = config.group ? groupOf(config).filter((d) => d.group?.id === config.group!.id) : [];
  const switcher = siblings.length > 1 ? siblings : [config];

  // ----------------------------------------------------------------- handlers

  const panelCtx = useCallback(
    (target: ops.Target): PickPanelContext => {
      const existing = ops.panelAt(config, target);
      if (existing) return contextFromPanel(config, existing.id, labels);
      const t = target as { row: string; column: string };
      const tmp = { ...config, panels: [...config.panels, { id: `${config.id}.${t.column}.${t.row}`, row: t.row, column: t.column, dataviews: [] }] };
      return contextFromPanel(tmp, `${config.id}.${t.column}.${t.row}`, labels);
    },
    [config, labels],
  );

  const panelAction = (panelId: string, a: PanelAction, instanceId: string | null) => {
    if (a === "rename") return setDialog({ kind: "rename-panel", panelId });
    if (a === "override") return setDialog({ kind: "override", panelId, ctx: contextFromPanel(config, panelId, labels) });
    if (a === "move-panel") return setDialog({ kind: "slot", mode: "move-panel", panelId, instanceId });
    if (a === "delete-panel") return apply((c) => ops.deletePanel(c, panelId));
    if (!instanceId) return;
    const inst = config.panels.find((p) => p.id === panelId)?.dataviews.find((v) => v.id === instanceId);
    if (!inst) return;
    if (a === "edit-view" || a === "swap-view") return setDialog({ kind: "replace", mode: a === "edit-view" ? "edit" : "swap", instance: inst, ctx: contextFromPanel(config, panelId, labels) });
    if (a === "remove-view") return apply((c) => ops.removeView(c, instanceId));
    if (a === "make-default") return apply((c) => ops.setDefaultView(c, panelId, instanceId, stateOfPanel(panelId)));
    if (a === "view-up" || a === "view-down") return apply((c) => ops.moveViewWithinPanel(c, instanceId, a === "view-up" ? -1 : 1));
    if (a === "move-view") return setDialog({ kind: "slot", mode: "move-view", panelId, instanceId });
    if (a === "copy-view") return setDialog({ kind: "slot", mode: "copy-view", panelId, instanceId });
    if (a === "copy-view-out") {
      if (onCopyView && inst.kind === "view") return onCopyView({ config, panelId, instance: inst });
      return setDialog({ kind: "slot", mode: "copy-view", panelId, instanceId });
    }
  };

  // Replace an instance in place and keep it selected in its rail.
  const replaceWith = (instanceId: string, instance: DataviewInstance, override?: PanelOverride) => {
    setHistory((h) => {
      try {
        const r = ops.replaceView(h.present, instanceId, instance, override);
        setSelected((s) => ({ ...s, [r.panelId]: r.instanceId }));
        return ops.record(h, r.config);
      } catch (e) {
        if (e instanceof ops.EditorError) setToast(e.message);
        return h;
      }
    });
    setDialog(null);
  };

  const handlers: CanvasHandlers = {
    editColumn: (columnId) => {
      const col = config.columns.find((c) => c.id === columnId)!;
      setDialog({ kind: "column", columnId, ctx: contextFromColumn(col, { dashboard: config.name, labels }) });
    },
    renameColumn: (columnId, title) => apply((c) => ops.applyColumnChange(c, columnId, { title })),
    rowSettings: (rowId) => setDialog({ kind: "row", rowId }),
    copyRow: (rowId) => apply((c) => ops.copyRow(c, rowId)),
    moveRow: (rowId, dir) => apply((c) => ops.moveRow(c, rowId, dir)),
    deleteRow: (rowId) => apply((c) => ops.deleteRow(c, rowId)),
    addView: (target) => setDialog({ kind: "add", target, ctx: panelCtx(target) }),
    panelAction,
    reorder: (panelId, from, to) => apply((c) => ops.reorderView(c, panelId, from, to)),
    swapIn: (instanceId: string, dv: Dataview) => apply((c) => ops.swapInPlaceholder(c, instanceId, dv.id)),
    span: (panelId, cols) => {
      const options = ops.spanQuestion(config, panelId, cols, labels);
      if (options) setDialog({ kind: "span", panelId, cols, options });
      else apply((c) => ops.setSpan(c, panelId, cols, undefined, labels));
    },
    addRow: (structure) => apply((c) => ops.addRow(c, { structure })),
  };

  // A column's new settings from Steps 1-2: only the fields that really changed, so a
  // column following the Results pill keeps following it.
  const columnPatch = (columnId: string, before: PickPanelContext, after: PickPanelContext): ops.ColumnPatch => {
    const a = settingsOf(before);
    const b = settingsOf(after);
    const patch: ops.ColumnPatch = {};
    if (JSON.stringify(a.data) !== JSON.stringify(b.data)) patch.data = b.data;
    if (JSON.stringify(a.focus) !== JSON.stringify(b.focus)) patch.focus = b.focus;
    if (JSON.stringify(a.compare) !== JSON.stringify(b.compare)) patch.compare = b.compare;
    void columnId;
    return patch;
  };

  const onSettings = (v: SettingsValue) => {
    apply((c) => {
      let n = ops.updateSettings(c, { colour: v.colour, accordion: v.accordion, group: v.group ?? undefined, ...(v.icon ? { icon: v.icon } : {}) });
      while (n.columns.length < v.columns) {
        const last = n.columns[n.columns.length - 1];
        n = ops.addColumn(n, { title: `Column ${n.columns.length + 1}`, icon: last.icon, data: last.data, focus: last.focus, compare: last.compare });
      }
      while (n.columns.length > v.columns) n = ops.removeColumn(n, n.columns[n.columns.length - 1].id);
      return n;
    });
    setDialog(null);
  };

  const doPublish = async (label: string) => {
    setBusy(true);
    setDialogError(null);
    try {
      const id = await publish(supabase, row.id, config, label || undefined, summary);
      unsaved.current = null;
      if (config.name !== row.name) {
        await updateDashboardRow(supabase, row.id, { name: config.name });
        setRow({ ...row, name: config.name });
      }
      const list = await listVersions(supabase, row.id);
      setVersions(list);
      const v = list.find((x) => x.id === id) ?? null;
      setPublished({ version: v, config: v?.config ?? config });
      setSave({ state: "idle", at: null });
      setDialog(null);
      setToast(`Published as version ${v?.version ?? nextVersion}.`);
    } catch (e) {
      setDialogError((e as { message?: string })?.message ?? "That didn't publish.");
    } finally {
      setBusy(false);
    }
  };

  const doSaveAs = async (name: string, owner: "vicdata" | "user") => {
    setBusy(true);
    setDialogError(null);
    try {
      if (!available) throw new Error("Saving needs the database update.");
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id ?? null;
      const tempId = `${owner}.${Date.now().toString(36)}`;
      const copy = ops.copyAsNew(config, tempId, name, owner);
      const created = await createDashboard(supabase, { kind: "dashboard", owner_scope: owner, name: copy.name, owner_profile_id: owner === "user" ? uid : null, config: copy }, { asSelf: writeAsSelf });
      router.push(`/dashboards/${created.id}/edit`);
    } catch (e) {
      setDialogError(friendlyCreateError(e));
    } finally {
      setBusy(false);
    }
  };

  const openExport = async () => {
    setDialog({ kind: "export", markdown: null, note: null });
    let requests = null;
    let note: string | null = null;
    try {
      const r = await loadViewRequests(supabase);
      requests = r.available ? r.rows : null;
      if (!r.available) note = "The view_requests table isn't there yet, so this lists placeholders only.";
    } catch {
      note = "Couldn't read the requests, so this lists placeholders only.";
    }
    setDialog({ kind: "export", markdown: plannedMarkdown(config, requests), note });
  };

  const discard = async () => {
    if (!published.config) return;
    try {
      await discardDraft(supabase, row.id);
    } catch {
      /* the draft row may already be gone */
    }
    setHistory((h) => ops.record(h, published.config!));
    setPreviewing(null);
  };

  // ----------------------------------------------------------------- render

  const shown = previewing ? previewing.config : config;
  const width = canvasWidth(shown);
  const [vw, setVw] = useState(1280);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const avail = vw - 48 - (historyOpen ? EDITOR.historyWidth + 20 : 0);
  const zoom = historyOpen ? Math.min(1, avail / width) : 1;

  return (
    <main
      id="teacher-root"
      data-theme={theme}
      style={{ ...accentVars(hex), padding: EDITOR.pagePad, gap: EDITOR.bandGap, fontFamily: "inherit" }}
      className="flex min-h-dvh w-full flex-col bg-[var(--bg)] leading-[1.2] text-[var(--fg)]"
    >
      {top}
      <style>{`.ed-rail svg{width:${EDITOR.railGlyph}px;height:${EDITOR.railGlyph}px;display:block}.ed-preview-glyph svg{width:20px;height:20px;display:block}${RAIL_MENU_CSS}`}</style>

      {/* Edit bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: EC.barBg, border: `1px solid ${EC.barBorder}`, borderRadius: 12, padding: "9px 12px", minWidth: Math.min(width, 1232) }}>
        <button
          type="button"
          aria-label={barOpen ? "Collapse editor bar" : "Expand editor bar"}
          aria-expanded={barOpen}
          onClick={() => setBarOpen(!barOpen)}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "1px solid transparent", background: "transparent", color: EC.amber, padding: 0, cursor: "pointer" }}
        >
          {barOpen ? <ChevronUp /> : <ChevronDown size={14} />}
        </button>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", color: EC.amberInk, background: EC.amber, borderRadius: 999, padding: "3px 9px" }}>EDITING</span>
        {renaming ? (
          <input
            aria-label="Dashboard name"
            autoFocus
            defaultValue={config.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== config.name) apply((c) => ops.updateSettings(c, { name: v }), "name");
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", background: "var(--panel-bg)", border: `1px solid ${EC.barBorder}`, borderRadius: 6, padding: "2px 6px", fontFamily: "inherit" }}
          />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{config.name}</span>
        )}
        {barOpen && (
          <>
            <span title={saveLine} style={{ fontSize: 12, color: "var(--muted2)", minWidth: 0, flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {statusParts.join(" · ")}
              {!available || save.state === "error" ? <span style={{ color: EC.danger }}> · {saveLine}</span> : save.state === "saving" ? " · saving…" : null}
            </span>
            {planned.planned > 0 && <EBtn onClick={openExport}>Export planned views</EBtn>}
            <EBtn disabled={!ops.canUndo(history)} onClick={() => setHistory(ops.undo)} title="Undo (⌘Z); redo with ⇧⌘Z">
              Undo
            </EBtn>
            <EBtn on={historyOpen} onClick={() => { setHistoryOpen(!historyOpen); setPreviewing(null); }}>
              History
            </EBtn>
            <EBtn onClick={() => setDialog({ kind: "settings" })}>Settings</EBtn>
            <EBtn onClick={() => setRenaming(true)}>Rename</EBtn>
            <EBtn onClick={() => setDialog({ kind: "assign" })}>Assign</EBtn>
            <EBtn onClick={() => { setDialogError(null); setDialog({ kind: "save-as" }); }}>Save as</EBtn>
            <EBtn primary onClick={() => { setDialogError(null); setDialog({ kind: "publish" }); }}>
              Publish
            </EBtn>
            {onExit ? (
              <EBtn onClick={onExit}>Exit</EBtn>
            ) : (
              <Link href={`/dashboards/${row.slug ?? row.id}`} style={{ textDecoration: "none" }}>
                <EBtn>Exit</EBtn>
              </Link>
            )}
          </>
        )}
      </div>

      {/* Linked-dashboard switcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 14, padding: "10px 16px", width: Math.max(width, 0), boxSizing: "border-box", maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(var(--accent-rgb),0.14)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17 }}>
            {(config.group?.label ?? config.name).charAt(0).toUpperCase()}
          </span>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {config.group?.label ?? config.name} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted2)" }}>&mdash; {OWNER_WORD[config.owner]}</span>
          </div>
          {switcher.length > 1 && (
            <nav aria-label="Linked dashboards" style={{ display: "inline-flex", border: "1px solid var(--panel-border2)", borderRadius: 999, padding: 3, background: "var(--panel-bg)", gap: 2 }}>
              {switcher.map((d) => {
                const on = d.id === config.id || d.id === row.slug;
                const label = d.name.replace(new RegExp(`^${config.group?.label ?? ""}\\s*`), "") || d.name;
                return on ? (
                  <span key={d.id} aria-current="page" style={{ borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 700, background: "var(--accent)", color: "color-mix(in srgb, var(--accent) 12%, #000)" }}>
                    {label}
                  </span>
                ) : (
                  <Link
                    key={d.id}
                    href={`/dashboards/${d.id}/edit`}
                    onClick={onSwitch ? (e) => { e.preventDefault(); onSwitch(d.id); } : undefined}
                    style={{ borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 700, color: "var(--muted2)", textDecoration: "none" }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        {(config.features?.subjectChips || axes.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {axes.length > 0 && (
              <div data-editor-pill="" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* 0.6 snag 3 / 03: the page's own Results pill, for the editor's rails. */}
                {resultsPill && (
                <PillMenu label="Results" value={pillLabels[pill]} menuLabel="Switch measure" width={236} align="right">
                  {(close) => (
                    <>
                      <MenuHeading>Switch measure</MenuHeading>
                      {pillMeasures.map((m) => (
                        <MenuRow key={m.id} label={m.label} selected={m.id === pill} onClick={() => { setPill(m.id as ResultsMeasure); close(); }} />
                      ))}
                    </>
                  )}
                </PillMenu>
                )}
                {/* 0.6 snag 4 / 02: Context's own Compare against pill -- the page's words. */}
                {axes.includes("compareAgainst") && (
                  <span data-editor-axis="compareAgainst" style={{ display: "contents" }}>
                    <PillMenu label="Compare against" value={againstLabels[against]} width={320} align="right" title={`Compare against: ${againstLabels[against]}`}>
                      {(close) => (
                        <>
                          <MenuHeading>Compare against</MenuHeading>
                          {(["category", "whole", "selected"] as const).map((id) => (
                            <MenuRow key={id} label={againstLabels[id]} selected={id === against} onClick={() => { setAgainst(id); close(); }} />
                          ))}
                        </>
                      )}
                    </PillMenu>
                  </span>
                )}
                <SwitchButton on={showAll} onChange={setShowAll} className="text-[12px] font-semibold text-[var(--muted2)] hover:text-[var(--fg)]">
                  Show all views
                </SwitchButton>
              </div>
            )}
            {config.features?.subjectChips && (
              <span style={{ border: "1px dashed var(--panel-border2)", color: "var(--muted2)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600 }}>Subject chips: the viewer&apos;s own subjects</span>
            )}
          </div>
        )}
      </div>

      {/* Canvas (+ History) */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ zoom, opacity: historyOpen && !previewing ? 0.55 : 1 }}>
            <EditorVariantsContext.Provider value={variantsCtx}>
            <EditorCanvas
              config={shown}
              readOnly={!!previewing || historyOpen}
              Preview={Preview}
              labels={labels}
              selected={selected}
              onSelect={(p, i) => setSelected({ ...selected, [p]: i })}
              ready={previewing ? {} : ready}
              handlers={previewing || historyOpen ? undefined : handlers}
            />
            </EditorVariantsContext.Provider>
          </div>
          {previewing && <div style={{ fontSize: 12, color: "var(--muted2)" }}>Previewing version {previewing.version}, read-only.</div>}
        </div>
        {historyOpen && (
          <HistoryPanel
            draft={config}
            dirty={dirty}
            savedLine={save.state === "saved" ? "autosaved just now" : available ? "not saved yet" : "in this tab only"}
            versions={versions}
            publishedId={row.published_version_id ?? published.version?.id ?? null}
            available={available}
            previewing={previewing?.id ?? null}
            onPreview={setPreviewing}
            onRestore={(v) => {
              setHistory((h) => ops.record(h, v.config));
              setPreviewing(null);
              setToast(`Restored version ${v.version} as the draft. Undo puts it back.`);
            }}
            onPublish={() => { setDialogError(null); setDialog({ kind: "publish" }); }}
            onDiscard={discard}
            onClose={() => { setHistoryOpen(false); setPreviewing(null); }}
          />
        )}
      </div>

      {toast && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "var(--fg)", color: "var(--bg)", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, zIndex: 1600, boxShadow: "0 10px 24px rgba(0,0,0,0.3)" }}>
          {toast}
          {toastUndo && (
            <button
              type="button"
              onClick={() => { setHistory(ops.undo); setToast(null); }}
              style={{ marginLeft: 12, border: "none", background: "transparent", color: "inherit", textDecoration: "underline", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Dialogs */}
      {dialog?.kind === "add" && (
        <AddViewChooser
          open
          theme={theme}
          context={dialog.ctx}
          superAdmin={superAdmin}
          school={school}
          subjects={subjects}
          onClose={() => setDialog(null)}
          onAdd={(added: DataviewInstance, override?: PanelOverride) => {
            const target = dialog.target;
            // 0.6 snag 3 / 03: added under a pill, the view shows on that measure only.
            const instance = pillOn ? tagForPill(added, pillOn) : added;
            if (pillOn && !showsOn(instance, pillOn)) setToast(`${instance.kind === "view" ? (dataviewById(instance.dataview)?.label ?? instance.dataview) : "That view"} isn't drawn on ${pillLabels[pillOn]}; it shows on the other measures.`);
            setHistory((h) => {
              try {
                const r = ops.addView(h.present, target, instance, override);
                setSelected((s) => ({ ...s, [r.panelId]: r.instanceId }));
                return ops.record(h, r.config);
              } catch (e) {
                if (e instanceof ops.EditorError) setToast(e.message);
                return h;
              }
            });
            setDialog(null);
          }}
          onPlaceholder={(p: PlaceholderRequest) => {
            const target = dialog.target;
            apply((c) => ops.addPlaceholder(c, target, p).config);
            setDialog(null);
          }}
          persistAsk={false}
        />
      )}
      {dialog?.kind === "replace" && (
        <AddViewChooser
          open
          theme={theme}
          context={dialog.ctx}
          superAdmin={superAdmin}
          school={school}
          subjects={subjects}
          startAt={dialog.mode === "swap" ? "pick" : dialog.instance.kind === "placeholder" ? "placeholder" : "customise"}
          editing={dialog.mode === "edit" ? dialog.instance : undefined}
          addLabel={dialog.mode === "swap" ? "Swap in" : "Save view"}
          onClose={() => setDialog(null)}
          onAdd={(instance: DataviewInstance, override?: PanelOverride) => replaceWith(dialog.instance.id, instance, override)}
          onPlaceholder={(p: PlaceholderRequest) => {
            const old = dialog.instance;
            // Editing a placeholder changes its words and shape; its saved context stays.
            const next = ops.placeholderInstance(p);
            replaceWith(old.id, old.kind === "placeholder" && dialog.mode === "edit" && next.kind === "placeholder" ? { ...next, context: old.context } : next);
          }}
          persistAsk={false}
        />
      )}
      {dialog?.kind === "row" && (
        <RowSettingsDialog
          config={config}
          rowId={dialog.rowId}
          onClose={() => setDialog(null)}
          onDelete={() => {
            apply((c) => ops.deleteRow(c, dialog.rowId));
            setDialog(null);
          }}
          onDone={(v) => {
            apply((c) => {
              let n = ops.updateRow(c, dialog.rowId, { name: v.name, time: v.time, openByDefault: v.openByDefault });
              if (v.structure.join(":") !== ops.structureOf(c, dialog.rowId).join(":")) n = ops.setRowStructure(n, dialog.rowId, v.structure);
              return n;
            });
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "column" && (
        <ContextStepsDialog
          original={dialog.ctx}
          superAdmin={superAdmin}
          theme={theme}
          onClose={() => setDialog(null)}
          onDone={(ctx) => {
            const patch = columnPatch(dialog.columnId, dialog.ctx, ctx);
            if (!Object.keys(patch).length) return setDialog(null);
            const impact = ops.columnChangeImpact(config, dialog.columnId, patch, labels);
            if (impact.misfits.length || impact.placeholders.length) setDialog({ kind: "column-change", columnId: dialog.columnId, patch, impact });
            else {
              apply((c) => ops.applyColumnChange(c, dialog.columnId, patch, {}, labels));
              setDialog(null);
            }
          }}
        />
      )}
      {dialog?.kind === "column-change" && (
        <ColumnChangeDialog
          config={config}
          columnId={dialog.columnId}
          patch={dialog.patch}
          impact={dialog.impact}
          onClose={() => setDialog(null)}
          onConfirm={(choices) => {
            apply((c) => ops.applyColumnChange(c, dialog.columnId, dialog.patch, choices, labels));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "override" && (
        <ContextStepsDialog
          original={dialog.ctx}
          superAdmin={superAdmin}
          theme={theme}
          onClose={() => setDialog(null)}
          onDone={(ctx) => {
            apply((c) => ops.setOverride(c, dialog.panelId, ops.overrideTo(c, dialog.panelId, ctx, labels)));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "span" && (
        <SpanAskDialog
          options={dialog.options}
          onClose={() => setDialog(null)}
          onPick={(follow) => {
            apply((c) => ops.setSpan(c, dialog.panelId, dialog.cols, follow, labels));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "rename-panel" && (
        <TextDialog
          label="Rename panel"
          title="Rename panel"
          sub={config.panels.find((p) => p.id === dialog.panelId)?.name ?? config.rows.find((r) => r.id === config.panels.find((p) => p.id === dialog.panelId)?.row)?.name}
          initial={config.panels.find((p) => p.id === dialog.panelId)?.name ?? ""}
          action="Rename"
          onClose={() => setDialog(null)}
          onDone={(v) => {
            apply((c) => ops.renamePanel(c, dialog.panelId, v));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "slot" && (
        <SlotMapDialog
          config={config}
          from={dialog.panelId}
          mode={dialog.mode === "move-panel" ? "panel" : "view"}
          allowGaps
          title={dialog.mode === "move-panel" ? "Move panel" : dialog.mode === "move-view" ? "Move this view to another panel" : "Copy this view"}
          sub={dialog.mode === "copy-view" && !onCopyView ? "Copying to another dashboard comes with Copy this view; for now, a panel here." : config.name}
          onClose={() => setDialog(null)}
          onPick={(t) => {
            const { panelId, instanceId, mode } = dialog;
            if (mode === "move-panel") {
              const dest = typeof t === "string" ? config.panels.find((p) => p.id === t)! : null;
              apply((c) => ops.movePanel(c, panelId, dest ? dest.row : (t as { row: string }).row, dest ? dest.column : (t as { column: string }).column));
            } else if (instanceId) apply((c) => (mode === "move-view" ? ops.moveView(c, instanceId, t) : ops.copyView(c, instanceId, t)).config);
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "settings" && (
        <SettingsDialog
          config={config}
          groups={[...new Map(DASHBOARDS.filter((d) => d.group).map((d) => [d.group!.id, { id: d.group!.id, label: d.group!.label }])).values()]}
          superAdmin={superAdmin}
          onClose={() => setDialog(null)}
          onDone={onSettings}
        />
      )}
      {dialog?.kind === "assign" && (
        <AssignDialog
          supabase={supabase}
          row={{ ...row, owner_scope: config.owner }}
          name={config.name}
          initial={assign}
          available={available}
          onClose={() => setDialog(null)}
          onSave={async (next) => {
            if (available) await setAssignments(supabase, row.id, next);
            setAssign(next);
          }}
        />
      )}
      {dialog?.kind === "publish" && (
        <PublishDialog
          nextVersion={nextVersion}
          summary={summary.replace(/\*([^*]+)\*/g, "$1")}
          audience={assign.length ? `${assignedLine[0].toUpperCase()}${assignedLine.slice(1)} see it straight away.` : "Not assigned yet: only editors see it."}
          empty={empty.length}
          available={available}
          busy={busy}
          error={dialogError}
          onClose={() => setDialog(null)}
          onPublish={doPublish}
        />
      )}
      {dialog?.kind === "save-as" && <SaveAsDialog initial={`${config.name} (copy)`} superAdmin={superAdmin} busy={busy} error={dialogError} onClose={() => setDialog(null)} onSave={doSaveAs} />}
      {dialog?.kind === "export" && (
        <ExportDialog markdown={dialog.markdown} note={dialog.note} filename={`planned-views-${(row.slug ?? row.id).replace(/[^a-z0-9.-]+/gi, "-")}.md`} onClose={() => setDialog(null)} />
      )}
    </main>
  );
}

export function friendlyCreateError(e: unknown): string {
  const m = (e as { message?: string } | null)?.message ?? "";
  const cap = /personal (dashboard|meeting) limit reached \((\d+)\)/i.exec(m);
  if (cap) return `You already have ${cap[2]} personal dashboards, the most your account allows. Delete one, or ask a School-Admin to share one with you.`;
  if (/does not exist|schema cache|database update/i.test(m)) return "Saving needs the database update.";
  if (/row-level security|not allowed|permission/i.test(m)) return "You can't create that kind of dashboard.";
  return m || "That didn't save. Check your connection and try again.";
}
