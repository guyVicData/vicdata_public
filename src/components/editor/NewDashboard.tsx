"use client";

// /dashboards/new (VicData 0.6 S5): New dashboard in four steps (docs/wireframes/v0.6/
// New1-New4), in the onboarding tour's frame (TourFrame, below):
//   1. name, start from (blank / copy a dashboard), main data, colour
//   2. layout preset (1, 2, 3, 4, 2:1, 1:2, 1:1:2, custom), when a row opens, linked
//   3. each column's data and compared-to (Change: Steps 1-2 of Add a view)
//   4. here's what you'll get -> createDashboard -> the editor
// Owner: a super-admin saves to VicData dashboards or their own; everyone else to their
// own (the database's cap trigger enforces G9 and its error is shown).
import { getActiveTrial } from "@/lib/trial";
import { TrialBanner } from "@/components/trial/TrialBanner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dataviewById } from "@/catalogue";
import { DASHBOARDS } from "@/catalogue/dashboards";
import { DATA_LABEL, FOCUS_LABEL, PHASE_LABEL, settingsOf, type PickPanelContext } from "@/catalogue/pick";
import type { DashboardConfig } from "@/catalogue/types";
import { railGlyph } from "@/components/chooser-v06/bits";
import { COLUMN_ICON_PATHS } from "@/components/teacher/DashboardColumn";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { createDashboard, isMissingTable, listDashboards, loadDashboard, type DashboardRow } from "@/lib/dashboards-store";
import { DASHBOARD_COLOURS, accentInk, accentVars, colourHex, colourValue } from "@/lib/editor-layout";
import * as ops from "@/lib/editor-ops";
import { ContextStepsDialog, contextFromColumn } from "./ContextSteps";
import { DashboardEditor, friendlyCreateError } from "./DashboardEditor";
import { usePlatformAdmin } from "./EditorScreen";

// ------------------------------------------------------------------------ the frame

// The onboarding tour's frame (src/app/teacher/[phase]/page.tsx, GCSE/Post-16 Step 1-4):
// the same root, back link, accent step label, heading, intro and full-width accent
// button, class for class. It lives inline in that page, which S5 doesn't own, so this is
// a faithful copy rather than an import (logged for extraction).
export function TourFrame({
  theme,
  accent,
  label,
  heading,
  intro,
  back,
  next,
  nextDisabled,
  onNext,
  children,
}: {
  theme: "dark" | "light";
  accent: string;
  label: string;
  heading: string;
  intro: string;
  back: { href: string } | { onClick: () => void };
  next: string;
  nextDisabled?: boolean;
  onNext: () => void;
  children: ReactNode;
}) {
  return (
    <main id="teacher-root" data-theme={theme} style={accentVars(accent)} className="mx-auto flex w-full max-w-2xl flex-col gap-4 bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6">
      {/* 0.6 snag 4: View as makes this the member's New dashboard, so it says so. */}
      <TrialBanner className="" />
      {"href" in back ? (
        <Link href={back.href} className="w-fit text-[12.5px] text-[var(--muted)]">
          &larr; Back
        </Link>
      ) : (
        <button type="button" onClick={back.onClick} className="w-fit text-[12.5px] text-[var(--muted)]">
          &larr; Back
        </button>
      )}
      <div>
        <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">{label}</p>
        <h1 className="mt-1.5 text-xl font-bold leading-tight">{heading}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted2)]">{intro}</p>
      </div>
      {children}
      <button type="button" disabled={nextDisabled} onClick={onNext} className="mt-2 rounded-[10px] bg-[var(--accent)] p-[13px] text-center text-[14.5px] font-bold disabled:opacity-40" style={{ color: accentInk(accent) }}>
        {next}
      </button>
    </main>
  );
}

const SectionLabel = ({ children }: { children: ReactNode }) => <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)]">{children}</div>;

const card = "rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]";

// ------------------------------------------------------------------------ icons

