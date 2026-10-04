"use client";

// 0.6 snagging round 3 / 01: Customise's "Figures" box for a number-tiles view, beside
// Numbers / Years / Look and in the same filter-box pattern. The main figure first (its
// scope line can be relabelled), then the small tiles as a list: each can be shown or
// hidden, relabelled (title placeholders where they apply), moved up or down (or dragged),
// or removed; "+ Add a figure" brings back one the host can build that isn't listed.
//
// Only the figures the host builds for this view on this measure, and that the measure
// declares honest, are listed (src/lib/tile-figures.ts offeredFigures). Others already in
// the saved list (a figure for another Results measure) keep their places, unlisted.
import { useState } from "react";
import { measureFor, type PickPanelContext } from "@/catalogue/pick";
import { MEASURES } from "@/catalogue/measures";
import type { Dataview, NumberType, TileFigureSpec } from "@/catalogue/types";
import { FilterBox, FilterLabel } from "@/components/teacher/chooser/ui";
import { MenuRow, PanelMenu, useDismiss } from "@/components/teacher/PanelMenu";
import {
  TILE_SHARED_TOKENS,
  addTile,
  defaultTileSpec,
  figureDefaultLabel,
  moveTile,
  moveTileTo,
  offeredFigures,
  removeTile,
  setTileHidden,
  setTileLabel,
  tileViewDef,
  type TileFigureDef,
} from "@/lib/tile-figures";
import { Toggle } from "./bits";

// The number types honest here: the column's measure, or (a view on its own measure, as
// Comparisons' ranking tiles) the dataview's own measures for this phase.
function honestTypes(dv: Dataview, ctx: PickPanelContext, ownMeasure: boolean): Set<NumberType> {
  if (!ownMeasure) return new Set(measureFor(ctx)?.numberTypes ?? []);
  return new Set(MEASURES.filter((m) => dv.measures.includes(m.id) && (m.phase === undefined || m.phase === ctx.phase)).flatMap((m) => m.numberTypes));
}

