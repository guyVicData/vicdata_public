"use client";

// 0.6 S1: the super-admin "Schools" screen (docs/wireframes/v0.6/Platform.dc.html), at
// /platform. Platform admins only: is_platform_admin() decides, and everyone else gets the
// same "not found" any unknown URL gets, so no school can tell the screen exists. Every
// power here runs through a SECURITY DEFINER RPC that re-checks is_platform_admin() and
// writes the audit log, so the client-side check only decides what is drawn.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ATTENTION_ACCENT, ATTENTION_INK, DELTA_NEGATIVE, accentOver, accentText } from "@/lib/teacher-view-theme";
import { TAG_COLOURS } from "@/lib/tag-colours";
import { sectorTag } from "@/lib/typology";
import { VISIBLE_ROLES_PROSE_ORDER, VISIBLE_ROLE_LABELS, normaliseRole, type VisibleRoleId } from "@/lib/roles";
import { LOOK_AS_ROLES } from "@/lib/look-as";
import type { TrialRole } from "@/lib/trial";
import { openViewAs } from "@/components/view-as/ViewAs";
import { useTeacherTheme, type Theme } from "@/components/teacher/TeacherChrome";
import { SearchBox, Switch } from "./AdminChrome";

export type SchoolOverviewRow = {
  school_urn: string;
  school_name: string | null;
  establishment_type_group: string | null;
  establishment_type: string | null;
  members: number;
  roles_in_use: string[] | null;
  has_admins: boolean;
  vc_sets_visible: number;
  vc_sets_total: number;
  school_admin_name: string | null;
  last_active: string | null;
};

const EBTN = "inline-flex items-center rounded-lg border border-[var(--edge-strong)] bg-[var(--panel-bg)] px-3 py-[7px] text-[12px] font-semibold text-[var(--chip-fg)] hover:border-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--edge-strong)]";
const HEADING = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted3)]";
const TH = `${HEADING} whitespace-nowrap border-b border-[var(--panel-border)] px-2.5 py-2 text-left`;
const TD = "border-b border-[var(--border)] p-2.5 text-[13px]";

function rolesInUse(row: SchoolOverviewRow): string {
  const set = new Set<VisibleRoleId>();
  for (const r of row.roles_in_use ?? []) {
    const n = normaliseRole(r);
    if (n === "teacher" || n === "smt" || n === "admissions") set.add(n);
  }
  if (row.has_admins) set.add("school_admin");
  const list = VISIBLE_ROLES_PROSE_ORDER.filter((r) => set.has(r)).map((r) => VISIBLE_ROLE_LABELS[r]);
  return list.length ? list.join(", ") : "—";
}

function lastActive(at: string | null): string {
  if (!at) return "Never";
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const vcOn = (row: SchoolOverviewRow) => row.vc_sets_total > 0 && row.vc_sets_visible === row.vc_sets_total;

function SectorPill({ row, theme }: { row: SchoolOverviewRow; theme: Theme }) {
  const tag = sectorTag(row.establishment_type_group, row.establishment_type);
  const colours = tag ? TAG_COLOURS[tag] : null;
  if (!tag || !colours) return <span className="text-[var(--muted2)]">—</span>;
  const [bg, fg] = colours[theme];
  return <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: bg, color: fg }}>{tag}</span>;
}

// Next's own 404 text, so the screen is indistinguishable from any unknown URL.
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

