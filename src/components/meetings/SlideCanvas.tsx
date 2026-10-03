"use client";

// VicData 0.6 S7: one meeting slide, drawn at its logical size (meeting-layout's 1536 x
// 864 canvas, slots at the real panel unit) and scaled uniformly to whatever room it is
// given -- the editor, Present, Grid view and the PDF all use this one component.
//
// Slots carry the standard elements (G7) through the shared CardBox: title, source
// citation, private note, export and fullscreen. CardBox opens its fullscreen modal
// INSIDE the box (so it keeps #teacher-root's theme) as `position: fixed`; under a CSS
// transform that would be pinned to the slide instead of the screen, so while any slot
// reports fullscreen (CardBox's FullscreenReport) the canvas drops its transform. The
// unscaled slide underneath sits behind the modal's backdrop and is clipped by the
// canvas frame, so nothing visibly jumps.
import { createContext, isValidElement, useCallback, useContext, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from "react";
import type { SlideConfig } from "@/catalogue/types";
import { CardBox, FullscreenReport } from "@/components/teacher/CardBox";
import { PanelExport, PanelNote } from "@/components/teacher/PanelFooter";
import * as PanelIcons from "@/components/teacher/PanelIcons";
import { FEATURE_ACCENT } from "@/lib/teacher-view-theme";
import {
  arrangeSlide,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_LEFT,
  GRID_WIDTH,
  SLIDE_PAD_TOP,
  SLIDE_TITLE_FONT,
  SLIDE_TITLE_HEIGHT,
  type PlacedCell,
} from "@/lib/meeting-layout";
import { citationOf, dataviewOf, latestYearOf, pinLine, pinnedOf, slotTitle } from "@/lib/meeting-views";
import { useSlotRenderer } from "./SlotRendererContext";

const ROSE = FEATURE_ACCENT.meetings;
export const SLOT_DRAG_TYPE = "application/x-vicdata-meeting-slot";

export type SlideMode = "edit" | "readonly" | "present" | "print";

// Private notes on slot views (G2: keyed on the view instance), through the existing
// teacher_view_notes table. Absent = no note slot (e.g. no school to key it on).
export type SlotNotes = { get: (viewId: string) => string | null; save: (viewId: string, body: string) => Promise<void> };
export const SlotNotesContext = createContext<SlotNotes | null>(null);

export type SlideHandlers = {
  onSlotClick?: (idx: number) => void;
  onDropOnSlide?: (from: { slide: number; idx: number }, toIdx: number | null) => void;
  onAddView?: () => void;
  onAddText?: () => void;
  onTitle?: (title: string) => void;
  onText?: (slotId: string, text: string) => void;
};

export function readDrag(e: DragEvent): { slide: number; idx: number } | null {
  try {
    const raw = e.dataTransfer.getData(SLOT_DRAG_TYPE);
    return raw ? (JSON.parse(raw) as { slide: number; idx: number }) : null;
  } catch {
    return null;
  }
}

export function SlideCanvas({
  slide,
  slideIndex,
  total,
  scale,
  mode,
  selectedIdx = null,
  handlers = {},
}: {
  slide: SlideConfig;
  slideIndex: number;
  total: number;
  scale: number;
  mode: SlideMode;
  selectedIdx?: number | null;
  handlers?: SlideHandlers;
}) {
  const [fullscreenCount, setFullscreenCount] = useState(0);
  const report = useCallback((open: boolean) => setFullscreenCount((n) => Math.max(0, n + (open ? 1 : -1))), []);
  const unscaled = fullscreenCount > 0;
  const arrangement = arrangeSlide(slide);
  const edit = mode === "edit";
  // The first empty view cell offers "+ Add a view" (Meeting.dc.html); the rest, text.
  const firstEmpty = arrangement.cells.findIndex((c) => c.slotIndex === null && c.kind !== "text");

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale, borderRadius: 10 }}
      data-slide-canvas={slideIndex}
    >
      <FullscreenReport.Provider value={report}>
        <div
          className="absolute left-0 top-0 border border-[var(--panel-border2)] bg-[var(--box-bg)] text-[var(--fg)]"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            borderRadius: 10 / (scale || 1),
            transform: unscaled ? undefined : `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <SlideTitle slide={slide} position={`${slideIndex + 1} / ${total}`} editable={edit} onTitle={handlers.onTitle} />
          {arrangement.cells.map((cell, i) => {
            const slot = cell.slotIndex === null ? null : slide.slots[cell.slotIndex];
            return (
              <CellBox
                key={slot?.id ?? `empty-${i}`}
                cell={cell}
                slot={slot}
                slideIndex={slideIndex}
                mode={mode}
                selected={slot !== null && cell.slotIndex === selectedIdx}
                emptyOffer={cell.kind === "text" || (i !== firstEmpty && slide.slots.length > 0) ? "text" : "view"}
                handlers={handlers}
              />
            );
          })}
        </div>
      </FullscreenReport.Provider>
    </div>
  );
}

function SlideTitle({ slide, position, editable, onTitle }: { slide: SlideConfig; position: string; editable: boolean; onTitle?: (t: string) => void }) {
  return (
    <div className="absolute flex items-baseline gap-3" style={{ left: GRID_LEFT, top: SLIDE_PAD_TOP, width: GRID_WIDTH, height: SLIDE_TITLE_HEIGHT }}>
      {editable ? (
        <input
          type="text"
          value={slide.title}
          onChange={(e) => onTitle?.(e.target.value)}
          placeholder="Type a slide title"
          aria-label="Slide title"
          className="min-w-0 flex-grow border-0 border-b border-dashed border-[var(--edge-strong)] bg-transparent py-1 font-bold text-[var(--fg)] outline-none placeholder:text-[var(--muted3)]"
          style={{ fontSize: SLIDE_TITLE_FONT }}
        />
      ) : (
        <h2 className="min-w-0 flex-grow truncate py-1 font-bold" style={{ fontSize: SLIDE_TITLE_FONT }}>
          {slide.title}
        </h2>
      )}
      <span className="shrink-0 text-[12px] text-[var(--muted)]">{position}</span>
    </div>
  );
}

function CellBox({
  cell,
  slot,
  slideIndex,
  mode,
  selected,
  emptyOffer,
  handlers,
}: {
  cell: PlacedCell;
  slot: SlideConfig["slots"][number] | null;
  slideIndex: number;
  mode: SlideMode;
  selected: boolean;
  emptyOffer: "view" | "text";
  handlers: SlideHandlers;
}) {
  const edit = mode === "edit";
  const [over, setOver] = useState(false);
  const style: CSSProperties = { left: cell.rect.x, top: cell.rect.y, width: cell.rect.width, height: cell.rect.height };

  const dropProps = edit
    ? {
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes(SLOT_DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: DragEvent) => {
          setOver(false);
          const from = readDrag(e);
          if (!from) return;
          e.preventDefault();
          handlers.onDropOnSlide?.(from, cell.slotIndex);
        },
      }
    : {};

  if (!slot) {
    if (!edit) return null;
    return (
      <div
        className="absolute flex flex-col items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed p-3 text-center"
        style={{ ...style, borderColor: over ? ROSE.hex : "var(--edge-strong)" }}
        {...dropProps}
      >
        <div className="text-[12px] text-[var(--muted)]">Empty slot</div>
        {emptyOffer === "view" ? (
          <>
            <button
              type="button"
              onClick={handlers.onAddView}
              className="rounded-full border bg-transparent px-3 py-[5px] text-[12px] font-bold"
              style={{ borderColor: ROSE.hex, color: ROSE.hex }}
            >
              + Add a view
            </button>
            <div className="text-[10.5px] text-[var(--muted)]">
              Pick from your dashboards, or build one view.
              <br />
              Or &ldquo;Copy to meeting&rdquo; from any panel.
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handlers.onAddText}
            className="rounded-full border border-[var(--edge-strong)] bg-transparent px-3 py-[5px] text-[12px] font-bold text-[var(--chip-fg)]"
          >
            + Text box
          </button>
        )}
      </div>
    );
  }

  const idx = cell.slotIndex!;
  const ring: CSSProperties = selected
    ? { outline: `2px solid ${ROSE.hex}`, boxShadow: `0 0 0 6px rgba(${ROSE.rgb},0.18)`, borderRadius: 10 }
    : over
      ? { outline: `2px dashed ${ROSE.hex}`, borderRadius: 10 }
      : {};

  // Clicks on the slot's own controls (fullscreen, source, note, export, the text box)
  // or inside its fullscreen modal don't pick the slot up.
  const onClick = (e: MouseEvent) => {
    if (!edit) return;
    const t = e.target as HTMLElement;
    if (t.closest("[role=dialog]")) return;
    if (t.closest("button, a, input, textarea") && !t.closest("[data-slot-grab]")) return;
    handlers.onSlotClick?.(idx);
  };

  return (
    <div
      data-slot-box=""
      className={`absolute ${edit ? "cursor-pointer" : ""}`}
      style={{ ...style, ...ring }}
      draggable={edit}
      onDragStart={(e) => {
        e.dataTransfer.setData(SLOT_DRAG_TYPE, JSON.stringify({ slide: slideIndex, idx }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      {...dropProps}
    >
      {slot.view ? <ViewSlotBox slot={slot} cell={cell} /> : <TextSlotBox slot={slot} editable={edit} onText={handlers.onText} />}
    </div>
  );
}

// The rail icon by its registry name (Dataview.railIcon -> PanelIcons export).
export function railIcon(name: string | undefined): ReactNode {
  const icon = name ? (PanelIcons as Record<string, unknown>)[name] : undefined;
  return isValidElement(icon) ? icon : PanelIcons.TilesIcon;
}

function ViewSlotBox({ slot, cell }: { slot: SlideConfig["slots"][number]; cell: PlacedCell }) {
  const render = useSlotRenderer();
  const notes = useContext(SlotNotesContext);
  const dv = dataviewOf(slot);
  const pinned = pinnedOf(slot);
  const title = slotTitle(slot);
  const citation = citationOf(slot);
  const viewId = slot.view!.id;
  const note = notes ? { body: notes.get(viewId), onSave: (b: string) => notes.save(viewId, b) } : undefined;
  // The figure's room inside CardBox: p-3 sides, header ~36, footer reserve pb-9.
  const inner = { width: cell.rect.width - 24, height: cell.rect.height - 12 - 36 - 36 };

  return (
    <div className="h-full [&>div]:!mt-0 [&>div]:!h-full [&>div]:!bg-[var(--panel-bg)]">
      <CardBox
        title={title}
        fixedHeight
        tag={
          <div className="flex flex-col gap-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">{pinLine(slot)}</div>
            <div className="text-[11.5px] font-semibold leading-snug text-[var(--muted2)]">{title}</div>
          </div>
        }
        source={citation ? <>Source: {citation}{pinned.year ? `, ${pinned.year}` : ""}.</> : null}
        note={note}
        footerActions={({ print, fullscreen }) => (
          <>
            {note && !fullscreen && <PanelNote body={note.body} onSave={note.onSave} />}
            <PanelExport onPrint={print} />
          </>
        )}
      >
        {({ fullscreen }) =>
          render?.({ slot, dataview: dv, pinned, keepLive: !!slot.view!.keepLive, width: inner.width, height: inner.height, fullscreen }) ?? (
            <StandIn slot={slot} large={fullscreen} />
          )
        }
      </CardBox>
    </div>
  );
}

// The data-free stand-in until the standalone renderer is plugged in.
function StandIn({ slot, large }: { slot: SlideConfig["slots"][number]; large: boolean }) {
  const dv = dataviewOf(slot);
  const p = pinnedOf(slot);
  const live = !!slot.view?.keepLive || (!p.year && !p.yearRange);
  const when = p.yearRange ? `${p.yearRange.from} to ${p.yearRange.to}` : `as of ${p.year}`;
  return (
    <div className="flex flex-grow flex-col items-center justify-center gap-2 px-2 text-center">
      <span
        className={`flex items-center justify-center rounded-[10px] border border-[var(--panel-border)] text-[var(--muted)] ${large ? "h-16 w-16 [&>svg]:h-9 [&>svg]:w-9" : "h-12 w-12 [&>svg]:h-7 [&>svg]:w-7"}`}
      >
        {railIcon(dv?.railIcon)}
      </span>
      <div className={`${large ? "text-[15px]" : "text-[12.5px]"} max-w-[95%] font-semibold leading-snug`}>{slotTitle(slot)}</div>
      <div className="text-[11.5px] text-[var(--muted)]">
        {dv ? dv.label : "View no longer available"}
        {" · "}
        {live ? `live, latest data${latestYearOf(slot) ? ` (${latestYearOf(slot)})` : ""}` : when}
      </div>
      <div className="text-[10.5px] text-[var(--muted3)]">The live figure draws here once the view renderer is connected.</div>
    </div>
  );
}

function TextSlotBox({ slot, editable, onText }: { slot: SlideConfig["slots"][number]; editable: boolean; onText?: (id: string, t: string) => void }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
      {editable && (
        <div data-slot-grab="" className="cursor-grab text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
          Text
        </div>
      )}
      {editable ? (
        <textarea
          value={slot.text ?? ""}
          onChange={(e) => onText?.(slot.id, e.target.value)}
          placeholder="Type here"
          aria-label="Text box"
          className="min-h-0 flex-grow resize-none bg-transparent text-[16px] leading-relaxed text-[var(--fg)] outline-none placeholder:text-[var(--muted3)]"
        />
      ) : (
        <p className="min-h-0 flex-grow overflow-hidden whitespace-pre-wrap text-[16px] leading-relaxed">{slot.text}</p>
      )}
    </div>
  );
}
