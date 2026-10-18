"use client";

// VicData 0.8 notes and feedback (decision 4): the feedback inbox, /platform/feedback, platform admins
// only. Two tabs:
//   * Items: every item, newest first, filtered by status, type, priority, product, dashboard, school
//     and author; each opens to everything it recorded, its Open link (the view as it was), and its
//     triage (type, priority, status with a planned version / commit / reason, duplicate of, a note).
//     Ticked items take a bulk status change, or "Copy as Markdown" for the to-do list.
//   * Coverage: for proofing -- every view of every VicData dashboard, and per school or group whether
//     it has been checked ("Looks good"), has open feedback, or is unseen (feedback_coverage).
// Reads and writes go through /api/platform/feedback, as the caller (RLS and the triage guard apply).
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { ATTENTION_ACCENT, ATTENTION_INK } from "@/lib/teacher-view-theme";
import { DASHBOARDS } from "@/catalogue/dashboards";
import { dataviewById } from "@/catalogue/dataviews";
import {
  FEEDBACK_APPLIES,
  FEEDBACK_AREAS,
  FEEDBACK_IMPORTANCE,
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_SCOPE,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_WHERE,
  isPageKey,
  pageKey,
  feedbackOpenHref,
  parseFeedbackNumber,
  type FeedbackStatus,
} from "@/lib/view-ref";

export type TriageRow = {
  ref: string;
  number: number;
  id: string;
  created_london: string;
  created_at: string;
  author_name: string;
  author_id: string | null;
  view_as: boolean;
  role: string | null;
  product: string;
  school_or_group: string | null;
  school_urn: string | null;
  group_id: string | null;
  group_ref: string | null;
  dashboard_id: string;
  dashboard_name: string | null;
  dashboard_version_id: string | null;
  panel_id: string | null;
  panel_name: string | null;
  view_instance_id: string | null;
  dataview_id: string | null;
  view_label: string | null;
  view_key: string;
  // 0.8 SMT feedback round 2 (section 6): a page item's areas (absent before the migration is applied).
  area?: string[];
  state: Record<string, unknown>;
  page_path: string | null;
  page_query: string | null;
  app_version: string | null;
  device: string | null;
  viewport_width: number | null;
  theme: string | null;
  body: string;
  looks_good: boolean;
  kinds: string[];
  importance: string | null;
  scope: string | null;
  applies_to: string | null;
  saw: string | null;
  expected: string | null;
  where_in_view: string[];
  type: string | null;
  priority: string | null;
  status: FeedbackStatus;
  planned_version: string | null;
  resolved_commit: string | null;
  resolved_at: string | null;
  wont_do_reason: string | null;
  duplicate_of_ref: string | null;
  duplicate_of: string | null;
  triage_note: string | null;
  is_open: boolean;
};

type CoverageRow = { dashboard_id: string; dashboard_name: string | null; panel_id: string | null; view_instance_id: string | null; view_label: string | null; view_key: string; scope_id: string; scope_name: string | null; state: "open" | "looks good" | "none"; last_looks_good_at: string | null; last_open_at: string | null; items: number; open_items: number };

const labelOf = (list: readonly { id: string; label: string }[], id: string | null) => list.find((x) => x.id === id)?.label ?? id ?? "";
const label = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted3)]";
const btn = "rounded-lg border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-[6px] text-xs font-semibold text-[var(--fg)] disabled:opacity-40";
const field = "rounded-md border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 py-1 text-[12px]";

