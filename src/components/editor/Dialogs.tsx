"use client";

// VicData 0.6 S5: the editor's dialogs, each as its board (docs/wireframes/v0.6):
// RowSettings, ColumnChange, SpanAsk -- plus the small ones the boards don't draw (rename
// panel, the slot map for Move view / Move panel, Publish, Save as, Export planned
// views), built from the same Dialog shell and primitives.
import { useMemo, useState } from "react";
import { dataviewById } from "@/catalogue";
import { DATA_LABEL, measureLabel } from "@/catalogue/pick";
import type { DashboardConfig, RowTime } from "@/catalogue/types";
import { PrimaryButton, SecondaryButton, DangerGhostButton, AlertIcon } from "@/components/teacher/chooser/ui";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { ChooserStyles } from "@/components/teacher/chooser/ui";
import { CHOOSER_FONT } from "@/components/teacher/chooser/ui";
import {
  panelsLostBy,
  rowCells,
  structureOf,
  structuresFor,
  type ColumnImpact,
  type ColumnPatch,
  type MisfitChoice,
  type SpanOption,
  type Structure,
  type Target,
} from "@/lib/editor-ops";
import { EC } from "@/lib/editor-layout";
import { DLabel, Dialog, ErrorLine, Note, Opt, Segmented, StructIcon, SwitchRow, inputStyle } from "./bits";

// ------------------------------------------------------------------- RowSettings

export type RowSettingsValue = { name: string; time: RowTime; openByDefault: boolean; structure: Structure };

export function RowSettingsDialog({ config, rowId, onDone, onDelete, onClose }: { config: DashboardConfig; rowId: string; onDone: (v: RowSettingsValue) => void; onDelete: () => void; onClose: () => void }) {
  const row = config.rows.find((r) => r.id === rowId)!;
  const index = config.rows.findIndex((r) => r.id === rowId);
  const [name, setName] = useState(row.name);
  const [time, setTime] = useState<RowTime>(row.time);
  const [open, setOpen] = useState(row.openByDefault);
  const [structure, setStructure] = useState<Structure>(structureOf(config, rowId));
  const n = config.columns.length;
  const lost = panelsLostBy(config, rowId, structure);
  const weights = (s: Structure) => {
    let i = 0;
    return s.map((span) => {
      const w = config.layout.tracks.slice(i, i + span).reduce((a, b) => a + b, 0);
      i += span;
      return w;
    });
  };
  return (
    <Dialog
      label="Row settings"
      title="Row settings"
      sub={`${config.name} · row ${index + 1} of ${config.rows.length}`}
      onClose={onClose}
      footer={
        <>
          <DangerGhostButton onClick={onDelete} disabled={config.rows.length === 1}>
            Delete row
          </DangerGhostButton>
          <PrimaryButton disabled={!name.trim()} onClick={() => onDone({ name: name.trim(), time, openByDefault: open, structure })}>
            Done
          </PrimaryButton>
        </>
      }
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0 0 auto" }}>
        <DLabel>Name</DLabel>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
      </label>

      <DLabel top={4}>Time &mdash; what views in this row show</DLabel>
      <div role="radiogroup" aria-label="Time" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Opt on={time === "latest"} title="Latest year" sub="Like the Current row" onClick={() => setTime("latest")} />
        <Opt on={time === "over_time"} title="Over time" sub="Like the Trends row: needs 4+ years for a trend line" onClick={() => setTime("over_time")} />
        <Opt on={time === "either"} title="Either" sub={<>&ldquo;Add a view&rdquo; offers both, grouped</>} onClick={() => setTime("either")} />
      </div>

      <DLabel top={4}>Panels in this row</DLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "0 0 auto" }}>
        {structuresFor(n).map((s) => (
          <StructIcon key={s.join(":")} light weights={weights(s)} on={s.join(":") === structure.join(":")} label={`${s.length} panel${s.length === 1 ? "" : "s"}`} onClick={() => setStructure(s)} />
        ))}
      </div>
      <Note>
        Options match this dashboard&apos;s {n} column{n === 1 ? "" : "s"}. Spans are whole panels.
        {lost > 0 && <> {lost} panel{lost === 1 ? "" : "s"} with views will be removed.</>}
      </Note>

      <div style={{ marginTop: 4, flex: "0 0 auto" }}>
        <SwitchRow on={open} onChange={setOpen} title="Open when the dashboard loads" />
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------- ColumnChange