export function PlatformScreen() {
  const supabase = createBrowserSupabaseClient();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_platform_admin");
        setAllowed(!error && data === true);
      } catch {
        setAllowed(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (allowed === null) return <main className="flex-grow" />;
  if (!allowed) return <NotFound />;
  return <Platform />;
}

export function Platform() {
  const supabase = createBrowserSupabaseClient();
  const [theme] = useTeacherTheme();
  const [rows, setRows] = useState<SchoolOverviewRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("platform_school_overview");
    if (e) setError(e.message);
    setRows((data as SchoolOverviewRow[] | null) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (rows ?? []).filter((r) => !q || (r.school_name ?? "").toLowerCase().includes(q) || r.school_urn.includes(q)),
    [rows, q],
  );
  const selected = shown.find((r) => r.school_urn === selectedUrn) ?? shown[0] ?? null;

  async function setVc(row: SchoolOverviewRow, visible: boolean) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("platform_set_vc_visibility", { p_school_urn: row.school_urn, p_visible: visible });
    if (e) setError(e.message);
    await load();
    setBusy(false);
  }

  // 0.6 snag 4 (A): "Look at it as…" opens View as (the nav pill's popover) with this
  // school and role filled in -- the one mechanism; Start fresh and Open are there.
  function lookAs(row: SchoolOverviewRow, role: VisibleRoleId) {
    setError(null);
    openViewAs({ urn: row.school_urn, name: row.school_name ?? row.school_urn, role: role as TrialRole });
  }

  return (
    <main id="teacher-root" data-theme={theme} className="leading-[1.2] flex w-full flex-grow flex-col gap-3.5 bg-[var(--bg)] px-6 py-5 text-[var(--fg)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full px-[9px] py-[3px] text-[10.5px] font-extrabold tracking-[0.08em]" style={{ background: ATTENTION_ACCENT.hex, color: ATTENTION_INK }}>
          SUPER-ADMIN
        </span>
        <h1 className="text-[18px] font-bold">Schools</h1>
        <span className="flex-grow" />
        <SearchBox value={query} onChange={setQuery} placeholder="Search schools" className="w-[282px] max-w-full rounded-lg px-2.5 py-[7px]" />
        <Link href="/platform/catalogue" className={EBTN}>Catalogue</Link>
        <button type="button" disabled title="Night 2" className={EBTN}>Planned views &amp; requests</button>
      </div>

      {error && <p role="alert" className="text-[12px]" style={{ color: accentText(DELTA_NEGATIVE) }}>{error}</p>}

      <div className="flex min-h-0 flex-col gap-5 lg:flex-grow lg:flex-row">
        <div className="min-w-0 flex-grow overflow-x-auto rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>School</th>
                <th className={TH}>Sector</th>
                <th className={TH}>Members</th>
                <th className={TH}>Roles in use</th>
                <th className={TH}>VC sets</th>
                <th className={TH}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr><td colSpan={6} className={`${TD} text-[var(--muted2)]`}>Loading…</td></tr>
              )}
              {rows !== null && shown.length === 0 && (
                <tr><td colSpan={6} className={`${TD} text-[var(--muted2)]`}>{q ? "No school matches that search." : "No school accounts yet."}</td></tr>
              )}
              {shown.map((r) => {
                const sel = selected?.school_urn === r.school_urn;
                const cell = (extra: string, children: ReactNode) => (
                  <td className={`${TD} ${extra}`} style={sel ? { background: accentOver(ATTENTION_ACCENT.hex, 6, "var(--panel-bg)") } : undefined}>{children}</td>
                );
                return (
                  <tr
                    key={r.school_urn}
                    onClick={() => setSelectedUrn(r.school_urn)}
                    aria-selected={sel}
                    className="cursor-pointer hover:[&>td]:bg-[var(--box-bg)]"
                  >
                    {cell("font-bold", r.school_name ?? r.school_urn)}
                    {cell("", <SectorPill row={r} theme={theme} />)}
                    {cell("tabular-nums", r.members)}
                    {cell("text-[var(--muted2)]", rolesInUse(r))}
                    {cell("", (
                      <Switch
                        on={vcOn(r)}
                        disabled={busy || r.vc_sets_total === 0}
                        label={`Victoria Consultancy sets visible at ${r.school_name ?? r.school_urn}`}
                        title={r.vc_sets_total === 0 ? "No VC sets yet" : undefined}
                        onChange={(next) => setVc(r, next)}
                      />
                    ))}
                    {cell("whitespace-nowrap text-[var(--muted2)]", lastActive(r.last_active))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 374 and (above) 282: the board's 340 and 260 are content-box widths, plus its
            padding and border, so these are the sizes it actually renders at. */}
        {selected && (
          <aside
            className="flex w-full shrink-0 flex-col gap-3 rounded-xl border bg-[var(--panel-bg)] p-4 lg:w-[374px]"
            style={{ borderColor: accentOver(ATTENTION_ACCENT.hex, 27) }}
          >
            <div className="text-[16px] font-bold">{selected.school_name ?? selected.school_urn}</div>
            <div className="text-[12px] text-[var(--muted2)]">School-Admin: {selected.school_admin_name ?? "none yet"}</div>

            <div className={HEADING}>Switches for this school</div>
            <div className="flex items-center gap-2.5 text-[13px]">
              <Switch
                on={vcOn(selected)}
                disabled={busy || selected.vc_sets_total === 0}
                label="Victoria Consultancy sets visible"
                title={selected.vc_sets_total === 0 ? "No VC sets yet" : undefined}
                onChange={(next) => setVc(selected, next)}
              />
              <span>Victoria Consultancy sets visible</span>
              {selected.vc_sets_total === 0 && <span className="text-[12px] text-[var(--muted2)]">No VC sets yet</span>}
            </div>

            <div className={`${HEADING} mt-1`}>Look at it as&hellip;</div>
            <div className="flex flex-wrap gap-1.5">
              {LOOK_AS_ROLES.map((role) => (
                <button key={role} type="button" onClick={() => lookAs(selected, role)} className={EBTN}>
                  {VISIBLE_ROLE_LABELS[role]}
                </button>
              ))}
            </div>
            <div className="text-[11.5px] leading-[1.45] text-[var(--muted2)]">
              Opens View as with this school and role filled in: their home page as a member with that one role. It saves as that member, never as you, and is logged.
            </div>

            <div className={`${HEADING} mt-1`}>Dashboards here</div>
            {/* TODO(0.6 S2): real counts once the dashboards table exists. Every school
                gets the four VicData Teacher dashboards; nothing else exists yet. */}
            <div className="text-[12.5px] leading-[1.6]">VicData: 4 &middot; School-shared: 0 &middot; Personal: 0</div>
          </aside>
        )}
      </div>
    </main>
  );
}
