"use client";

// VicData 0.6 S6: "Copy this view" (scope brief §7.4; boards docs/wireframes/v0.6/CopyTo
// and CopyToMeeting). The quickest way to build: collect views you already like.
//
//   To a dashboard: New dashboard (the view's settings become column 1's) or any
//   dashboard you can edit -> where on it (the slot map: an existing panel's rail, an
//   empty slot, a new row) -> the fit check (follows the column, or "overridden").
//   To a meeting: the meeting (last used pre-picked) or a new one -> the slide (or a new
//   one) -> it goes in the next free slot, pinned, and the slide re-arranges.
//   Copy and stay / Copy and open.
//
// Props contract (for the config renderer, the editor and meeting slots):
//   source      CopyViewSource -- the view instance, its resolved PickPanelContext and the
//               PinnedSettings resolved from the panel's current state, plus its title.
//   superAdmin  may copy into VicData dashboards (RLS decides in the end).
//   onCopied    told where the view went.
// The pure rules are src/lib/copy-view.ts; the shell is the comparator chooser's (Panel,
// Body, Footer in TeacherModal "chooser"), as Add a view uses.
import { withoutVariants } from "@/catalogue/variants";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { summaryLine } from "@/catalogue/pick";
import type { DashboardConfig, SlideConfig } from "@/catalogue/types";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { AlertIcon, Body, Footer, Panel, PrimaryButton, SecondaryButton, TickIcon } from "@/components/teacher/chooser/ui";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import {
  canEditRow,
  copyToDashboard,
  defaultSlide,
  defaultTarget,
  fitCheck,
  kindWordOf,
  meetingBanner,
  newDashboardFromView,
  newDashboardName,
  pinSummary,
  readLastUsed,
  sameTarget,
  shapeLine,
  slideIsFull,
  slideLabel,
  slotContext,
  slotMap,
  sourceDataview,
  TIME_WORDS,
  writeLastUsed,
  type CopyViewSource,
  type SlotTarget,
} from "@/lib/copy-view";
import { colourOf } from "@/lib/dashboard-icons";
import { createDashboard, listDashboards, loadDashboard, publish, saveDraft, type DashboardRow } from "@/lib/dashboards-store";
import { addViewToMeeting, localToday, newId, shortDate } from "@/lib/meeting-ops";
import { thumbRects } from "@/lib/meeting-layout";
import { createMeeting, friendlyMeetingError, listMeetings, loadMeeting, NOT_APPLIED_LINE, saveMeeting, type MeetingSummary } from "@/lib/meeting-store";
import { DashboardIcon } from "@/components/library/DashboardIcon";
import { configsFor, dashboardHref, loadViewer, type Viewer } from "@/components/library/data";
import { Callout, CpvStyles, DestRow, DialogHeader, Label, Note, PlusSquare, Segmented } from "@/components/library/dialog";
import { COPY_UI } from "@/components/library/layout";
import { PANEL_UNIT } from "@/catalogue/config";
import type { CopyViewResult } from "./CopyViewSourceContext";

export type CopyViewDialogProps = {
  open: boolean;
  onClose: () => void;
  source: CopyViewSource;
  superAdmin?: boolean;
  onCopied?: (result: CopyViewResult) => void;
};

type Mode = "dashboard" | "meeting";

export function CopyViewDialog(props: CopyViewDialogProps) {
  // Opened from a click, so always in the browser.
  const [root] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : document.getElementById("teacher-root")));
  if (!props.open) return null;
  // Rendered into #teacher-root (its theme lives there), not inside the panel: a panel's
  // own overflow and stacking would otherwise clip a fixed dialog.
  const dialog = <Dialog {...props} />;
  return root ? createPortal(dialog, root) : dialog;
}

type Loaded = {
  viewer: Viewer;
  available: boolean;
  dashboards: { row: DashboardRow; config: DashboardConfig }[];
  meetings: { available: boolean; list: MeetingSummary[] };
};

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const BarsGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="8" height="16" rx="1.5" />
    <rect x="13" y="4" width="8" height="16" rx="1.5" />
  </svg>
);