export function ColumnChangeDialog({
  config,
  columnId,
  patch,
  impact,
  onConfirm,
  onClose,
}: {
  config: DashboardConfig;
  columnId: string;
  patch: ColumnPatch;
  impact: ColumnImpact;
  onConfirm: (choices: Record<string, MisfitChoice>) => void;
  onClose: () => void;
}) {
  const col = config.columns.find((c) => c.id === columnId)!;
  const [choices, setChoices] = useState<Record<string, MisfitChoice>>(() => Object.fromEntries(impact.misfits.map((m) => [m.instanceId, "keep" as MisfitChoice])));
  const oldData = col.data.data === "academic.results" && col.data.results && col.data.results !== "pill" ? measureLabel({ ...col.data, results: col.data.results }) : DATA_LABEL[col.data.data];
  const nd = patch.data ?? col.data;
  const newData = nd.data === "academic.results" && nd.results && nd.results !== "pill" ? measureLabel({ ...nd, results: nd.results }) : DATA_LABEL[nd.data];
  const dataChanged = oldData !== newData;
  const target = dataChanged ? newData : "the new settings";
  const n = impact.misfits.length;
  // "Keep" belongs to the panel: choosing it for one view keeps its panel's other views too.
  const set = (instanceId: string, c: MisfitChoice) => {
    const panelId = impact.misfits.find((m) => m.instanceId === instanceId)!.panelId;
    const next = { ...choices, [instanceId]: c };
    for (const m of impact.misfits) {
      if (m.panelId !== panelId || m.instanceId === instanceId) continue;
      if (c === "keep") next[m.instanceId] = "keep";
      // Leaving "keep" releases the panel: its other kept views follow this choice.
      else if (choices[instanceId] === "keep" && next[m.instanceId] === "keep") next[m.instanceId] = c === "swap" && !m.nearest ? "remove" : c;
    }
    setChoices(next);
  };
  return (
    <Dialog
      label="Change column data"
      title="Change column data?"
      sub={<>&ldquo;{col.title}&rdquo;: {dataChanged ? <>{oldData} &rarr; {newData}</> : "focus or comparison changed"}</>}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => onConfirm(choices)}>Change column</PrimaryButton>
        </>
      }
    >
      {n > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--cc-banner-bg)", border: "1px solid var(--cc-banner-border)", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "var(--cc-banner-fg)", lineHeight: 1.4, flex: "0 0 auto" }}>
          <span style={{ flex: "0 0 auto", marginTop: 1 }}>
            <AlertIcon size={14} />
          </span>
          <div>
            {n} view{n === 1 ? "" : "s"} in this column {n === 1 ? "doesn't" : "don't"} fit {target}. Choose what happens to each.
          </div>
        </div>
      )}
      {impact.misfits.map((m) => {
        const c = choices[m.instanceId];
        const nearest = m.nearest ? dataviewById(m.nearest) : undefined;
        return (
          <div key={m.instanceId} style={{ border: "1px solid var(--cc-border)", borderRadius: 10, padding: "11px 12px", background: "var(--cc-panel)", display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cc-ink)" }}>{m.title}</div>
              <div style={{ fontSize: 11, color: "var(--cc-sub)" }}>{m.where}</div>
            </div>
            <Segmented
              label={`What happens to ${m.title}`}
              value={c}
              onChange={(v) => set(m.instanceId, v)}
              options={[
                { id: "keep", label: "Keep as override" },
                { id: "remove", label: "Remove" },
                { id: "swap", label: "Swap", disabled: !nearest },
              ]}
            />
            {c === "keep" && <div style={{ fontSize: 11, color: "var(--cc-sub)" }}>Keeps showing {oldData.toLowerCase()}, marked &ldquo;overridden&rdquo;.</div>}
            {c === "remove" && <div style={{ fontSize: 11, color: "var(--cc-sub)" }}>Taken out of this panel.</div>}
            {c === "swap" && nearest && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid color-mix(in srgb, var(--cc-blue) 50%, transparent)", background: "var(--cc-blue-tint)", borderRadius: 8, padding: "7px 9px", fontSize: 12, color: "var(--cc-blue)" }}>
                  <span style={{ fontWeight: 700 }}>&rarr;</span> {nearest.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--cc-sub)" }}>Nearest equivalent: same look, years and number type.</div>
              </>
            )}
          </div>
        );
      })}
      <DLabel top={6}>Already fine</DLabel>
      <div style={{ fontSize: 12.5, color: "var(--cc-ink)", lineHeight: 1.5 }}>
        {impact.placeholders.length
          ? `${impact.placeholders.length} placeholder${impact.placeholders.length === 1 ? "" : "s"} will update ${impact.placeholders.length === 1 ? "its" : "their"} planned data to ${dataChanged ? newData : "the new settings"}.`
          : n
            ? "Every other view in this column fits."
            : "Every view in this column fits."}
      </div>
      <Note>Panels with their own overrides aren&apos;t touched.{impact.skipped.length ? ` (${impact.skipped.length} here.)` : ""}</Note>
    </Dialog>
  );
}

// ------------------------------------------------------------------- SpanAsk