async function api(path: string, init?: RequestInit) {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  const res = await fetch(path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" } });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, json };
}

/** Section 6: an item about a whole page (no panel; its key "page:…"). */
export const isPageItem = (r: Pick<TriageRow, "panel_id" | "view_key">) => !r.panel_id || isPageKey(r.view_key);
const areasOf = (r: Pick<TriageRow, "area">) => (r.area ?? []).map((a) => labelOf(FEEDBACK_AREAS, a)).join(", ");

/** One item as Markdown, for the to-do list (docs/FEEDBACK.md). */
export function itemMarkdown(r: TriageRow, origin = ""): string {
  const triage = [r.type ? FEEDBACK_TYPE_LABEL[r.type as keyof typeof FEEDBACK_TYPE_LABEL] : null, r.priority, `${FEEDBACK_STATUS_LABEL[r.status]}${r.status === "planned" && r.planned_version ? ` (${r.planned_version})` : ""}${r.status === "done" && r.resolved_commit ? ` (${r.resolved_commit})` : ""}`].filter(Boolean).join(" · ");
  const hints = [r.kinds.map((k) => labelOf(FEEDBACK_KINDS, k)).join(", "), labelOf(FEEDBACK_IMPORTANCE, r.importance), labelOf(FEEDBACK_SCOPE, r.scope), labelOf(FEEDBACK_APPLIES, r.applies_to), r.where_in_view.length ? `where: ${r.where_in_view.map((w) => labelOf(FEEDBACK_WHERE, w)).join(", ")}` : "", areasOf(r) ? `area: ${areasOf(r)}` : ""].filter(Boolean).join(" · ");
  const state = Object.entries(r.state ?? {}).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}=${String(v)}`).join(", ");
  const href = feedbackOpenHref(r);
  const page = isPageItem(r);
  const lines = [
    `### ${r.ref} · ${triage}`,
    `- **When:** ${r.created_london} · ${r.author_name}${r.view_as ? ` (View as ${r.role ?? ""})` : ""} · ${r.device ?? ""}${r.theme ? `, ${r.theme}` : ""} · app ${r.app_version ?? "?"}`,
    `- **Where:** ${r.product} · ${r.dashboard_name ?? r.dashboard_id} › ${page ? "Page" : `${r.panel_name ? `${r.panel_name} › ` : ""}${r.view_label ?? r.view_instance_id ?? ""}${r.dataview_id ? ` (${r.dataview_id})` : ""}`} · ${r.school_or_group ?? ""} (${r.school_urn ?? r.group_id ?? ""})`,
    state ? `- **State:** ${state}` : "",
    hints ? `- **Author's hints:** ${hints}` : "",
    r.saw || r.expected ? `- **Figure:** I see ${r.saw ?? "?"} · I expected ${r.expected ?? "?"}` : "",
    r.body.trim() ? `- **Text:** ${r.body.trim().replace(/\n+/g, " / ")}` : r.looks_good ? "- **Text:** Looks good" : "",
    r.duplicate_of_ref ? `- **Duplicate of:** ${r.duplicate_of_ref}` : "",
    r.triage_note ? `- **Triage note:** ${r.triage_note}` : "",
    r.wont_do_reason ? `- **Won't do:** ${r.wont_do_reason}` : "",
    href ? `- **Open:** ${origin}${href}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

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

export function FeedbackInboxScreen() {
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
  return <Inbox />;
}

// `kind`: section 6's page items, or view items, or both.
type Filters = { status: string[]; type: string; priority: string; product: string; dashboard: string; school: string; author: string; hideLooksGood: boolean; q: string; kind: string };
const NO_FILTERS: Filters = { status: ["new", "triaged", "planned"], type: "", priority: "", product: "", dashboard: "", school: "", author: "", hideLooksGood: false, q: "", kind: "" };

function Inbox() {
  const [theme] = useTeacherTheme();
  const [tab, setTab] = useState<"items" | "coverage">("items");
  const [rows, setRows] = useState<TriageRow[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Read on opening, and again after each triage save (`tick`).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await api("/api/platform/feedback");
      if (!live) return;
      if (!r.ok) return setError(String(r.json?.error ?? "Could not read the feedback."));
      setMissing(r.json?.missing === true);
      setRows((r.json?.items as TriageRow[]) ?? []);
    })();
    return () => {
      live = false;
    };
  }, [tick]);

  const options = useMemo(() => {
    const all = rows ?? [];
    const uniq = (xs: [string, string][]) => Array.from(new Map(xs).entries()).sort((a, b) => a[1].localeCompare(b[1]));
    return {
      product: uniq(all.map((r) => [r.product, r.product])),
      dashboard: uniq(all.map((r) => [r.dashboard_id, r.dashboard_name ?? r.dashboard_id])),
      school: uniq(all.map((r) => [r.school_urn ?? r.group_id ?? "", r.school_or_group ?? r.school_urn ?? r.group_id ?? ""])),
      author: uniq(all.map((r) => [r.author_id ?? "", r.author_name])),
    };
  }, [rows]);

  const shown = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const n = parseFeedbackNumber(q);
    return (rows ?? []).filter(
      (r) =>
        (n !== null ? r.number === n : true) &&
        (filters.status.length === 0 || filters.status.includes(r.status)) &&
        (!filters.type || r.type === filters.type) &&
        (!filters.priority || r.priority === filters.priority) &&
        (!filters.product || r.product === filters.product) &&
        (!filters.dashboard || r.dashboard_id === filters.dashboard) &&
        (!filters.school || (r.school_urn ?? r.group_id) === filters.school) &&
        (!filters.author || r.author_id === filters.author) &&
        (!filters.hideLooksGood || r.is_open || !r.looks_good) &&
        (!filters.kind || (filters.kind === "page") === isPageItem(r)) &&
        (!q || n !== null || `${r.body} ${r.view_label} ${r.dashboard_name} ${r.school_or_group} ${r.triage_note ?? ""}`.toLowerCase().includes(q)),
    );
  }, [rows, filters]);

  const patch = async (ids: string[], body: Record<string, unknown>) => {
    const r = await api("/api/platform/feedback", { method: "PATCH", body: JSON.stringify({ ids, ...body }) });
    if (!r.ok) {
      setNotice(String(r.json?.error ?? "Could not save."));
      return false;
    }
    setNotice(`Saved ${ids.length} item${ids.length === 1 ? "" : "s"}.`);
    setTick((t) => t + 1);
    return true;
  };

  const copyMarkdown = async () => {
    const list = shown.filter((r) => picked.size === 0 || picked.has(r.id));
    const md = list.map((r) => itemMarkdown(r, window.location.origin)).join("\n\n");
    try {
      await navigator.clipboard.writeText(md);
      setNotice(`Copied ${list.length} item${list.length === 1 ? "" : "s"} as Markdown.`);
    } catch {
      setNotice("The clipboard isn't available here.");
    }
  };

  const [bulk, setBulk] = useState<{ status: FeedbackStatus; planned: string; reason: string; commit: string }>({ status: "triaged", planned: "", reason: "", commit: "" });
  const sel = Array.from(picked).filter((id) => shown.some((r) => r.id === id));

  return (
    <main id="teacher-root" data-theme={theme} className="flex min-h-screen flex-col gap-3.5 bg-[var(--bg)] px-6 py-5 text-[var(--fg)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full px-[9px] py-[3px] text-[10.5px] font-extrabold tracking-[0.08em]" style={{ background: ATTENTION_ACCENT.hex, color: ATTENTION_INK }}>SUPER-ADMIN</span>
        <h1 className="text-lg font-bold">Feedback</h1>
        <span className="text-[12px] text-[var(--muted2)]">{rows ? `${rows.length} item${rows.length === 1 ? "" : "s"}` : "Loading…"}</span>
        <span className="flex-grow" />
        <Link href="/platform" className="text-[12.5px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
          ← Platform
        </Link>
      </div>
      <div role="tablist" className="flex gap-4 border-b border-[var(--panel-border)]">
        {(["items", "coverage"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`border-b-2 px-0.5 py-2 text-[13px] font-bold ${tab === t ? "border-[var(--fg)]" : "border-transparent text-[var(--muted2)]"}`}>
            {t === "items" ? "Items" : "Coverage"}
          </button>
        ))}
      </div>
      {missing && <p className="rounded-md border border-dashed border-[var(--panel-border2)] p-3 text-[12.5px] text-[var(--muted2)]">The feedback tables aren&rsquo;t on this database yet (20261117100000_v08_feedback).</p>}
      {error && <p className="text-[12.5px] text-red-600">{error}</p>}
      {notice && <p role="status" className="text-[12px] font-semibold text-[var(--muted)]">{notice}</p>}
      {tab === "coverage" ? (
        <Coverage />
      ) : (
        <>
          <section data-fb-filters="" className="flex flex-wrap items-end gap-2 rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
            <div className="flex flex-col gap-1">
              <span className={label}>Status</span>
              <div className="flex flex-wrap gap-1">
                {FEEDBACK_STATUSES.map((s) => {
                  const on = filters.status.includes(s);
                  return (
                    <button key={s} type="button" aria-pressed={on} onClick={() => setFilters({ ...filters, status: on ? filters.status.filter((x) => x !== s) : [...filters.status, s] })} className={`rounded-full border px-2 py-[3px] text-[11.5px] font-semibold ${on ? "border-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--muted)]"}`}>
                      {FEEDBACK_STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>
            <Select label="Type" value={filters.type} onChange={(type) => setFilters({ ...filters, type })} options={FEEDBACK_TYPES.map((t) => [t, FEEDBACK_TYPE_LABEL[t]])} />
            <Select label="Priority" value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })} options={FEEDBACK_PRIORITIES.map((p) => [p, p])} />
            <Select label="Product" value={filters.product} onChange={(product) => setFilters({ ...filters, product })} options={options.product} />
            <Select label="Dashboard" value={filters.dashboard} onChange={(dashboard) => setFilters({ ...filters, dashboard })} options={options.dashboard} />
            <Select label="School or group" value={filters.school} onChange={(school) => setFilters({ ...filters, school })} options={options.school} />
            <Select label="Author" value={filters.author} onChange={(author) => setFilters({ ...filters, author })} options={options.author} />
            <Select label="Items" value={filters.kind} onChange={(kind) => setFilters({ ...filters, kind })} options={[["page", "Pages"], ["view", "Views"]]} />
            <label className="flex flex-col gap-1">
              <span className={label}>Search or F-number</span>
              <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className={field} placeholder="F-12, or words" />
            </label>
            <label className="flex items-center gap-1.5 text-[12px]">
              <input type="checkbox" checked={filters.hideLooksGood} onChange={(e) => setFilters({ ...filters, hideLooksGood: e.target.checked })} />
              Hide bare &ldquo;Looks good&rdquo;
            </label>
            <button type="button" className={btn} onClick={() => setFilters(NO_FILTERS)}>
              Reset
            </button>
          </section>
          <section className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-[var(--muted2)]">{sel.length ? `${sel.length} ticked` : `${shown.length} shown`}</span>
            <button type="button" className={btn} onClick={copyMarkdown} data-fb-copy="">
              Copy as Markdown{sel.length ? "" : " (all shown)"}
            </button>
            <span className="mx-1 h-4 w-px bg-[var(--panel-border2)]" />
            <span className={label}>Set ticked to</span>
            <select value={bulk.status} onChange={(e) => setBulk({ ...bulk, status: e.target.value as FeedbackStatus })} className={field} aria-label="Bulk status">
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {bulk.status === "planned" && <input value={bulk.planned} onChange={(e) => setBulk({ ...bulk, planned: e.target.value })} placeholder="version, e.g. 0.85" className={field} aria-label="Planned version" />}
            {bulk.status === "done" && <input value={bulk.commit} onChange={(e) => setBulk({ ...bulk, commit: e.target.value })} placeholder="commit" className={field} aria-label="Resolved commit" />}
            {bulk.status === "wont_do" && <input value={bulk.reason} onChange={(e) => setBulk({ ...bulk, reason: e.target.value })} placeholder="reason" className={field} aria-label="Won't do reason" />}
            <button
              type="button"
              className={btn}
              disabled={!sel.length}
              onClick={async () => {
                const body: Record<string, unknown> = { status: bulk.status };
                if (bulk.status === "planned") body.planned_version = bulk.planned;
                if (bulk.status === "done" && bulk.commit) body.resolved_commit = bulk.commit;
                if (bulk.status === "wont_do") body.wont_do_reason = bulk.reason;
                if (await patch(sel, body)) setPicked(new Set());
              }}
            >
              Apply
            </button>
          </section>
          <div className="overflow-x-auto rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-bg)]">
            <table data-fb-inbox="" className="w-full border-collapse text-left text-[12px]">
              <thead className="text-[var(--muted2)]">
                <tr className="border-b border-[var(--panel-border)]">
                  <th className="w-8 p-2">
                    <input type="checkbox" aria-label="Tick all shown" checked={shown.length > 0 && shown.every((r) => picked.has(r.id))} onChange={(e) => setPicked(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())} />
                  </th>
                  <th className="p-2">Item</th>
                  <th className="p-2">When</th>
                  <th className="p-2">View</th>
                  <th className="p-2">School or group</th>
                  <th className="p-2">What</th>
                  <th className="p-2">Triage</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <ItemRow key={r.id} r={r} picked={picked.has(r.id)} onPick={(on) => setPicked((p) => { const n = new Set(p); if (on) n.add(r.id); else n.delete(r.id); return n; })} open={openId === r.id} onOpen={() => setOpenId(openId === r.id ? null : r.id)} rows={rows ?? []} onPatch={(body) => patch([r.id], body)} />
                ))}
                {rows && !shown.length && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-[var(--muted3)]">
                      Nothing here with these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function Select({ label: l, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={label}>{l}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">Any</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

function ItemRow({ r, picked, onPick, open, onOpen, rows, onPatch }: { r: TriageRow; picked: boolean; onPick: (on: boolean) => void; open: boolean; onOpen: () => void; rows: TriageRow[]; onPatch: (b: Record<string, unknown>) => Promise<boolean> }) {
  const what = r.body.trim() ? r.body.trim().slice(0, 120) : r.looks_good ? "Looks good" : "";
  return (
    <>
      <tr data-fb-row={r.ref} className={`border-b border-[var(--panel-border)] align-top ${open ? "bg-[var(--box-bg)]" : ""}`}>
        <td className="p-2">
          <input type="checkbox" aria-label={`Tick ${r.ref}`} checked={picked} onChange={(e) => onPick(e.target.checked)} />
        </td>
        <td className="p-2">
          <button type="button" onClick={onOpen} className="font-bold underline-offset-2 hover:underline">
            {r.ref}
          </button>
          {r.is_open ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[var(--fb-open)]" title="Open" /> : r.looks_good ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[var(--fb-good)]" title="Looks good" /> : null}
        </td>
        <td className="whitespace-nowrap p-2 text-[var(--muted2)]">
          {r.created_london}
          <div className="text-[11px]">{r.author_name}{r.view_as ? ` · View as ${r.role ?? ""}` : ""}</div>
        </td>
        <td className="p-2">
          <div className="font-semibold" data-fb-row-kind={isPageItem(r) ? "page" : "view"}>{isPageItem(r) ? "Page" : (r.view_label ?? r.view_instance_id)}</div>
          <div className="text-[11px] text-[var(--muted2)]">{r.product} · {r.dashboard_name ?? r.dashboard_id}</div>
        </td>
        <td className="p-2">{r.school_or_group}</td>
        <td className="p-2">
          <div>{what}</div>
          <div className="text-[11px] text-[var(--muted2)]">{r.kinds.map((k) => labelOf(FEEDBACK_KINDS, k)).join(", ")}</div>
        </td>
        <td className="whitespace-nowrap p-2">
          <div className="font-semibold">{FEEDBACK_STATUS_LABEL[r.status]}{r.status === "planned" && r.planned_version ? ` · ${r.planned_version}` : ""}</div>
          <div className="text-[11px] text-[var(--muted2)]">{[r.type ? FEEDBACK_TYPE_LABEL[r.type as keyof typeof FEEDBACK_TYPE_LABEL] : null, r.priority].filter(Boolean).join(" · ")}</div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-[var(--panel-border)] bg-[var(--box-bg)]">
          <td />
          <td colSpan={6} className="p-3">
            <ItemDetail r={r} rows={rows} onPatch={onPatch} />
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ k, children }: { k: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-[12px]">
      <span className="text-[var(--muted2)]">{k}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function ItemDetail({ r, rows, onPatch }: { r: TriageRow; rows: TriageRow[]; onPatch: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [t, setT] = useState({ type: r.type ?? "", priority: r.priority ?? "", status: r.status, planned_version: r.planned_version ?? "", resolved_commit: r.resolved_commit ?? "", wont_do_reason: r.wont_do_reason ?? "", duplicate: r.duplicate_of_ref ?? "", triage_note: r.triage_note ?? "" });
  const href = feedbackOpenHref(r);
  const dup = parseFeedbackNumber(t.duplicate);
  const dupRow = dup !== null ? rows.find((x) => x.number === dup) : null;
  const dvLabel = r.dataview_id ? dataviewById(r.dataview_id as never)?.label : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Detail k="Text">{r.body.trim() ? <span className="whitespace-pre-wrap">{r.body}</span> : r.looks_good ? "Looks good" : null}</Detail>
        <Detail k="Author's hints">{[r.kinds.map((k) => labelOf(FEEDBACK_KINDS, k)).join(", "), labelOf(FEEDBACK_IMPORTANCE, r.importance), labelOf(FEEDBACK_SCOPE, r.scope), labelOf(FEEDBACK_APPLIES, r.applies_to)].filter(Boolean).join(" · ")}</Detail>
        <Detail k="Where in the view">{r.where_in_view.map((w) => labelOf(FEEDBACK_WHERE, w)).join(", ")}</Detail>
        <Detail k="Area">{areasOf(r) || null}</Detail>
        <Detail k="I see / I expected">{r.saw || r.expected ? `${r.saw ?? "?"} / ${r.expected ?? "?"}` : null}</Detail>
        <Detail k="Who">{`${r.author_name}${r.view_as ? ` · View as ${r.role ?? ""}` : r.role ? ` · ${r.role}` : ""}`}</Detail>
        <Detail k="School or group">{`${r.school_or_group ?? ""} (${r.school_urn ?? r.group_id ?? ""})`}</Detail>
        <Detail k="Dashboard">{`${r.dashboard_name ?? ""} · ${r.dashboard_id}${r.dashboard_version_id ? ` · version ${r.dashboard_version_id}` : " · code copy"}`}</Detail>
        <Detail k="Panel and view">{isPageItem(r) ? "Page (the whole page)" : `${r.panel_name ?? ""} ${r.panel_id ?? ""} › ${r.view_label ?? ""} ${r.view_instance_id ?? ""}${r.dataview_id ? ` (${r.dataview_id}${dvLabel ? `, ${dvLabel}` : ""})` : ""}`}</Detail>
        <Detail k="State">{Object.entries(r.state ?? {}).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</Detail>
        <Detail k="Page">{`${r.page_path ?? ""}${r.page_query ? `?${r.page_query}` : ""}`}</Detail>
        <Detail k="Device">{`${r.device ?? ""} ${r.viewport_width ?? ""}px · ${r.theme ?? ""} · app ${r.app_version ?? ""}`}</Detail>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" data-fb-open-link="" className="mt-1 self-start rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--panel-bg)]">
            Open the view as it was
          </a>
        )}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await onPatch({
            type: t.type || null,
            priority: t.priority || null,
            status: t.status,
            planned_version: t.planned_version || null,
            resolved_commit: t.resolved_commit || null,
            wont_do_reason: t.wont_do_reason || null,
            duplicate_of: dupRow?.id ?? null,
            triage_note: t.triage_note || null,
          });
        }}
      >
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1">
            <span className={label}>Type</span>
            <select value={t.type} onChange={(e) => setT({ ...t, type: e.target.value })} className={field}>
              <option value="">—</option>
              {FEEDBACK_TYPES.map((x) => (
                <option key={x} value={x}>
                  {FEEDBACK_TYPE_LABEL[x]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Priority</span>
            <select value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value })} className={field}>
              <option value="">—</option>
              {FEEDBACK_PRIORITIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Status</span>
            <select value={t.status} onChange={(e) => setT({ ...t, status: e.target.value as FeedbackStatus })} className={field}>
              {FEEDBACK_STATUSES.map((x) => (
                <option key={x} value={x}>
                  {FEEDBACK_STATUS_LABEL[x]}
                </option>
              ))}
            </select>
          </label>
          {t.status === "planned" && (
            <label className="flex flex-col gap-1">
              <span className={label}>Planned version</span>
              <input value={t.planned_version} onChange={(e) => setT({ ...t, planned_version: e.target.value })} placeholder="0.85" className={field} />
            </label>
          )}
          {t.status === "done" && (
            <label className="flex flex-col gap-1">
              <span className={label}>Commit</span>
              <input value={t.resolved_commit} onChange={(e) => setT({ ...t, resolved_commit: e.target.value })} placeholder="abc1234" className={field} />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className={label}>Duplicate of</span>
            <input value={t.duplicate} onChange={(e) => setT({ ...t, duplicate: e.target.value })} placeholder="F-3" className={`${field} w-20`} />
          </label>
        </div>
        {t.duplicate && !dupRow && <p className="text-[11.5px] text-red-600">No item {t.duplicate} here.</p>}
        {t.status === "wont_do" && (
          <label className="flex flex-col gap-1">
            <span className={label}>Why not</span>
            <input value={t.wont_do_reason} onChange={(e) => setT({ ...t, wont_do_reason: e.target.value })} className={field} />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={label}>Triage note</span>
          <textarea value={t.triage_note} onChange={(e) => setT({ ...t, triage_note: e.target.value })} rows={3} className={field} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className={btn}>
            Save triage
          </button>
          <button type="button" className={btn} onClick={() => navigator.clipboard?.writeText(itemMarkdown(r, window.location.origin))}>
            Copy as Markdown
          </button>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------------------------ coverage

function Coverage() {
  const [rows, setRows] = useState<CoverageRow[] | null>(null);
  const [scope, setScope] = useState("");
  useEffect(() => {
    (async () => {
      const r = await api("/api/platform/feedback?coverage=1");
      setRows((r.json?.rows as CoverageRow[]) ?? []);
    })();
  }, []);
  const scopes = useMemo(() => Array.from(new Map((rows ?? []).map((r) => [r.scope_id, r.scope_name ?? r.scope_id])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  // Every view of every VicData dashboard (the catalogue's configs), then any other dashboard that has
  // feedback (group dashboards, custom dashboards, meetings).
  const known = DASHBOARDS.map((d) => ({
    id: d.id,
    name: d.name,
    // Section 6: the page itself first, counted apart from its views.
    views: [{ key: pageKey(d.id), panel: "the whole page", label: "Page", page: true }, ...d.panels.flatMap((p) => p.dataviews.flatMap((v) => (v.kind === "view" ? [{ key: `${d.id}:${p.id}:${v.id}`, panel: p.name ?? p.id, label: dataviewById(v.dataview)?.label ?? v.dataview, page: false }] : [])))],
  }));
  const extra = Array.from(new Set((rows ?? []).map((r) => r.dashboard_id))).filter((id) => !known.some((k) => k.id === id));
  const dashboards = [
    ...known,
    ...extra.map((id) => {
      const mine = (rows ?? []).filter((r) => r.dashboard_id === id);
      return { id, name: mine[0]?.dashboard_name ?? id, views: Array.from(new Map(mine.map((r) => [r.view_key, { key: r.view_key, panel: isPageKey(r.view_key) ? "the whole page" : (r.panel_id ?? ""), label: isPageKey(r.view_key) ? "Page" : (r.view_label ?? r.view_instance_id ?? ""), page: isPageKey(r.view_key) }])).values()) };
    }),
  ];
  const at = (key: string) => (rows ?? []).filter((r) => r.view_key === key && (!scope || r.scope_id === scope));
  const total = dashboards.reduce((n, d) => n + d.views.filter((v) => !v.page).length, 0);
  const seen = dashboards.reduce((n, d) => n + d.views.filter((v) => !v.page && at(v.key).length > 0).length, 0);
  const pages = dashboards.reduce((n, d) => n + d.views.filter((v) => v.page).length, 0);
  const pagesSeen = dashboards.reduce((n, d) => n + d.views.filter((v) => v.page && at(v.key).length > 0).length, 0);
  return (
    <section data-fb-coverage="" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="School or group" value={scope} onChange={setScope} options={scopes} />
        <p className="text-[12px] text-[var(--muted2)]">
          {seen} of {total} views, and {pagesSeen} of {pages} pages, have feedback{scope ? " at this school or group" : ""}; the rest are unseen.
          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--fb-good)]" /> looks good
          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--fb-open)]" /> open
          <span className="ml-2 inline-block h-2 w-2 rounded-full border border-[var(--panel-border2)]" /> unseen
        </p>
      </div>
      {dashboards.map((d) => (
        <div key={d.id} className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
          <h2 className="text-[13px] font-bold">
            {d.name} <span className="font-normal text-[var(--muted3)]">{d.id}</span>
          </h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {d.views.map((v) => {
              const here = at(v.key);
              const st = here.some((r) => r.state === "open") ? "open" : here.some((r) => r.state === "looks good") ? "good" : here.length ? "none" : "unseen";
              return (
                <li key={v.key} data-fb-cov={st} className="flex items-start gap-1.5 text-[12px]">
                  <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${st === "open" ? "bg-[var(--fb-open)]" : st === "good" ? "bg-[var(--fb-good)]" : st === "none" ? "bg-[var(--muted3)]" : "border border-[var(--panel-border2)]"}`} />
                  <span>
                    {v.label} <span className="text-[var(--muted3)]">· {v.panel}</span>
                    {here.length > 0 && <span className="block text-[11px] text-[var(--muted2)]">{here.map((r) => `${r.scope_name ?? r.scope_id}: ${r.state}${r.last_looks_good_at ? `, checked ${r.last_looks_good_at.slice(0, 10)}` : ""}`).join(" · ")}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