const G = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const MAIN_ICON: Record<ops.MainData, ReactNode> = {
  ks4: <><path d="M22 10v6" /><path d="M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
  ks5: <><path d="M22 10v6" /><path d="M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
  rolls: <><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M10 21v-6h4v6" /></>,
  social: <><circle cx="12" cy="10" r="3" /><path d="M12 21c-4-4-7-7.5-7-11a7 7 0 0 1 14 0c0 3.5-3 7-7 11z" /></>,
};
const MAIN_COLOUR: Record<ops.MainData, string> = { ks4: DASHBOARD_COLOURS[0].hex, ks5: DASHBOARD_COLOURS[1].hex, rolls: DASHBOARD_COLOURS[2].hex, social: DASHBOARD_COLOURS[3].hex };

const NUM = ["no", "One", "Two", "Three", "Four", "Five", "Six"];

function mainOf(config: DashboardConfig): ops.MainData {
  const d = config.columns[0]?.data;
  if (!d) return "ks4";
  if (d.data === "rolls") return "rolls";
  if (d.data === "social.births") return "social";
  return d.phase;
}

// "Rolls · whole school" / "Social context · Live births · Surrey" (New 3's Data line).
function dataLine(col: ops.NewColumn): string {
  const fam = col.data.data === "social.births" ? "Social context · Live births" : col.data.data === "rolls" ? "Rolls" : `${PHASE_LABEL[col.data.phase]} ${DATA_LABEL[col.data.data].toLowerCase()}`;
  const focus = col.focus.kind === "subject" ? (col.focus.subject?.mode === "always" ? col.focus.subject.subject : "the subject chips") : FOCUS_LABEL[col.focus.kind].toLowerCase();
  return `${fam} · ${focus}`;
}

// ------------------------------------------------------------------------ screen

export function NewDashboardScreen() {
  const admin = usePlatformAdmin();
  const [theme] = useTeacherTheme();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    createBrowserSupabaseClient()
      .auth.getUser()
      .then(({ data }) => setSignedIn(!!data.user))
      .catch(() => setSignedIn(false));
  }, []);
  if (admin === null || signedIn === null) return <main className="flex-grow" />;
  if (!signedIn)
    return (
      <main id="teacher-root" data-theme={theme} className="mx-auto flex w-full max-w-2xl flex-col gap-4 bg-[var(--bg)] p-6 text-[var(--fg)]">
        <p className="text-[14px] text-[var(--muted)]">
          <Link href="/login" className="font-semibold text-[var(--fg)] underline">
            Sign in
          </Link>{" "}
          to make a dashboard.
        </p>
      </main>
    );
  // Viewing as a member (View as), this is the member's New dashboard: personal only.
  return <NewDashboard superAdmin={admin && !getActiveTrial()} theme={theme} />;
}

