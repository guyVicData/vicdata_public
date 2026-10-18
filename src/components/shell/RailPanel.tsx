"use client";

// 0.8 shell (Part A): the panel with a rail -- the column-1 panels, the large view (columns 2-3
// merged, a rail of views) and the row panels Admissions draws, and SMT after it. It is Teacher's
// CardBox (the header, PanelIconRow, the footer notes, full screen as a focus mode) with a tag line,
// an optional span of two columns and a rail of views; on a phone the rail becomes tabs (Tabs).
// Moved here from src/components/admissions/ui.tsx, whose Panel is a thin wrapper round it.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CardBox } from "./CardBox";
import { useReopenRequest } from "@/components/feedback/reopen";
import type { ViewRef } from "@/lib/view-ref";
import { PanelExport, type PanelMenuItem } from "./PanelFooter";
import * as Icons from "./PanelIcons";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ------------------------------------------------------------------------- icons

export function railGlyph(name: string): ReactNode {
  const g = (Icons as unknown as Record<string, ReactNode>)[name];
  return g && typeof g === "object" ? g : Icons.TilesIcon;
}

// ------------------------------------------------------------------------- the panel

export type RailItem = { id: string; label: string; icon: string };

/** 0.7 r3 (F1): the rail is Teacher's -- its IconButton, down CardBox's rail column. */
export function Rail({ items, active, onPick }: { items: RailItem[]; active: string; onPick: (id: string) => void }) {
  if (items.length < 2) return null;
  return (
    <>
      {items.map((it) => (
        <Icons.IconButton key={it.id} label={it.label} active={it.id === active} onClick={() => onPick(it.id)}>
          {railGlyph(it.icon)}
        </Icons.IconButton>
      ))}
    </>
  );
}

/** Phone: the large view's views become tabs (Phone.dc.html). */
export function Tabs({ items, active, onPick }: { items: RailItem[]; active: string; onPick: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-[14px] overflow-x-auto border-b border-[var(--panel-border)]">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={it.id === active} type="button" onClick={() => onPick(it.id)} className={cx("whitespace-nowrap border-b-2 px-[2px] py-2 text-[12px] font-bold", it.id === active ? "border-[var(--accent)] text-[var(--fg)]" : "border-transparent text-[var(--muted2)]")}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export type PanelMenuAction = PanelMenuItem;

/** One panel or large view (Admissions' and SMT's). 0.7 r3 (F1): Teacher's own CardBox -- the same header
 * and icon row (PanelIconRow: the menu, full screen, a reserved collapse slot), the same rail,
 * the same footer (the (i) with the view's "What this shows", the note, feedback, the flag and menu at the right)
 * and the same full screen. Only the size differs: Admissions' rows are 470 and 330 tall, and
 * the large view spans two columns. Admissions' own header line (tag · context) is the tag, its
 * chips sit right-aligned before the icon row. */
export function RailPanel({
  tag,
  context,
  chips,
  menu = [],
  rail,
  railActive,
  onRail,
  source,
  caption,
  visibleCaption,
  flag,
  controls,
  height,
  span = 1,
  title,
  children,
  id,
  onCopy,
  focusBar,
  view,
}: {
  tag: string;
  context?: ReactNode;
  chips?: ReactNode;
  menu?: PanelMenuAction[];
  rail?: RailItem[];
  railActive?: string;
  onRail?: (id: string) => void;
  source?: ReactNode;
  // The panel's honesty note: the view's "What this shows", at the top of its (i) (0.8).
  caption?: ReactNode;
  // A line the panel shows without a click (CardBox's visibleCaption): the LA context, a link.
  visibleCaption?: ReactNode;
  flag?: ReactNode;
  // A row under the header (CardBox's controls): the phone's tabs.
  controls?: ReactNode;
  height: number | "auto";
  span?: 1 | 2;
  title: string;
  // `height`: in full screen on a desktop, the room the figure has (FocusFill), for a chart to fill.
  children: (o: { fullscreen: boolean; height?: number }) => ReactNode;
  id?: string;
  // D8: "Copy this view…" (meeting slides; absent in View as and wherever a copy can't be saved).
  onCopy?: () => void;
  // 0.7 admissions editor s1 (Guy, decision 3): full screen is a focus mode on every Admissions
  // panel -- the rail, the panel's chips, the notes, the menu and this bar (the entry-point chips),
  // so a member can change view and entry point without leaving it.
  focusBar?: ReactNode;
  // 0.8 notes and feedback: the view this panel is showing (its panel and view instance ids), for the
  // footer's private note and feedback icon. `label` defaults to the panel's title.
  view?: (Omit<ViewRef, "label"> & { label?: string }) | null;
}) {
  // A feedback item's Open link for this panel: switch the rail to its view, and show the panel.
  const reopen = useReopenRequest();
  const panelId = view?.panelId;
  useEffect(() => {
    if (!panelId || !reopen.take(panelId)) return;
    if (reopen.view && reopen.view !== railActive && rail?.some((r) => r.id === reopen.view)) onRail?.(reopen.view);
    reopen.reveal(`[data-view-panel="${CSS.escape(panelId)}"]`);
    // Once, when the panel first draws.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId]);
  return (
    <section
      id={id}
      aria-label={title}
      data-adm-panel={id}
      data-view-panel={view?.panelId}
      className="min-w-0 [&>div]:!mt-0"
      style={{ gridColumn: span === 2 ? "span 2" : undefined }}
    >
      <CardBox
        title={title}
        tag={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-[var(--fg)]">{tag}</span>
            {context && <span className="min-w-0 truncate whitespace-nowrap text-[11.5px] text-[var(--muted2)]">{context}</span>}
          </span>
        }
        headerExtra={chips}
        controls={controls}
        actions={rail && railActive && onRail && rail.length > 1 ? <Rail items={rail} active={railActive} onPick={onRail} /> : undefined}
        source={source}
        caption={caption}
        visibleCaption={visibleCaption}
        flag={flag}
        fixedHeight={height !== "auto"}
        height={height === "auto" ? undefined : height}
        menu={({ print }) => <PanelExport onPrint={print} onCopy={onCopy} extra={menu} />}
        focus={{ bar: focusBar }}
        view={view ? { ...view, label: view.label ?? title } : null}
      >
        {({ fullscreen }) =>
          fullscreen ? (
            <FocusFill>{(h) => children({ fullscreen, height: h })}</FocusFill>
          ) : (
            <div className={cx("flex min-w-0 grow flex-col gap-2", height !== "auto" && "min-h-0")}>{children({ fullscreen })}</div>
          )
        }
      </CardBox>
    </section>
  );
}

/** Full screen's figure area: it takes the room the modal leaves and says how tall that is, so a
 * chart can fill it (desktop widths; below Teacher's lg the modal stacks and scrolls, and the views
 * keep their full-screen sizes). Content taller than the room scrolls inside it. */
function FocusFill({ children }: { children: (height: number | undefined) => ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [h, setH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setH(window.innerWidth >= 1024 ? Math.floor(el.getBoundingClientRect().height) : undefined);
    on();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} data-focus-fill={h ?? ""} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
      {children(h)}
    </div>
  );
}

/** A chart's height in full screen: the room less what sits around it, never below its own size. */
export const fillHeight = (room: number | undefined, around: number, min: number) => (room ? Math.max(min, room - around) : min);