export function SpanAskDialog({ options, onPick, onClose }: { options: SpanOption[]; onPick: (columnId: string) => void; onClose: () => void }) {
  const [pick, setPick] = useState(options[0].columnId);
  const chosen = options.find((o) => o.columnId === pick)!;
  return (
    <TeacherModal label="Which column should this panel follow?" backdropLabel="Cancel" size="chooser" onClose={onClose}>
      {/* SpanAsk.dc.html: a short card 150px down the 760px board, not a full sheet. */}
      <div className="cc-root" style={{ marginTop: 138, background: "var(--cc-panel)", borderRadius: 14, boxShadow: "var(--cc-shadow)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: CHOOSER_FONT, color: "var(--cc-ink)" }}>
        <ChooserStyles />
        <div style={{ padding: "16px 18px 6px" }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>This panel spans {options.length} columns</div>
          <div style={{ fontSize: 12.5, color: "var(--cc-sub)", marginTop: 4, lineHeight: 1.45 }}>They&apos;re set up differently. Which one should it follow?</div>
        </div>
        <div role="radiogroup" aria-label="Follow which column" style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((o) => (
            <Opt
              key={o.columnId}
              align="flex-start"
              pad="12px 14px"
              on={o.columnId === pick}
              onClick={() => setPick(o.columnId)}
              title={
                <>
                  {o.title}
                  {o.leftMost && <span style={{ fontSize: 11, color: "var(--cc-blue)", fontWeight: 600 }}> &middot; left-most</span>}
                </>
              }
              sub={o.line}
            />
          ))}
          <Note>Asked once. If the columns match, nothing is asked. You can override the panel later.</Note>
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--cc-line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => onPick(pick)}>Use {chosen.title}</PrimaryButton>
        </div>
      </div>
    </TeacherModal>
  );
}

// ------------------------------------------------------------------- Rename

export function TextDialog({ label, title, sub, initial, action, onDone, onClose }: { label: string; title: string; sub?: string; initial: string; action: string; onDone: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <Dialog
      label={label}
      title={title}
      sub={sub}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => onDone(v)}>{action}</PrimaryButton>
        </>
      }
    >
      <input type="text" value={v} autoFocus onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onDone(v)} style={inputStyle} />
      <Note>Leave it empty to use the row&apos;s name.</Note>
    </Dialog>
  );
}

// ------------------------------------------------------------------- Slot map (move / copy)

