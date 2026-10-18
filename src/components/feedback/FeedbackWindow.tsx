"use client";

// VicData 0.8 notes and feedback (decision 4, Guy 18 Oct): the feedback form sits OUTSIDE the panel, in
// a window that doesn't cover the view, so the data stays visible while writing.
//   * Desktop: docked to the right by default -- the page (and a panel's full screen) give it its room
//     through --fb-dock-right, so nothing is under it -- and it stays put while the page scrolls. Its
//     header drags it off the dock to float anywhere (then it can be resized from its corner); "Dock"
//     puts it back.
//   * Phone: a bottom sheet, half the screen; its handle pulls it up taller and back down to half. The
//     page gets its room below (--fb-dock-bottom), and the view is scrolled into the space above.
//   * It works over a panel's full screen too (z above the modal, which shrinks to give it room).
// It stays tied to the view it was opened from. Send keeps it open, emptied, for the next item; Esc
// (inside it) or the close button closes it. It lists the person's own items on the view, then the form.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FEEDBACK_APPLIES,
  FEEDBACK_IMPORTANCE,
  FEEDBACK_KINDS,
  FEEDBACK_SCOPE,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_WHERE,
  feedbackNumber,
  recordedQuery,
  type ViewSurface,
} from "@/lib/view-ref";
import { publishedVersionIdOf } from "@/lib/published-vicdata";
import { addOwnItem, closeFeedback, feedbackToken, useFeedbackState, type FeedbackTarget, type OwnItem } from "./store";

const PHONE_MAX = 640;
const DOCK_WIDTH = 360;
const DOCK_GAP = 12;
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function setDock(right: number, bottom: number) {
  const s = document.documentElement.style;
  if (right) s.setProperty("--fb-dock-right", `${right}px`);
  else s.removeProperty("--fb-dock-right");
  if (bottom) s.setProperty("--fb-dock-bottom", `${bottom}px`);
  else s.removeProperty("--fb-dock-bottom");
}