function Dialog({ onClose, source, superAdmin = false, onCopied }: CopyViewDialogProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();
  const today = localToday();
  const dv = sourceDataview(source);
  const kind = kindWordOf(source.instance.dataview);
  const last = useMemo(() => readLastUsed(storage()), []);

  const [mode, setMode] = useState<Mode>(last?.mode ?? "dashboard");
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dest, setDest] = useState<string | "new" | null>(null);
  const [destConfig, setDestConfig] = useState<{ id: string; config: DashboardConfig } | null>(null);
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [meeting, setMeeting] = useState<string | "new" | null>(null);
  const [newMeeting, setNewMeeting] = useState({ name: "", date: "" });
  // null = the pre-picked slide (the last with room, else a new one).
  const [slidePick, setSlide] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CopyViewResult | null>(null);

  // Load what can be copied to.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const viewer = await loadViewer(supabase);
        const [dash, meet] = await Promise.all([listDashboards(supabase, { kind: "dashboard" }), listMeetings(supabase, today).catch(() => ({ available: false, meetings: [] as MeetingSummary[] }))]);
        const me = { ...viewer, superAdmin: viewer.superAdmin || superAdmin };
        const editable = dash.available ? dash.rows.filter((r) => canEditRow(r, me) && (r.owner_scope !== "school" || r.school_account_id === viewer.school?.accountId || me.superAdmin)) : [];
        // Super-admin's own and VicData's first; other people's personal dashboards never.
        const mineFirst = editable.filter((r) => r.owner_scope !== "user" || r.owner_profile_id === viewer.uid);
        const configs = await configsFor(supabase, mineFirst);
        const dashboards = mineFirst.filter((r) => configs.has(r.id)).map((row) => ({ row, config: configs.get(row.id)! }));
        const order = { user: 0, school: 1, vicdata: 2 } as const;
        dashboards.sort((a, b) => order[a.row.owner_scope] - order[b.row.owner_scope] || a.row.name.localeCompare(b.row.name));
        const upcoming = meet.meetings.filter((m) => !m.archived);
        if (!live) return;
        setData({ viewer: me, available: dash.available, dashboards, meetings: { available: meet.available, list: upcoming } });
        setDest(last?.dashboardId && dashboards.some((d) => d.row.id === last.dashboardId) ? last.dashboardId : (dashboards[0]?.row.id ?? "new"));
        const m = last?.meetingId && upcoming.some((x) => x.id === last.meetingId) ? last.meetingId : (upcoming[0]?.id ?? "new");
        setMeeting(m);
      } catch {
        if (live) setLoadError("Couldn't load your dashboards and meetings. Check your connection and try again.");
      }
    })();
    return () => {
      live = false;
    };
  }, [supabase, superAdmin, today, last]);

  // The destination dashboard's working config: the draft when there is one (editors only).
  useEffect(() => {
    if (!dest || dest === "new" || !data) return;
    let live = true;
    (async () => {
      const fromList = data.dashboards.find((d) => d.row.id === dest)?.config ?? null;
      let config = fromList;
      try {
        const l = await loadDashboard(supabase, dest, true);
        config = l?.draft ?? l?.version?.config ?? l?.config ?? fromList;
      } catch {
        // Keep the listed config.
      }
      if (!live || !config) return;
      setDestConfig({ id: dest, config });
      setTarget(defaultTarget(config, dv));
    })();
    return () => {
      live = false;
    };
  }, [dest, data, supabase, dv]);

  // The meeting's slides, and the pre-picked slide.
  const meetingSlides: SlideConfig[] = useMemo(() => {
    if (!data || !meeting || meeting === "new") return [];
    return data.meetings.list.find((m) => m.id === meeting)?.config?.presentation?.slides ?? [];
  }, [data, meeting]);
  const slide = slidePick ?? defaultSlide(meetingSlides);

  const cfg = dest !== "new" && destConfig?.id === dest ? destConfig.config : null;
  const slotCtx = cfg && target ? slotContext(cfg, target, source) : null;
  const fit = slotCtx && target ? fitCheck(source, slotCtx, target, { superAdmin: data?.viewer.superAdmin }) : null;

  const canCopy =
    !busy &&
    !!data &&
    (mode === "dashboard"
      ? data.available && (dest === "new" || (!!cfg && !!target && !!fit && !fit.blocked))
      : data.meetings.available && (meeting !== "new" || (!!newMeeting.name.trim() && !!newMeeting.date)) && !(slide !== "new" && slideIsFull(meetingSlides.find((s) => s.id === slide) ?? { id: "", title: "", layout: "auto", slots: [] })));

  const copy = async (open: boolean) => {
    if (!data || !canCopy) return;
    setBusy(true);
    setError(null);
    try {
      const result = mode === "dashboard" ? await copyDashboard() : await copyMeeting();
      writeLastUsed(storage(), mode === "dashboard" ? { mode, dashboardId: result.kind === "dashboard" ? result.dashboardId : undefined } : { mode, meetingId: result.kind === "meeting" ? result.meetingId : undefined });
      onCopied?.(result);
      if (open) {
        router.push(result.href);
        onClose();
      } else {
        setDone(result);
        window.setTimeout(onClose, COPY_UI.stayCloseMs);
      }
    } catch (e) {
      setError(friendlyCopyError(e));
    }
    setBusy(false);
  };

  const copyDashboard = async (): Promise<CopyViewResult> => {
    const viewer = data!.viewer;
    if (dest === "new") {
      const name = newDashboardName(source, data!.dashboards.filter((d) => d.row.owner_scope === "user").map((d) => d.row.name));
      const config = newDashboardFromView(source, { id: newId("dash"), name });
      const row = await createDashboard(supabase, { kind: "dashboard", owner_scope: "user", owner_profile_id: viewer.uid, school_account_id: viewer.school?.accountId ?? null, name, config });
      await publish(supabase, row.id, { ...config, id: row.id }, "Created with Copy this view", `Started from ${source.title}`);
      return { kind: "dashboard", dashboardId: row.id, href: dashboardHref(row), name, panelId: config.panels[0].id, overridden: false, created: true };
    }
    const r = copyToDashboard(cfg!, target!, source, { superAdmin: viewer.superAdmin });
    if (!r.ok) throw new Error(r.reason === "blocked" ? "That panel's column doesn't fit this view." : "That slot isn't on the dashboard any more.");
    const row = data!.dashboards.find((d) => d.row.id === dest)!.row;
    await saveDraft(supabase, row.id, r.config, row.published_version_id);
    // Personal dashboards have no audience to protect: the copy goes live straight away.
    // VicData and school dashboards keep it in the draft until the editor publishes.
    if (row.owner_scope === "user") await publish(supabase, row.id, r.config, undefined, `Added ${source.title}`);
    return { kind: "dashboard", dashboardId: row.id, href: dashboardHref(row), name: row.name, panelId: r.panelId, overridden: r.overridden, created: false };
  };

  const copyMeeting = async (): Promise<CopyViewResult> => {
    let id = meeting!;
    let created = false;
    if (id === "new") {
      id = await createMeeting(supabase, { name: newMeeting.name.trim(), meetingDate: newMeeting.date, schoolAccountId: data!.viewer.school?.accountId ?? null });
      created = true;
    }
    const loaded = await loadMeeting(supabase, id);
    if (!loaded) throw new Error("That meeting isn't there any more.");
    const slides = loaded.config.presentation?.slides ?? [];
    // A new meeting starts with one empty slide: the view goes on it.
    const slideId = created ? (slides[0]?.id ?? "new") : slide;
    const r = addViewToMeeting(loaded.config, slideId, { ...withoutVariants(source.instance), id: newId("view"), title: source.title }, source.pinned);
    if (!r.ok) throw new Error(r.reason === "slide-full" ? "That slide is full. Pick another, or a new slide." : "That slide isn't there any more.");
    await saveMeeting(supabase, id, r.config, loaded.version?.id ?? null);
    return { kind: "meeting", meetingId: id, href: `/teacher/meetings/${id}`, name: loaded.row.name, slideId: r.slideId, arrangement: r.arrangement, created };
  };

  const destName = dest === "new" ? "New dashboard" : (data?.dashboards.find((d) => d.row.id === dest)?.row.name ?? "");

  return (
    <TeacherModal label="Copy this view" backdropLabel="Close Copy this view" size="chooser" onClose={onClose}>
      <Panel>
        <div className="cpv-root" style={{ display: "contents" }}>
        <CpvStyles />
        <DialogHeader title="Copy this view" subtitle={source.title} onClose={onClose} />
        <Body gap={10}>
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { id: "dashboard", label: "To a dashboard" },
              { id: "meeting", label: "To a meeting" },
            ]}
          />

          {loadError && <div style={{ fontSize: 12.5, color: "var(--cc-danger)" }}>{loadError}</div>}
          {!data && !loadError && <Note>Loading…</Note>}
          {done && (
            <Callout tone="green" icon={<TickIcon size={14} width={2.4} />}>
              Copied to {done.name}
              {done.kind === "meeting" ? ` (${done.arrangement})` : done.overridden ? ", marked “overridden”" : ""}.
            </Callout>
          )}

          {data && mode === "dashboard" && !data.available && <Callout tone="amber" icon={<AlertIcon size={14} width={2.2} />}>Copying to a dashboard needs the database update, which isn&rsquo;t applied yet.</Callout>}

          {data && mode === "dashboard" && data.available && (
            <>
              <DestRow on={dest === "new"} icon={<PlusSquare />} title="New dashboard" sub="Starts with this view; its settings become the first column's" onClick={() => setDest("new")} />
              {data.dashboards.map(({ row, config }) => (
                <DestRow
                  key={row.id}
                  on={dest === row.id}
                  icon={<DashboardIcon config={config} size={COPY_UI.destIcon} />}
                  title={row.name}
                  sub={row.owner_scope === "user" ? `Mine · ${shapeLine(config)}` : `${row.owner_scope === "vicdata" ? "VicData" : (data.viewer.school?.name ?? "School")} · you can edit`}
                  onClick={() => setDest(row.id)}
                />
              ))}
              <Note>Only dashboards you can edit are listed.</Note>

              {dest === "new" ? (
                <Note style={{ fontSize: 11.5, color: "var(--cc-label)" }}>
                  Column 1 will show {summaryLine(source.context, true)}. You can rename it, and add more, from the dashboard.
                </Note>
              ) : cfg ? (
                <>
                  <Label style={{ marginTop: 4 }}>Where on {destName}?</Label>
                  <SlotMapView config={cfg} target={target} onTarget={setTarget} />
                  {fit && (
                    <Callout tone={fit.fits ? "green" : "amber"} icon={fit.fits ? <TickIcon size={14} width={2.4} /> : <AlertIcon size={14} width={2.2} />}>
                      {fit.message}
                    </Callout>
                  )}
                  {(!fit || fit.fits) && <Note>If the slot&rsquo;s column doesn&rsquo;t match, the view keeps its own settings and shows &ldquo;overridden&rdquo;.</Note>}
                  {cfg && data.dashboards.find((d) => d.row.id === dest)?.row.owner_scope !== "user" && <Note>It goes into the draft. Publish from the editor to show it to everyone.</Note>}
                </>
              ) : (
                <Note>Loading the dashboard…</Note>
              )}
            </>
          )}

          {data && mode === "meeting" && !data.meetings.available && <Callout tone="amber" icon={<AlertIcon size={14} width={2.2} />}>{NOT_APPLIED_LINE}</Callout>}

          {data && mode === "meeting" && data.meetings.available && (
            <>
              {data.meetings.list.map((m) => (
                <DestRow
                  key={m.id}
                  on={meeting === m.id}
                  title={m.name}
                  sub={`${shortDate(m.meetingDate, today)} · ${m.slideCount} slide${m.slideCount === 1 ? "" : "s"}`}
                  tag={last?.meetingId === m.id ? <span style={{ fontSize: 11, color: "var(--cc-blue)", fontWeight: 600 }}>Last used</span> : undefined}
                  onClick={() => {
                    setMeeting(m.id);
                    setSlide(null);
                  }}
                />
              ))}
              <DestRow on={meeting === "new"} title="+ New meeting" onClick={() => { setMeeting("new"); setSlide(null); }} />
              {meeting === "new" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto" }}>
                  <input
                    value={newMeeting.name}
                    onChange={(e) => setNewMeeting({ ...newMeeting, name: e.target.value })}
                    placeholder="Meeting name, e.g. Governors' curriculum committee"
                    aria-label="Meeting name"
                    style={FIELD}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--cc-label)" }}>
                    Date
                    <input type="date" min={today} value={newMeeting.date} onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })} style={FIELD} />
                  </label>
                </div>
              )}

              <Label style={{ marginTop: 4 }}>Which slide?</Label>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, flex: "0 0 auto" }}>
                {/* Latest slide first, as the board draws it: you're usually adding to the
                    slide you've just been building. */}
                {(meeting === "new" ? [] : meetingSlides)
                  .map((s, i) => ({ s, i }))
                  .reverse()
                  .map(({ s, i }) => (
                    <SlideChoice key={s.id} slide={s} on={slide === s.id} disabled={slideIsFull(s)} label={slideLabel(s, i)} onClick={() => setSlide(s.id)} />
                  ))}
                <SlideChoice slide={null} on={slide === "new" || meeting === "new"} label={meeting === "new" ? "Slide 1" : "New slide"} onClick={() => setSlide("new")} />
              </div>
              <Callout tone="blue" icon={<BarsGlyph />}>
                {(() => {
                  const b = meetingBanner(meeting === "new" ? [] : meetingSlides, meeting === "new" ? "new" : slide, kind);
                  return (
                    <>
                      {b.lead}
                      {b.strong && <strong>{b.strong}</strong>}
                      {b.tail}
                    </>
                  );
                })()}
              </Callout>
              <Note>
                The view goes in pinned{pinSummary(source.pinned) ? `: ${pinSummary(source.pinned)}` : ""}. You can drag to reorder or pick a different layout on the slide later.
              </Note>
            </>
          )}

          {error && <div style={{ fontSize: 12.5, color: "var(--cc-danger)", flex: "0 0 auto" }}>{error}</div>}
        </Body>
        <Footer>
          <SecondaryButton onClick={() => copy(false)} disabled={!canCopy || !!done}>
            {busy ? "Copying…" : "Copy and stay"}
          </SecondaryButton>
          <PrimaryButton onClick={() => copy(true)} disabled={!canCopy || !!done}>
            Copy and open
          </PrimaryButton>
        </Footer>
        </div>
      </Panel>
    </TeacherModal>
  );
}