export function NewDashboard({ superAdmin, theme, initialStep = 0, initial }: { superAdmin: boolean; theme: "dark" | "light"; initialStep?: number; initial?: { name?: string; main?: ops.MainData } }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState(initial?.name ?? "");
  const [owner, setOwner] = useState<"vicdata" | "user">(superAdmin ? "vicdata" : "user");
  const [startFrom, setStartFrom] = useState<"blank" | "copy">("blank");
  const [sources, setSources] = useState<DashboardRow[] | null>(null);
  const [source, setSource] = useState<DashboardConfig | null>(null);
  const [main, setMain] = useState<ops.MainData>(initial?.main ?? "ks4");
  const [hex, setHex] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>("3");
  const [customCols, setCustomCols] = useState(3);
  const [rows, setRows] = useState(2);
  const [accordion, setAccordion] = useState<DashboardConfig["layout"]["accordion"]>("auto-close");
  const [group, setGroup] = useState<{ id: string; label: string } | null>(null);
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [rawColumns, setColumns] = useState<ops.NewColumn[]>(() => ops.defaultColumns(initial?.main ?? "ks4", 3));
  const [editing, setEditing] = useState<{ index: number; startAt: "data" | "focus"; ctx: PickPanelContext } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<DashboardConfig | null>(null);

  const accent = hex ?? MAIN_COLOUR[main];
  const tracks = useMemo(() => (preset === "custom" ? Array.from({ length: customCols }, () => 1) : ops.LAYOUT_PRESETS.find((p) => p.id === preset)!.tracks), [preset, customCols]);
  const groups = [...new Map(DASHBOARDS.filter((d) => d.group).map((d) => [d.group!.id, { id: d.group!.id, label: d.group!.label }])).values()];

  // Columns follow the layout's count: kept as set, new ones from the main data's defaults.
  const columns = useMemo(() => (rawColumns.length === tracks.length ? rawColumns : ops.defaultColumns(main, tracks.length).map((b, i) => rawColumns[i] ?? b)), [rawColumns, tracks.length, main]);

  useEffect(() => {
    if (startFrom !== "copy" || sources) return;
    listDashboards(supabase, { kind: "dashboard" })
      .then((r) => setSources(r.rows))
      .catch(() => setSources([]));
  }, [startFrom, sources, supabase]);

  const pickMain = (m: ops.MainData) => {
    setMain(m);
    setColumns(ops.defaultColumns(m, tracks.length));
  };

  const pickSource = async (r: DashboardRow) => {
    const l = await loadDashboard(supabase, r.slug ?? r.id, false);
    if (!l) return;
    const c = l.config;
    setSource(c);
    if (!name.trim()) setName(`${c.name} (copy)`);
    setMain(mainOf(c));
    setHex(colourHex(c.colour));
    const p = ops.presetFor(c.layout.tracks);
    setPreset(p);
    if (p === "custom") setCustomCols(c.columns.length);
    setRows(c.rows.length);
    setAccordion(c.layout.accordion);
    setColumns(c.columns.map((col) => ({ title: col.title, icon: col.icon, data: col.data, focus: col.focus, compare: col.compare })));
  };

  const groupValue = useMemo(
    () => (newGroup?.trim() ? { id: `group.${newGroup.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: newGroup.trim(), order: 0 } : group ? { ...group, order: 99 } : undefined),
    [newGroup, group],
  );

  const built = useMemo<DashboardConfig | null>(() => {
    const id = `${owner}.${(name.trim() || "dashboard").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
    try {
      if (startFrom === "copy" && source && source.columns.length === tracks.length) {
        let c = ops.copyAsNew(source, id, name, owner);
        c = ops.updateSettings(c, { colour: colourValue(accent), accordion, group: groupValue });
        c.layout = { ...c.layout, tracks: [...tracks], preset: ops.presetFor(tracks) };
        c.columns = c.columns.map((col, i) => ({ ...col, title: columns[i].title, icon: columns[i].icon, data: columns[i].data, focus: columns[i].focus, compare: columns[i].compare }));
        return c;
      }
      return ops.newDashboardConfig({ id, name, owner, main, colour: colourValue(accent), tracks, rows, accordion, group: groupValue, columns });
    } catch {
      return null;
    }
  }, [owner, name, startFrom, source, tracks, accent, accordion, groupValue, columns, main, rows]);

  const finish = async () => {
    if (!built) return;
    setBusy(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id ?? null;
      const row = await createDashboard(supabase, { kind: "dashboard", owner_scope: owner, name: built.name, owner_profile_id: owner === "user" ? uid : null, config: built });
      router.push(superAdmin ? `/dashboards/${row.id}/edit` : `/dashboards/${row.id}`);
    } catch (e) {
      if (isMissingTable(e as { code?: string; message?: string })) setOffline(built);
      else setError(friendlyCreateError(e));
    } finally {
      setBusy(false);
    }
  };

  if (offline) {
    const row: DashboardRow = { id: offline.id, slug: null, kind: "dashboard", owner_scope: owner, school_account_id: null, owner_profile_id: null, name: offline.name, group_id: null, group_order: 0, meeting_date: null, published_version_id: null, created_at: "", updated_at: "" };
    return <DashboardEditor loaded={{ available: false, row, config: offline, version: null, draft: null }} superAdmin={superAdmin} />;
  }

  const back = step === 0 ? { href: "/dashboards" } : { onClick: () => setStep(step - 1) };
  const go = (n: number) => {
    setStep(n);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };
  const label = `New dashboard · Step ${step + 1} of 4`;

  // ------------------------------------------------------------------ step 1
  if (step === 0) {
    const others = DASHBOARD_COLOURS.filter((c) => c.hex !== MAIN_COLOUR[main]);
    return (
      <TourFrame
        theme={theme}
        accent={accent}
        label={label}
        heading="What's this dashboard about?"
        intro="Name it, start blank or from a copy, and pick its main data. The main data sets its colour and the default for every column."
        back={back}
        next="Next — choose a layout"
        nextDisabled={!name.trim() || (startFrom === "copy" && !source)}
        onNext={() => go(1)}
      >
        <label className="flex flex-col gap-1.5">
          <SectionLabel>Name</SectionLabel>
          <input
            type="text"
            value={name}
            placeholder="Admissions overview"
            onChange={(e) => setName(e.target.value)}
            className="rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 py-[11px] text-[14px] text-[var(--fg)] outline-none"
          />
        </label>

        <div className="flex flex-col gap-2">
          <SectionLabel>Start from</SectionLabel>
          <div className="flex gap-2">
            {(["blank", "copy"] as const).map((s) => (
              <ChoiceButton key={s} on={startFrom === s} onClick={() => setStartFrom(s)}>
                {s === "blank" ? "Blank" : "Copy a dashboard…"}
              </ChoiceButton>
            ))}
          </div>
          {startFrom === "copy" && (
            <div className={`${card} flex max-h-56 flex-col gap-0.5 overflow-y-auto p-1.5`}>
              {sources === null && <p className="p-2 text-[12.5px] text-[var(--muted2)]">Loading…</p>}
              {sources?.length === 0 && <p className="p-2 text-[12.5px] text-[var(--muted2)]">No dashboards to copy yet.</p>}
              {sources?.map((r) => {
                const on = source?.id === (r.slug ?? r.id) || source?.id === r.id;
                return (
                  <button key={r.id} type="button" aria-pressed={on} onClick={() => pickSource(r)} className={`rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold ${on ? "bg-[rgba(var(--accent-rgb),0.12)] text-[var(--fg)]" : "text-[var(--chip-fg)] hover:bg-[var(--box-bg)]"}`}>
                    {r.name}
                    <span className="ml-1.5 text-[11.5px] font-medium text-[var(--muted3)]">{r.owner_scope === "vicdata" ? "VicData" : r.owner_scope === "school" ? "School" : "Mine"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {superAdmin && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Save to</SectionLabel>
            <div className="flex gap-2">
              <ChoiceButton on={owner === "vicdata"} onClick={() => setOwner("vicdata")}>
                VicData dashboards
              </ChoiceButton>
              <ChoiceButton on={owner === "user"} onClick={() => setOwner("user")}>
                My dashboards
              </ChoiceButton>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <SectionLabel>Main data</SectionLabel>
          {ops.MAIN_DATA.map((m) => {
            const on = m.id === main;
            const c = MAIN_COLOUR[m.id];
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickMain(m.id)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left"
                style={{ border: on ? `1.5px solid ${accent}` : "1px solid var(--panel-border)", background: on ? `color-mix(in srgb, ${accent} 10%, var(--bg))` : "var(--panel-bg)" }}
              >
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
                  <G>{MAIN_ICON[m.id]}</G>
                </span>
                <span className="flex-grow">
                  <span className="block text-[14px] font-bold">{m.label}</span>
                  <span className="mt-px block text-[12px] text-[var(--muted2)]">{m.sub}</span>
                </span>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={on ? { background: accent } : { border: "1.5px solid var(--edge-strong)" }}>
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>
            Colour <span className="font-medium normal-case tracking-normal">&mdash; follows main data unless you change it</span>
          </SectionLabel>
          <div className="flex items-center gap-2.5">
            <Swatch hex={MAIN_COLOUR[main]} big={accent === MAIN_COLOUR[main]} label={`${ops.MAIN_DATA.find((m) => m.id === main)!.label} colour (default)`} onClick={() => setHex(null)} />
            <span className="h-5 w-px bg-[var(--panel-border2)]" />
            {others.map((c) => (
              <Swatch key={c.id} hex={c.hex} big={accent === c.hex} label={`${c.label} colour`} onClick={() => setHex(c.hex)} />
            ))}
          </div>
        </div>
      </TourFrame>
    );
  }

  // ------------------------------------------------------------------ step 2
  if (step === 1) {
    return (
      <TourFrame
        theme={theme}
        accent={accent}
        label={label}
        heading="How should it be laid out?"
        intro="Columns run down the page, each with its own data. You can add rows, and change any of this later."
        back={back}
        next="Next — set up your columns"
        onNext={() => go(2)}
      >
        <div className="grid grid-cols-4 gap-2">
          {[...ops.LAYOUT_PRESETS, { id: "custom" as const, tracks: [] as number[], label: "Custom" }].map((p) => {
            const on = preset === p.id;
            const custom = p.id === "custom";
            return (
              <button
                key={p.id}
                type="button"
                aria-label={custom ? "Custom" : `${p.label} column${p.tracks.length === 1 ? "" : "s"}`}
                aria-pressed={on}
                onClick={() => setPreset(p.id)}
                className="flex flex-col items-center gap-1.5 rounded-[10px] px-1.5 pb-2 pt-2.5"
                style={{
                  border: on ? `1.5px solid ${accent}` : custom ? "1px dashed var(--edge-strong)" : "1px solid var(--panel-border)",
                  background: on ? `color-mix(in srgb, ${accent} 10%, var(--bg))` : custom ? "transparent" : "var(--panel-bg)",
                  color: on ? accent : "var(--muted2)",
                }}
              >
                <span className="flex h-[34px] w-[52px] items-center justify-center gap-[3px]">
                  {custom ? (
                    <G>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </G>
                  ) : (
                    p.tracks.map((w, i) => <span key={i} className="h-full rounded-[3px]" style={{ flex: `${w} 1 0`, background: on ? accent : "var(--edge-strong)" }} />)
                  )}
                </span>
                <span className="text-[11px]" style={{ fontWeight: on ? 700 : 600 }}>
                  {p.label}
                  {p.id === "3" ? " · today's" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className={`${card} flex flex-col gap-2.5 px-3.5 py-3`}>
          <SectionLabel>Custom &mdash; columns, then rows</SectionLabel>
          <div className="flex gap-3.5">
            <Stepper
              label="Columns"
              value={preset === "custom" ? customCols : tracks.length}
              min={1}
              max={4}
              onChange={(v) => {
                setPreset("custom");
                setCustomCols(v);
              }}
            />
            <Stepper label="Rows" value={rows} min={1} max={6} onChange={setRows} />
          </div>
          <p className="text-[12px] text-[var(--muted3)]">Max 4 columns. Rows can later span columns, like an email editor.</p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>When a row opens</SectionLabel>
          <div className="flex overflow-hidden rounded-[10px] border border-[var(--panel-border2)]">
            {(
              [
                ["auto-close", "Close the others"],
                ["independent", "Leave them open"],
              ] as const
            ).map(([id, l]) => (
              <button key={id} type="button" aria-pressed={accordion === id} onClick={() => setAccordion(id)} className="flex-1 px-2 py-[9px] text-[12.5px]" style={accordion === id ? { background: "var(--fg)", color: "var(--bg)", fontWeight: 700 } : { color: "var(--muted2)", fontWeight: 600 }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Link with other dashboards</SectionLabel>
          <div className={`${card} flex flex-col gap-2.5 px-3.5 py-3`}>
            <p className="text-[13px] leading-snug text-[var(--chip-fg)]">Linked dashboards share a switcher in the top bar, like Candidates&nbsp;&#8644;&nbsp;Results.</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={!group && newGroup === null} onClick={() => { setGroup(null); setNewGroup(null); }}>
                On its own
              </Chip>
              {groups.map((g) => (
                <Chip key={g.id} on={group?.id === g.id && newGroup === null} onClick={() => { setGroup(g); setNewGroup(null); }}>
                  Join &ldquo;{g.label}&rdquo;
                </Chip>
              ))}
              <Chip on={newGroup !== null} onClick={() => setNewGroup("")}>
                + New group
              </Chip>
            </div>
            {newGroup !== null && (
              <input type="text" autoFocus placeholder="Group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 py-2 text-[13px] text-[var(--fg)] outline-none" />
            )}
          </div>
        </div>
      </TourFrame>
    );
  }

  // ------------------------------------------------------------------ step 3
  if (step === 2) {
    return (
        <TourFrame
          theme={theme}
          accent={accent}
          label={label}
          heading="What does each column show?"
          intro="Every panel in a column starts from these, so its views compare like with like. Any panel can override them later."
          back={back}
          next="Next — see what you'll get"
          nextDisabled={!built}
          onNext={() => go(3)}
        >
          {columns.map((col, i) => {
            const open = (startAt: "data" | "focus") => setEditing({ index: i, startAt, ctx: contextFromColumn({ ...col, id: `c${i + 1}` }, { dashboard: name || "New dashboard", row: "Any row" }) });
            return (
              <div key={i} className={`${card} flex flex-col gap-2.5 px-3.5 py-3`}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent)]">
                    <G size={16}>{COLUMN_ICON_PATHS[col.icon]}</G>
                  </span>
                  <input
                    type="text"
                    value={col.title}
                    aria-label={`Column ${i + 1} title`}
                    onChange={(e) => setColumns(columns.map((c, j) => (j === i ? { ...c, title: e.target.value } : c)))}
                    className="min-w-0 flex-grow border-0 border-b border-dashed border-[var(--edge-strong)] bg-transparent py-0.5 text-[15px] font-bold text-[var(--fg)] outline-none"
                  />
                  <span className="text-[11px] text-[var(--muted3)]">Col {i + 1}</span>
                </div>
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[82px] shrink-0 text-[var(--muted3)]">Data</span>
                  <span className="flex-grow text-[var(--chip-fg)]">{dataLine(col)}</span>
                  <button type="button" onClick={() => open("data")} className="font-semibold text-[var(--accent)]">
                    Change
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[82px] shrink-0 text-[var(--muted3)]">Compared to</span>
                  {col.compare?.kinds.length ? <span className="flex-grow text-[var(--chip-fg)]">{ops.compareText(col.compare).replace(/^./, (c) => c.toUpperCase())}</span> : <span className="flex-grow italic text-[var(--muted3)]">Nothing</span>}
                  <button type="button" onClick={() => open("focus")} className="font-semibold text-[var(--accent)]">
                    {col.compare?.kinds.length ? "Change" : "Add"}
                  </button>
                </div>
              </div>
            );
          })}
          <p className="text-[12px] leading-snug text-[var(--muted3)]">&ldquo;Change&rdquo; opens steps 1&ndash;2 of the view chooser; &ldquo;Compared to&rdquo; opens its comparison step.</p>
          {editing && (
            <ContextStepsDialog
              original={editing.ctx}
              superAdmin={superAdmin}
              startAt={editing.startAt}
              theme={theme}
              onClose={() => setEditing(null)}
              onDone={(ctx) => {
                const sameData = ctx.data === editing.ctx.data && ctx.phase === editing.ctx.phase && ctx.results === editing.ctx.results;
                const settings = settingsOf(ctx);
                setColumns(columns.map((c, j) => (j === editing.index ? { ...c, data: sameData ? c.data : settings.data, focus: settings.focus, compare: settings.compare } : c)));
                setEditing(null);
              }}
            />
          )}
        </TourFrame>
    );
  }

  // ------------------------------------------------------------------ step 4
  const n = tracks.length;
  const anyViews = !!built?.panels.some((p) => p.dataviews.length);
  return (
    <TourFrame
      theme={theme}
      accent={accent}
      label={label}
      heading="Here's your dashboard"
      intro={`${NUM[n] ?? n} column${n === 1 ? "" : "s"}, ${(NUM[rows] ?? String(rows)).toLowerCase()} row${rows === 1 ? "" : "s"} to start. ${anyViews ? "Each panel opens with one view; add more with + on its rail." : "Nothing is built for this data yet, so panels start empty: plan them with + on each rail."}`}
      back={back}
      next={busy ? "Making it…" : "Done — open it to edit"}
      nextDisabled={busy || !built}
      onNext={finish}
    >
      {built && <MiniMap config={built} />}
      <div className="flex flex-col gap-2.5">
        {columns.map((col, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3.5">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent)]">
              <G size={20}>{COLUMN_ICON_PATHS[col.icon]}</G>
            </span>
            <div className="min-w-0 flex-grow">
              <p className="text-[15px] font-bold">{col.title || `Column ${i + 1}`}</p>
              <p className="mt-0.5 text-[13px] text-[var(--muted2)]">{ops.columnQuestion(col)}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12px] leading-snug text-[var(--muted3)]">The question under each column is written for you from its data and comparison. You can edit it on the dashboard.</p>
      {error && (
        <p role="alert" className="text-[12.5px] text-[#f87171]">
          {error}
        </p>
      )}
    </TourFrame>
  );
}

function MiniMap({ config }: { config: DashboardConfig }) {
  const cols = `repeat(${config.columns.length}, minmax(0, 1fr))`;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--panel-border)] bg-[var(--box-bg)] p-2.5">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: cols }}>
        {config.columns.map((c) => (
          <div key={c.id} className="truncate text-[10.5px] font-bold text-[var(--accent)]">
            {c.title}
          </div>
        ))}
      </div>
      {config.rows.map((r) => (
        <div key={r.id} className="flex flex-col gap-1.5">
          <div className="text-[10px] font-semibold text-[var(--muted3)]">{r.name} &#9662;</div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: cols }}>
            {config.columns.map((c) => {
              const p = config.panels.find((x) => x.row === r.id && x.column === c.id);
              const v = p?.dataviews[0];
              const dv = v?.kind === "view" ? dataviewById(v.dataview) : undefined;
              return (
                <div key={c.id} className="ed-mini flex h-[54px] items-center justify-center rounded-[7px] border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--accent)]" title={dv?.label}>
                  {dv ? railGlyph(dv.railIcon) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <style>{`.ed-mini svg{width:18px;height:18px}`}</style>
    </div>
  );
}

function ChoiceButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="flex-1 rounded-[10px] p-2.5 text-[13px]"
      style={on ? { border: "1.5px solid var(--fg)", background: "color-mix(in srgb, var(--fg) 6%, var(--bg))", color: "var(--fg)", fontWeight: 700 } : { border: "1px solid var(--panel-border2)", background: "transparent", color: "var(--muted2)", fontWeight: 600 }}
    >
      {children}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="rounded-full px-3 py-[5px] text-[12px]" style={on ? { border: "1px solid var(--fg)", background: "var(--fg)", color: "var(--bg)", fontWeight: 700 } : { border: "1px solid var(--panel-border2)", color: "var(--chip-fg)", fontWeight: 600 }}>
      {children}
    </button>
  );
}

function Swatch({ hex, big, label, onClick }: { hex: string; big: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-pressed={big} onClick={onClick} className="rounded-full" style={{ width: big ? 30 : 24, height: big ? 30 : 24, background: hex, border: big ? "2px solid var(--fg)" : "none" }} />;
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      {label}
      <span className="inline-flex items-center rounded-full border border-[var(--panel-border2)]">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="h-7 w-7 text-[var(--muted2)] disabled:opacity-40">
          &minus;
        </button>
        <span className="min-w-[14px] text-center font-bold">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="h-7 w-7 text-[var(--muted2)] disabled:opacity-40">
          +
        </button>
      </span>
    </div>
  );
}