function themeOf(): "light" | "dark" {
  const t = document.getElementById("teacher-root")?.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The item as the page records it (the server adds the app version, the author and the status). */
export function feedbackPayload(surface: ViewSurface, target: Pick<FeedbackTarget, "view" | "viewKey">, form: FormState, page: { path: string; search: string; width: number; theme: "light" | "dark" }) {
  const sc = surface.scope;
  return {
    product: surface.product,
    view_as: surface.viewAs || surface.peek,
    role: surface.role,
    school_urn: sc.kind === "school" ? sc.urn : null,
    school_name: sc.kind === "school" ? sc.name : null,
    group_id: sc.kind === "group" ? sc.id : null,
    group_ref: sc.kind === "group" ? sc.ref : null,
    group_name: sc.kind === "group" ? sc.name : null,
    dashboard_id: surface.dashboard.id,
    dashboard_name: surface.dashboard.name,
    dashboard_version_id: surface.dashboard.versionId,
    panel_id: target.view.panelId,
    panel_name: target.view.panelName ?? null,
    view_instance_id: target.view.instanceId,
    dataview_id: target.view.dataview,
    view_label: target.view.label,
    view_key: target.viewKey,
    state: surface.state,
    page_path: page.path,
    page_query: recordedQuery(page.search),
    device: page.width < PHONE_MAX ? "phone" : "desktop",
    viewport_width: page.width,
    theme: page.theme,
    body: form.text,
    looks_good: form.kinds.includes("looks_good"),
    kinds: form.kinds,
    importance: form.importance,
    scope: form.scope,
    applies_to: form.applies,
    saw: form.kinds.includes("wrong_figure") ? form.saw : null,
    expected: form.kinds.includes("wrong_figure") ? form.expected : null,
    where_in_view: form.where,
  };
}

export type FormState = { kinds: string[]; importance: string | null; scope: string | null; applies: string | null; where: string[]; saw: string; expected: string; text: string };
const EMPTY: FormState = { kinds: [], importance: null, scope: null, applies: null, where: [], saw: "", expected: "", text: "" };

/** An item needs text or "Looks good". */
export const canSend = (f: FormState) => f.text.trim().length > 0 || f.kinds.includes("looks_good");

function Chips({ label, options, picked, onPick, multi = false }: { label: string; options: readonly { id: string; label: string }[]; picked: string[]; onPick: (next: string[]) => void; multi?: boolean }) {
  return (
    <fieldset className="mt-2.5">
      <legend className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)]">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((o) => {
          const on = picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              data-fb-chip={o.id}
              onClick={() => onPick(multi ? (on ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : on ? [] : [o.id])}
              className={cx(
                "rounded-full border px-2 py-[3px] text-[11.5px] font-semibold leading-none",
                on
                  ? o.id === "looks_good"
                    ? "border-[var(--fb-good)] bg-[color-mix(in_srgb,var(--fb-good)_14%,transparent)] text-[var(--fg)]"
                    : "border-[var(--fg)] bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--fg)]"
                  : "border-[var(--panel-border2)] text-[var(--muted)] hover:text-[var(--fg)]",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

function ItemList({ items }: { items: OwnItem[] }) {
  if (!items.length) return <p className="text-[11.5px] italic text-[var(--muted3)]">Nothing from you on this view yet.</p>;
  return (
    <ul data-fb-items="" className="flex flex-col gap-1.5">
      {items.map((i) => (
        <li key={i.id} className="rounded-md border border-[var(--panel-border)] px-2 py-1.5 text-[11.5px] leading-snug">
          <span className="font-bold text-[var(--fg)]">{feedbackNumber(i.number)}</span>
          <span className="text-[var(--muted2)]"> · {fmtDate(i.created_at)} · {i.school_name ?? i.group_name ?? i.school_urn ?? i.group_id}</span>
          <span className="float-right font-semibold text-[var(--muted)]">{FEEDBACK_STATUS_LABEL[i.status]}</span>
          <span className="mt-0.5 block text-[var(--muted)]">{i.excerpt || (i.looks_good ? "Looks good" : "")}</span>
        </li>
      ))}
    </ul>
  );
}

function portal(node: ReactNode) {
  return createPortal(node, document.getElementById("teacher-root") ?? document.body);
}

export function FeedbackWindow() {
  const { target, items } = useFeedbackState();
  if (!target) return null;
  // Keyed on the view and the opening, so a new view starts a fresh form.
  return <WindowFor key={`${target.viewKey}@${target.openedAt}`} target={target} items={items.filter((i) => i.view_key === target.viewKey)} />;
}

type Mode = { kind: "dock"; width: number } | { kind: "float"; x: number; y: number; w: number; h: number } | { kind: "sheet"; tall: boolean };

function WindowFor({ target, items }: { target: FeedbackTarget; items: OwnItem[] }) {
  const { surface, view } = target;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>(() => (window.innerWidth < PHONE_MAX ? { kind: "sheet", tall: false } : { kind: "dock", width: DOCK_WIDTH }));
  const root = useRef<HTMLDivElement | null>(null);
  const text = useRef<HTMLTextAreaElement | null>(null);

  // The page makes room for a docked window; a floating one is wherever it was put.
  useLayoutEffect(() => {
    const sheetHeight = () => Math.round(window.innerHeight * (mode.kind === "sheet" && mode.tall ? 0.85 : 0.5));
    setDock(mode.kind === "dock" ? mode.width + DOCK_GAP * 2 : 0, mode.kind === "sheet" ? sheetHeight() : 0);
    return () => setDock(0, 0);
  }, [mode]);
  // The view it is about stays in sight: scrolled into what the page leaves visible.
  useEffect(() => {
    const el = target.anchor;
    if (!el || !el.isConnected) return;
    const id = requestAnimationFrame(() => el.scrollIntoView({ block: mode.kind === "sheet" ? "start" : "nearest", behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [target.anchor, mode.kind]);
  useEffect(() => {
    text.current?.focus({ preventScroll: true });
  }, []);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "Escape") return;
    // Esc here closes the window, not the full screen behind it.
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    closeFeedback();
  };

  const send = async () => {
    if (!canSend(form) || sending) return;
    setSending(true);
    setMessage(null);
    try {
      const token = await feedbackToken();
      const surfaceNow = { ...surface, dashboard: { ...surface.dashboard, versionId: surface.dashboard.versionId ?? publishedVersionIdOf(surface.dashboard.id) } };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(feedbackPayload(surfaceNow, target, form, { path: window.location.pathname, search: window.location.search, width: window.innerWidth, theme: themeOf() })),
      });
      const json = (await res.json().catch(() => null)) as { item?: { id: string; number: number; created_at: string; status: OwnItem["status"] }; error?: string } | null;
      if (!res.ok || !json?.item) {
        setMessage({ tone: "error", text: json?.error ?? "Could not send it. Try again." });
        return;
      }
      const sc = surface.scope;
      addOwnItem({
        id: json.item.id,
        number: json.item.number,
        created_at: json.item.created_at,
        status: json.item.status,
        view_key: target.viewKey,
        school_urn: sc.kind === "school" ? sc.urn : null,
        school_name: sc.kind === "school" ? sc.name : null,
        group_id: sc.kind === "group" ? sc.id : null,
        group_name: sc.kind === "group" ? sc.name : null,
        looks_good: form.kinds.includes("looks_good"),
        kinds: form.kinds,
        has_text: form.text.trim().length > 0,
        excerpt: form.text.trim().slice(0, 140),
      });
      setForm(EMPTY);
      setMessage({ tone: "ok", text: `Sent as ${feedbackNumber(json.item.number)}. Add another, or close.` });
      text.current?.focus({ preventScroll: true });
    } catch {
      setMessage({ tone: "error", text: "Could not send it. Try again." });
    } finally {
      setSending(false);
    }
  };

  // Desktop: the header drags the window off the dock (and around while floating).
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onHeaderDown = (e: ReactPointerEvent) => {
    if (mode.kind === "sheet" || (e.target as HTMLElement).closest("button")) return;
    const r = root.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (mode.kind === "dock") setMode({ kind: "float", x: r.left, y: r.top, w: r.width, h: Math.min(r.height, window.innerHeight - 48) });
  };
  const onHeaderMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setMode((m) => (m.kind === "float" ? { ...m, x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - d.dx)), y: Math.max(0, Math.min(window.innerHeight - 48, e.clientY - d.dy)) } : m));
  };
  const onHeaderUp = () => {
    drag.current = null;
  };
  // Phone: the handle pulls the sheet up taller or back down to half.
  const pull = useRef<number | null>(null);
  const onHandleDown = (e: ReactPointerEvent) => {
    pull.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleUp = (e: ReactPointerEvent) => {
    const start = pull.current;
    pull.current = null;
    if (start === null || mode.kind !== "sheet") return;
    const dy = e.clientY - start;
    if (Math.abs(dy) < 6) setMode({ kind: "sheet", tall: !mode.tall });
    else setMode({ kind: "sheet", tall: dy < 0 });
  };

  const style: CSSProperties =
    mode.kind === "dock"
      ? { right: DOCK_GAP, top: DOCK_GAP, bottom: DOCK_GAP, width: mode.width }
      : mode.kind === "float"
        ? { left: mode.x, top: mode.y, width: mode.w, height: mode.h }
        : { left: 0, right: 0, bottom: 0, height: mode.tall ? "85dvh" : "50dvh" };
  const sc = surface.scope;
  const where = [view.panelName && view.panelName !== view.label ? view.panelName : null, surface.dashboard.name, sc.name].filter(Boolean).join(" · ");
  const wrong = form.kinds.includes("wrong_figure");

  return portal(
    <div
      ref={root}
      role="dialog"
      aria-label={`Feedback on ${view.label}`}
      data-feedback-window={mode.kind}
      data-fb-view={target.viewKey}
      onKeyDown={onKey}
      style={style}
      className={cx(
        "fixed z-[1700] flex flex-col border border-[var(--panel-border2)] bg-[var(--panel-bg)] text-[var(--fg)] shadow-[0_12px_32px_rgba(0,0,0,0.28)] print:hidden",
        mode.kind === "sheet" ? "rounded-t-[14px]" : "rounded-[12px]",
        mode.kind === "float" && "resize overflow-hidden",
      )}
    >
      {mode.kind === "sheet" && (
        <button
          type="button"
          aria-label={mode.tall ? "Pull down to half height" : "Pull up"}
          data-fb-handle=""
          onPointerDown={onHandleDown}
          onPointerUp={onHandleUp}
          className="mx-auto mt-1.5 flex h-5 w-16 touch-none items-center justify-center"
        >
          <span className="block h-1 w-10 rounded-full bg-[var(--panel-border2)]" />
        </button>
      )}
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        className={cx("flex shrink-0 items-start gap-2 border-b border-[var(--panel-border)] px-3 pb-2", mode.kind === "sheet" ? "pt-1" : "cursor-move pt-2.5 select-none")}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)]">Feedback on</p>
          <p data-fb-title="" className="truncate text-[13px] font-semibold">{view.label}</p>
          <p className="truncate text-[11px] text-[var(--muted2)]">{where}</p>
        </div>
        {mode.kind === "float" && (
          <button type="button" onClick={() => setMode({ kind: "dock", width: DOCK_WIDTH })} className="rounded-md border border-[var(--panel-border2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
            Dock
          </button>
        )}
        <button type="button" aria-label="Close feedback" data-fb-close="" onClick={closeFeedback} className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--fg)]">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l10 10M15 5 5 15" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        <ItemList items={items} />
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Chips label="What kind" options={FEEDBACK_KINDS} picked={form.kinds} onPick={(kinds) => setForm({ ...form, kinds })} multi />
          {wrong && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <input value={form.saw} onChange={(e) => setForm({ ...form, saw: e.target.value })} maxLength={500} placeholder="I see…" aria-label="I see" className="rounded-md border border-[var(--panel-border)] bg-transparent px-2 py-1 text-[12px]" />
              <input value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} maxLength={500} placeholder="I expected…" aria-label="I expected" className="rounded-md border border-[var(--panel-border)] bg-transparent px-2 py-1 text-[12px]" />
            </div>
          )}
          <textarea
            ref={text}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            rows={4}
            maxLength={8000}
            placeholder={form.kinds.includes("looks_good") ? "Anything to add? (optional)" : "What did you notice?"}
            aria-label="Your feedback"
            className="mt-2.5 w-full resize-y rounded-md border border-[var(--panel-border)] bg-transparent p-2 text-[12.5px]"
          />
          <Chips label="How much it matters" options={FEEDBACK_IMPORTANCE} picked={form.importance ? [form.importance] : []} onPick={(x) => setForm({ ...form, importance: x[0] ?? null })} />
          <Chips label="Scope" options={FEEDBACK_SCOPE} picked={form.scope ? [form.scope] : []} onPick={(x) => setForm({ ...form, scope: x[0] ?? null })} />
          <Chips label="Applies to" options={FEEDBACK_APPLIES} picked={form.applies ? [form.applies] : []} onPick={(x) => setForm({ ...form, applies: x[0] ?? null })} />
          <Chips label="Where in the view (optional)" options={FEEDBACK_WHERE} picked={form.where} onPick={(where) => setForm({ ...form, where })} multi />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={!canSend(form) || sending}
              data-fb-send=""
              className="rounded-md bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--panel-bg)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            <span className="text-[10.5px] text-[var(--muted3)]">Only VicData sees this, with the view and its settings.</span>
          </div>
          {message && (
            <p role="status" data-fb-message={message.tone} className={cx("mt-2 text-[11.5px] font-semibold", message.tone === "ok" ? "text-[var(--fb-good)]" : "text-red-600")}>
              {message.text}
            </p>
          )}
        </form>
      </div>
    </div>,
  );
}