// Pick a panel or an empty cell on this dashboard: rows as bands, cells as boxes at their
// spans (a slot map, as CopyTo draws one).
export function SlotMapDialog({
  config,
  title,
  sub,
  from,
  allowGaps,
  mode,
  onPick,
  onClose,
}: {
  config: DashboardConfig;
  title: string;
  sub: string;
  from: string;
  // Move panel: empty cells and same-span panels; Move/Copy view: any panel or empty cell.
  allowGaps: boolean;
  mode: "view" | "panel";
  onPick: (t: Target) => void;
  onClose: () => void;
}) {
  const [pick, setPick] = useState<Target | null>(null);
  const fromPanel = config.panels.find((p) => p.id === from);
  const fromSpan = fromPanel?.span?.cols ?? 1;
  const key = (t: Target) => (typeof t === "string" ? t : `${t.row}:${t.column}`);
  const rows = useMemo(() => config.rows.map((r) => ({ row: r, cells: rowCells(config, r.id) })), [config]);
  return (
    <Dialog
      label={title}
      title={title}
      sub={sub}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!pick} onClick={() => pick && onPick(pick)}>
            {mode === "panel" ? "Move here" : title.startsWith("Copy") ? "Copy here" : "Move here"}
          </PrimaryButton>
        </>
      }
    >
      {rows.map(({ row, cells }) => (
        <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0 0 auto" }}>
          <DLabel>{row.name}</DLabel>
          <div style={{ display: "grid", gridTemplateColumns: config.layout.tracks.map((w) => `${w}fr`).join(" "), gap: 6 }}>
            {cells.map((cell) => {
              const t: Target = cell.panel ? cell.panel.id : { row: row.id, column: config.columns[cell.start].id };
              const empty = !cell.panel || !cell.panel.dataviews.length;
              const isFrom = cell.panel?.id === from;
              const okPanel = mode === "panel" ? empty || (cell.span === fromSpan) : true;
              const disabled = isFrom || (!allowGaps && empty) || !okPanel;
              const on = pick !== null && key(pick) === key(t);
              const first = cell.panel?.dataviews[0];
              const label = empty ? "Empty" : (cell.panel!.name ?? (first?.kind === "view" ? (first.title ?? dataviewById(first.dataview)?.label ?? "") : first?.description ?? ""));
              return (
                <button
                  key={cell.start}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => setPick(t)}
                  style={{
                    gridColumn: `${cell.start + 1} / span ${cell.span}`,
                    minHeight: 54,
                    borderRadius: 8,
                    // 0.6.1 S1 (pinch point 4): where it sits now, in the boards' amber.
                    border: `1.5px ${empty ? "dashed" : "solid"} ${on ? "var(--cc-blue)" : isFrom ? EC.amber : "var(--cc-border2)"}`,
                    background: on ? "var(--cc-blue-tint)" : isFrom ? `color-mix(in srgb, ${EC.amber} 12%, var(--cc-panel))` : "var(--cc-panel)",
                    color: "var(--cc-ink)",
                    padding: "6px 8px",
                    textAlign: "left",
                    fontSize: 11.5,
                    lineHeight: 1.3,
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled && !isFrom ? 0.45 : 1,
                  }}
                >
                  <span style={{ display: "block", fontSize: 10, color: "var(--cc-sub)", fontWeight: 700 }}>{config.columns[cell.start].title}</span>
                  {isFrom ? <span data-slot-here style={{ color: EC.amberText, fontWeight: 700 }}>Here now</span> : label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Note>{mode === "panel" ? "Pick an empty cell, or a panel of the same width to swap places with." : "Pick a panel, or an empty cell to start a new one."}</Note>
    </Dialog>
  );
}

// ------------------------------------------------------------------- Publish

export function PublishDialog({
  nextVersion,
  summary,
  audience,
  empty,
  available,
  busy,
  error,
  onPublish,
  onClose,
}: {
  nextVersion: number;
  summary: string;
  audience: string;
  empty: number;
  available: boolean;
  busy: boolean;
  error: string | null;
  onPublish: (label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <Dialog
      label="Publish"
      title={`Publish as version ${nextVersion}`}
      sub={audience}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={busy || empty > 0 || !available} onClick={() => onPublish(label.trim())}>
            {busy ? "Publishing…" : "Publish"}
          </PrimaryButton>
        </>
      }
    >
      <DLabel>What&apos;s changed</DLabel>
      <div style={{ fontSize: 12.5, color: "var(--cc-ink)", lineHeight: 1.5 }}>{summary}</div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, flex: "0 0 auto" }}>
        <DLabel>Label (optional)</DLabel>
        <input type="text" maxLength={80} value={label} placeholder="before Trends pass" onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
      </label>
      <Note>A new version is made and kept; it never overwrites one. Publishing a VicData dashboard is an upgrade for everyone using it: notes and open rows carry over where panels survive; changed panels open at their new default.</Note>
      {empty > 0 && <ErrorLine>{empty} empty panel{empty === 1 ? "" : "s"}: add a view or a placeholder, or delete {empty === 1 ? "it" : "them"}, first.</ErrorLine>}
      {!available && <ErrorLine>Saving needs the database update.</ErrorLine>}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Dialog>
  );
}

// ------------------------------------------------------------------- Save as

export function SaveAsDialog({ initial, superAdmin, busy, error, onSave, onClose }: { initial: string; superAdmin: boolean; busy: boolean; error: string | null; onSave: (name: string, owner: "vicdata" | "user") => void; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const [owner, setOwner] = useState<"vicdata" | "user">(superAdmin ? "vicdata" : "user");
  return (
    <Dialog
      label="Save as"
      title="Save as a new dashboard"
      sub="This one is left as it is."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={busy || !name.trim()} onClick={() => onSave(name.trim(), owner)}>
            {busy ? "Saving…" : "Save as"}
          </PrimaryButton>
        </>
      }
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0 0 auto" }}>
        <DLabel>Name</DLabel>
        <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </label>
      {superAdmin && (
        <>
          <DLabel top={4}>Save to</DLabel>
          <Segmented label="Save to" value={owner} onChange={setOwner} pad="8px 10px" fontSize={12} options={[{ id: "vicdata", label: "VicData dashboards" }, { id: "user", label: "My dashboards" }]} />
        </>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Dialog>
  );
}

// ------------------------------------------------------------------- Export planned views

export function ExportDialog({ markdown, filename, note, onClose }: { markdown: string | null; filename: string; note: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const download = () => {
    if (!markdown) return;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog
      label="Export planned views"
      title="Export planned views"
      sub="Placeholders and Ask for this view requests, in catalogue terms"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton
            disabled={!markdown}
            onClick={async () => {
              if (!markdown) return;
              await navigator.clipboard.writeText(markdown);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </SecondaryButton>
          <PrimaryButton disabled={!markdown} onClick={download}>
            Download .md
          </PrimaryButton>
        </>
      }
    >
      {note && <Note>{note}</Note>}
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11.5, lineHeight: 1.45, color: "var(--cc-ink)", background: "var(--cc-soft)", border: "1px solid var(--cc-border)", borderRadius: 8, padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", flex: "0 0 auto" }}>
        {markdown ?? "Reading requests…"}
      </pre>
    </Dialog>
  );
}