// The cap triggers' errors and the rest, as one plain line (meeting-store's wording for
// meetings; the dashboard cap in the same voice).
function friendlyCopyError(e: unknown): string {
  const m = /personal dashboard limit reached \((\d+)\)/i.exec((e as { message?: string } | null)?.message ?? "");
  if (m) return `You already have ${m[1]} dashboards of your own, the most your account allows.`;
  return friendlyMeetingError(e);
}

const FIELD: CSSProperties = { border: "1px solid var(--cc-border2)", borderRadius: 8, background: "transparent", padding: "6px 10px", fontSize: 12.5, color: "var(--cc-ink)", fontFamily: "inherit" };

// The board's mini map of the destination: column titles in the dashboard's colour, each
// row's name and Time, one slot per panel (or empty cell), and "+ New row".
function SlotMapView({ config, target, onTarget }: { config: DashboardConfig; target: SlotTarget | null; onTarget: (t: SlotTarget) => void }) {
  const map = slotMap(config);
  const n = Math.max(1, map.columns.length);
  const accent = colourOf(config.colour).hex;
  const grid: CSSProperties = { display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: COPY_UI.mapGap };
  return (
    <div style={{ background: "var(--cpv-map-bg)", border: "1px solid var(--panel-border)", borderRadius: 10, padding: COPY_UI.mapPad, display: "flex", flexDirection: "column", gap: COPY_UI.mapGap, flex: "0 0 auto" }}>
      <div style={{ ...grid, fontSize: 10, fontWeight: 700, color: accent }}>
        {map.columns.map((c) => (
          <span key={c.id} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.title}
          </span>
        ))}
      </div>
      {map.rows.map((r) => (
        <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: COPY_UI.mapGap }}>
          <div style={{ fontSize: 9.5, color: "var(--cpv-slot-fg)", fontWeight: 600 }}>
            {r.name} · {TIME_WORDS[r.time]}
          </div>
          <div style={grid}>
            {r.cells.map((c) => {
              const t: SlotTarget = c.kind === "panel" ? { kind: "rail", panelId: c.panelId } : { kind: "empty", columnId: c.columnId, rowId: c.rowId };
              const on = sameTarget(t, target);
              return (
                <Slot key={c.kind === "panel" ? c.panelId : `${c.columnId}:${c.rowId}`} on={on} empty={c.kind === "empty"} span={c.kind === "panel" ? c.cols : 1} onClick={() => onTarget(t)}>
                  {on ? (c.kind === "panel" ? "Add to this panel's rail" : "Put it here") : c.kind === "panel" ? c.label : "Empty slot"}
                </Slot>
              );
            })}
          </div>
        </div>
      ))}
      <Slot on={target?.kind === "new-row"} empty onClick={() => onTarget({ kind: "new-row" })}>
        {target?.kind === "new-row" ? "In a new row" : "+ New row"}
      </Slot>
    </div>
  );
}