// A template with its [placeholders] drawn as the Title box's chips.
export function TokenText({ template }: { template: string }) {
  const parts = template.split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") ? (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", borderRadius: 6, background: "var(--cc-blue-badge)", color: "var(--cc-blue)", fontSize: 11, fontWeight: 700, padding: "0 5px", lineHeight: 1.5 }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const linkBtn = { fontSize: 11, color: "var(--cc-blue)", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" } as const;
const iconBtn = (disabled: boolean) =>
  ({ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 5, border: "1px solid var(--cc-border2)", background: "var(--cc-panel)", color: disabled ? "var(--cc-faint)" : "var(--cc-label)", opacity: disabled ? 0.45 : 1, cursor: disabled ? "default" : "pointer", padding: 0, fontSize: 10, lineHeight: 1, fontFamily: "inherit" }) as const;

// One scope line: shown as chips; Edit opens an input with "+ Insert placeholder".
function LabelEditor({ label, fallback, tokens, onChange }: { label: string | undefined; fallback: string; tokens: string[]; onChange: (next: string | null) => void }) {
  // The text being typed; saved as it changes (blank or the default = no label set).
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const setEditing = (on: boolean) => setDraft(on ? (label ?? fallback) : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));
  const value = draft ?? label ?? fallback;
  const write = (next: string) => {
    setDraft(next);
    onChange(next === fallback || !next.trim() ? null : next);
  };
  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: label ? "var(--cc-ink)" : "var(--cc-label)", lineHeight: 1.6 }}>
          <TokenText template={value} />
        </span>
        <button type="button" style={linkBtn} onClick={() => setEditing(true)} aria-label={`Edit the label: ${value}`}>
          Edit label
        </button>
        {label && (
          <button type="button" style={{ ...linkBtn, color: "var(--cc-faint)" }} onClick={() => onChange(null)}>
            Reset
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <input
        autoFocus
        type="text"
        value={value}
        aria-label="Label, with placeholders in square brackets"
        onChange={(e) => write(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") setEditing(false);
        }}
        style={{ fontSize: 12, color: "var(--cc-ink)", lineHeight: 1.6, border: "1px solid var(--cc-blue)", borderRadius: 7, padding: "4px 8px", background: "var(--cc-panel)", outline: "none", fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div ref={menuRef} style={{ position: "relative" }}>
          <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} style={linkBtn}>
            + Insert placeholder
          </button>
          {menuOpen && (
            <PanelMenu label="Insert placeholder" width={200}>
              {tokens.map((t) => (
                <MenuRow
                  key={t}
                  label={t}
                  onClick={() => {
                    write(`${value.trimEnd()} ${t}`);
                    setMenuOpen(false);
                  }}
                />
              ))}
            </PanelMenu>
          )}
        </div>
        <button type="button" style={linkBtn} onClick={() => setEditing(false)}>
          Done
        </button>
      </div>
    </div>
  );
}

export function FiguresBox({
  dv,
  ctx,
  tiles,
  mainLabel,
  onChange,
}: {
  dv: Dataview;
  ctx: PickPanelContext;
  // null = the host's own tiles (nothing set).
  tiles: TileFigureSpec[] | null;
  mainLabel: string | null;
  onChange: (tiles: TileFigureSpec[], mainLabel: string | null) => void;
}) {
  const view = tileViewDef(dv.id);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useDismiss(addOpen, () => setAddOpen(false));
  const [dragging, setDragging] = useState<string | null>(null);
  if (!view) return null;
  const spec = tiles ?? defaultTileSpec(dv.id);
  const offered = offeredFigures(dv.id, ctx.results, honestTypes(dv, ctx, !!view.ownMeasure));
  const defOf = new Map<string, TileFigureDef>(offered.map((f) => [f.id, f]));
  const listed = spec.filter((s) => defOf.has(s.figure));
  const among = new Set(listed.map((s) => s.figure));
  const addable = offered.filter((f) => !spec.some((s) => s.figure === f.id));
  const set = (next: TileFigureSpec[]) => onChange(next, mainLabel);
  const tokensOf = (own: string[]) => [...TILE_SHARED_TOKENS, ...own];

  return (
    <FilterBox>
      <FilterLabel>Figures</FilterLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        <div style={{ border: "1px solid var(--cc-border2)", borderRadius: 8, background: "var(--cc-panel)", padding: "7px 9px", display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--cc-faint)" }}>Main figure</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cc-ink)" }}>{view.main.name}</span>
          </div>
          <LabelEditor label={mainLabel ?? undefined} fallback={view.main.label} tokens={tokensOf(view.main.tokens)} onChange={(l) => onChange(spec, l)} />
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--cc-faint)", marginTop: 2 }}>Small tiles</div>
        {listed.length === 0 && <div style={{ fontSize: 11.5, color: "var(--cc-label)" }}>No small tiles: the main figure stands alone.</div>}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }} aria-label="Small tiles, in order">
          {listed.map((s, i) => {
            const def = defOf.get(s.figure)!;
            return (
              <li
                key={s.figure}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(s.figure);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) set(moveTileTo(spec, dragging, s.figure));
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
                data-tile-figure={s.figure}
                data-hidden={s.hidden || undefined}
                style={{ border: `1px solid ${dragging === s.figure ? "var(--cc-blue)" : "var(--cc-border2)"}`, borderRadius: 8, background: "var(--cc-panel)", padding: "7px 9px", display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <span aria-hidden="true" title="Drag to reorder" style={{ cursor: "grab", color: "var(--cc-faint)", fontSize: 12, lineHeight: "20px", userSelect: "none" }}>
                  ⋮⋮
                </span>
                <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 2, opacity: s.hidden ? 0.5 : 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cc-ink)", lineHeight: "20px" }}>
                    {def.name}
                    {s.hidden && <span style={{ fontWeight: 400, color: "var(--cc-faint)" }}> &middot; hidden</span>}
                  </span>
                  <LabelEditor label={s.label} fallback={figureDefaultLabel(def, ctx.results)} tokens={tokensOf(def.tokens)} onChange={(l) => set(setTileLabel(spec, s.figure, l))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
                  <button type="button" aria-label={`Move ${def.name} up`} disabled={i === 0} style={iconBtn(i === 0)} onClick={() => set(moveTile(spec, s.figure, -1, among))}>
                    ▲
                  </button>
                  <button type="button" aria-label={`Move ${def.name} down`} disabled={i === listed.length - 1} style={iconBtn(i === listed.length - 1)} onClick={() => set(moveTile(spec, s.figure, 1, among))}>
                    ▼
                  </button>
                  <Toggle on={!s.hidden} onChange={(v) => set(setTileHidden(spec, s.figure, !v))} label={`Show ${def.name}`} />
                  <button type="button" aria-label={`Remove ${def.name}`} title="Remove" style={iconBtn(false)} onClick={() => set(removeTile(spec, s.figure))}>
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {addable.length > 0 && (
          <div ref={addRef} style={{ position: "relative" }}>
            <button type="button" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)} style={linkBtn}>
              + Add a figure
            </button>
            {addOpen && (
              <PanelMenu label="Add a figure" width={240}>
                {addable.map((f) => (
                  <MenuRow
                    key={f.id}
                    label={f.name}
                    onClick={() => {
                      set(addTile(spec, f.id));
                      setAddOpen(false);
                    }}
                  />
                ))}
              </PanelMenu>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--cc-faint)" }}>A tile whose figure doesn&rsquo;t exist for a school or subject is left out there, as now (a rank needs more than one subject in the category).</div>
      </div>
    </FilterBox>
  );
}