function Slot({ on, empty, span = 1, onClick, children }: { on: boolean; empty: boolean; span?: number; onClick: () => void; children: ReactNode }) {
  const style: CSSProperties = on
    ? { border: "2px solid var(--cpv-pick-border)", background: "var(--cpv-pick-bg)", color: "var(--cpv-pick-fg)", fontWeight: 700 }
    : empty
      ? { border: "1.5px dashed var(--cpv-slot-dash)", background: "transparent", color: "var(--cc-label)" }
      : { border: "1px solid var(--cpv-slot-border)", background: "var(--cpv-slot-bg)", color: "var(--cpv-slot-fg)" };
  const shape: CSSProperties = COPY_UI.slotShape === "unit" ? { aspectRatio: `${PANEL_UNIT.width} / ${PANEL_UNIT.height}` } : { height: COPY_UI.slotHeight };
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ ...shape, ...style, gridColumn: `span ${span}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, padding: "0 6px", textAlign: "center", lineHeight: 1.2, cursor: "pointer", boxSizing: "border-box", fontFamily: "inherit", overflow: "hidden" }}
    >
      {children}
    </button>
  );
}

// A slide in the picker (.slide): its real arrangement after the view arrives, the new
// cell dashed blue; a full slide can't be picked.
function SlideChoice({ slide, on, disabled = false, label, onClick }: { slide: SlideConfig | null; on: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  const w = COPY_UI.slideW;
  const h = COPY_UI.slideH;
  const base = slide ?? { layout: "auto" as const, slots: [] };
  const withNew = disabled ? base : { ...base, slots: [...base.slots, { id: "__new__" }] };
  const t = thumbRects(withNew, w - 4, h - 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", flex: "0 0 auto" }}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        style={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: 7,
          background: "var(--cpv-map-bg)",
          border: on ? "2px solid var(--cc-blue)" : `1px ${slide ? "solid" : "dashed"} var(--cpv-slot-border)`,
          boxSizing: "border-box",
          overflow: "hidden",
          cursor: disabled ? "not-allowed" : "pointer",
          padding: 0,
        }}
      >
        <i style={{ position: "absolute", left: t.title.x, top: t.title.y + 1, width: t.title.width * 0.6, height: Math.max(3, t.title.height), borderRadius: 2, background: "var(--cpv-slot-border)" }} />
        {t.cells.map((c, i) => {
          const s = c.slotIndex === null ? null : withNew.slots[c.slotIndex];
          const isNew = s?.id === "__new__";
          return (
            <i
              key={i}
              style={{
                position: "absolute",
                left: c.rect.x,
                top: c.rect.y,
                width: c.rect.width,
                height: c.rect.height,
                borderRadius: 3,
                boxSizing: "border-box",
                background: isNew ? "var(--cpv-new-bg)" : s ? "var(--cpv-slot-border)" : "transparent",
                border: isNew ? "1px dashed var(--cpv-new-border)" : s ? "none" : "1px dashed var(--cpv-slot-dash)",
              }}
            />
          );
        })}
      </button>
      <span style={{ fontSize: 10.5, color: on ? "var(--cc-blue)" : "var(--cc-sub)", fontWeight: on ? 700 : 400, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}
