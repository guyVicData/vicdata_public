"use client";

// VicData 0.8 sets round 1 (B6, B7, G26; R-SET-PILL): the one set selector, on Teacher, SMT and
// Admissions. The label is plain text outside the button ("Compared against", or "Feeder schools"
// on Pipelines); the button holds only the set -- an accent border, the name in bold, its number of
// schools beside it -- so it never looks like a filter pill. Its menu is always three blocks in this
// order: Default (no heading), School sets (each row tagged with its creator), My sets ("n of 8");
// the current set ticked and every row's count shown; then Edit this set…, New set…, Manage sets
// (to the library, with this page as it stands as its way back: returnTo).
// Up to LIMIT pinned school sets and LIMIT recently used personal sets show, then "All … (n)…".
// On a phone the label sits above a full-width button (the count always visible) and the menu is a
// bottom sheet: a drag handle, the same blocks, the actions pinned at the bottom; Esc, the handle or
// a tap outside closes it. Each product supplies the rows; this draws them, nothing else.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { CreatorKind, SetKind } from "@/lib/sets/model";
import { manageHrefHere } from "@/lib/sets/editor-return";

export type SetMenuRow = {
  key: string;
  name: string;
  count: number | null;
  creator: CreatorKind;
  /** The creator's name where it isn't the role's (the school's group, by its own name). */
  creatorLabel?: string;
  /** Feeder sets: how many are Main feeders. */
  main?: number;
  title?: string;
  pinned?: boolean;
  lastUsedAt?: string | null;
};

export type SetMenuAction = { label: string; onClick: () => void; title?: string; disabled?: boolean };

export type SetSelectorProps = {
  label: string;
  kind: SetKind;
  current: { name: string; count: number | null; main?: number } | null;
  rows: { default: SetMenuRow[]; school: SetMenuRow[]; mine: SetMenuRow[] };
  mine: { active: number; cap: number } | null;
  selectedKey: string | null;
  onPick: (row: SetMenuRow) => void;
  onEdit?: SetMenuAction | null;
  onNew?: SetMenuAction | null;
  manageHref?: string | null;
  /** The school, so Manage sets opens the library on it with this page as the way back (returnTo). */
  manageUrn?: string | null;
  /** More default rows that open something rather than pick (Teacher's rankings, "Schools in…"). */
  extraDefault?: SetMenuAction[];
  /** A fixed button width (Teacher's Comparisons column): long names truncate, the full name on hover. */
  width?: number;
  phone?: boolean;
  loading?: boolean;
  /** Open on first render (the rule tests render the menu on the server). */
  defaultOpen?: boolean;
};

export const SET_MENU_LIMIT = 5;

const CREATOR_WORD: Record<CreatorKind, string> = { default: "Default", admissions: "Admissions", smt: "SMT", school_admin: "School-Admin", group: "Group", victoria_consultancy: "Victoria Consultancy", me: "Me" };
const CREATOR_TOKEN: Record<CreatorKind, string> = { default: "default", admissions: "admissions", smt: "smt", school_admin: "smt", group: "group", victoria_consultancy: "vc", me: "me" };

/** A creator's colour as CSS: its text/icon colour and its fill (Me: an outline in --fg). */
export function creatorColours(c: CreatorKind): { fg: string; bg: string; border: string } {
  const t = CREATOR_TOKEN[c];
  if (t === "me") return { fg: "var(--fg)", bg: "transparent", border: "var(--panel-border2)" };
  return { fg: `var(--set-${t}-fg)`, bg: `var(--set-${t}-bg)`, border: `var(--set-${t}-bg)` };
}

export function CreatorPill({ creator, label }: { creator: CreatorKind; label?: string }) {
  const c = creatorColours(creator);
  return (
    <span data-set-creator={creator} className="inline-flex shrink-0 items-center rounded-full border px-[7px] py-[1px] text-[10.5px] font-semibold leading-[16px]" style={{ color: c.fg, background: c.bg, borderColor: c.border }}>
      {label ?? CREATOR_WORD[creator]}
    </span>
  );
}

/** The kinds' icons (B21, from the design files): bars for Compared against, streams joining for
 * Feeder schools; they take the creator's colour (currentColor). */
export function KindIcon({ kind, size = 16, stroke = 2 }: { kind: SetKind; size?: number; stroke?: number }) {
  return (
    <svg data-set-kind={kind} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" aria-hidden="true">
      {kind === "compared_against" ? (
        <>
          <path d="M6 20V10" />
          <path d="M12 20V4" />
          <path d="M18 20v-7" />
        </>
      ) : (
        <>
          <path d="M3 6c5 0 6 6 9 6" />
          <path d="M3 18c5 0 6-6 9-6" />
          <path d="M12 12h9" />
          <path d="M18 9l3 3-3 3" />
        </>
      )}
    </svg>
  );
}

/** "28 schools · 6 main" (feeders with tiers), else "10 schools". */
export const countWords = (count: number | null, main?: number) => (count === null ? "…" : `${count} school${count === 1 ? "" : "s"}${main ? ` · ${main} main` : ""}`);

/** The panel header's words for the set in use (B10, R-PANEL-NAMES-SET): "against 10 nearest |
 * independent · 10", or on Pipelines "Day | all sectors · 28 · 6 main". */
export const setHeaderWords = (kind: SetKind, s: { name: string; count: number | null; main?: number }) =>
  kind === "feeders" ? `${s.name} · ${s.count ?? "…"}${s.main ? ` · ${s.main} main` : ""}` : `against ${s.name} · ${s.count ?? "…"}`;

/** The panel header's line naming the set: wraps onto a second line on a phone, never truncating the
 * set's name (G30). */
export function SetHeaderLine({ kind, set }: { kind: SetKind; set: { name: string; count: number | null; main?: number } | null }) {
  if (!set) return null;
  return (
    <span data-set-header={kind} className="inline-flex max-w-full flex-wrap items-start gap-x-1 whitespace-normal break-words text-[11.5px] leading-snug text-[var(--muted2)]">
      <span className="mt-[2px] shrink-0"><KindIcon kind={kind} size={12} /></span>
      <span className="min-w-0">{setHeaderWords(kind, set)}</span>
    </span>
  );
}

function sortSchool(rows: SetMenuRow[]): SetMenuRow[] {
  return [...rows].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
}
function sortMine(rows: SetMenuRow[]): SetMenuRow[] {
  return [...rows].sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""));
}

export function SetSelector(p: SetSelectorProps) {
  const [open, setOpen] = useState(!!p.defaultOpen);
  const [all, setAll] = useState<{ school: boolean; mine: boolean }>({ school: false, mine: false });
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!p.phone && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, p.phone]);
  const school = useMemo(() => sortSchool(p.rows.school), [p.rows.school]);
  const mine = useMemo(() => sortMine(p.rows.mine), [p.rows.mine]);
  const pinned = school.filter((r) => r.pinned);
  const schoolShown = all.school ? school : (pinned.length ? pinned : school).slice(0, SET_MENU_LIMIT);
  const mineShown = all.mine ? mine : mine.slice(0, SET_MENU_LIMIT);
  const pick = (r: SetMenuRow) => {
    setOpen(false);
    p.onPick(r);
  };
  const act = (a: SetMenuAction) => () => {
    setOpen(false);
    a.onClick();
  };
  const name = p.current?.name ?? (p.loading ? "Loading…" : "Choose a set");
  const count = p.current ? (p.current.count ?? "…") : "";
  const rowH = p.phone ? "min-h-[44px]" : "min-h-[34px]";

  const row = (r: SetMenuRow, tag: boolean) => {
    const on = r.key === p.selectedKey;
    return (
      <button
        key={r.key}
        type="button"
        role="menuitemradio"
        aria-checked={on}
        data-set-row={r.key}
        title={r.title ?? r.name}
        onClick={() => pick(r)}
        className={`flex w-full items-center gap-2 rounded-[8px] px-3 py-[6px] text-left text-[12.5px] hover:bg-[var(--box-bg)] ${rowH} ${on ? "font-semibold" : ""}`}
      >
        <span aria-hidden="true" className="w-[14px] shrink-0 text-[var(--accent,var(--fg))]">{on ? "✓" : ""}</span>
        <span className="min-w-0 flex-1 truncate">{r.name}</span>
        {tag && <CreatorPill creator={r.creator} label={r.creatorLabel} />}
        <span className="shrink-0 tabular-nums text-[11.5px] text-[var(--muted2)]">{r.count ?? "…"}{r.main ? ` · ${r.main} main` : ""}</span>
      </button>
    );
  };
  const heading = (t: ReactNode) => <div className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">{t}</div>;
  const more = (n: number, which: "school" | "mine", word: string) =>
    n > (which === "school" ? schoolShown.length : mineShown.length) && !all[which] ? (
      <button type="button" data-set-more={which} onClick={() => setAll((a) => ({ ...a, [which]: true }))} className={`w-full px-3 py-[6px] text-left text-[12px] font-semibold text-[var(--accent-text,var(--fg))] ${rowH}`}>
        {word} ({n})&hellip;
      </button>
    ) : null;
  const actionBtn = (a: SetMenuAction | null | undefined) =>
    a ? (
      <button key={a.label} type="button" role="menuitem" disabled={a.disabled} title={a.title} onClick={act(a)} className={`w-full rounded-[8px] px-3 py-[6px] text-left text-[12.5px] hover:bg-[var(--box-bg)] disabled:opacity-50 ${rowH}`}>
        {a.label}
      </button>
    ) : null;

  const blocks = (
    <>
      <div data-set-block="default" role="group" aria-label="Default sets">
        {p.rows.default.map((r) => row(r, false))}
        {(p.extraDefault ?? []).map((a) => actionBtn(a))}
      </div>
      <div data-set-block="school" role="group" aria-label="School sets" className="mt-1 border-t border-[var(--panel-border)] pt-1">
        {heading("School sets")}
        {school.length ? schoolShown.map((r) => row(r, true)) : <div className="px-3 py-1 text-[12px] text-[var(--muted2)]">None yet.</div>}
        {more(school.length, "school", "All school sets")}
      </div>
      <div data-set-block="mine" role="group" aria-label="My sets" className="mt-1 border-t border-[var(--panel-border)] pt-1">
        {heading(
          <>
            My sets{p.mine ? <span className="ml-1 font-semibold normal-case tracking-normal">{p.mine.active} of {p.mine.cap}</span> : null}
          </>,
        )}
        {mine.length ? mineShown.map((r) => row(r, false)) : <div className="px-3 py-1 text-[12px] text-[var(--muted2)]">None yet.</div>}
        {more(mine.length, "mine", "All my sets")}
      </div>
    </>
  );
  const actions = (
    <div data-set-actions="" className="border-t border-[var(--panel-border)] pt-1">
      {actionBtn(p.onEdit)}
      {actionBtn(p.onNew)}
      {p.manageHref ? (
        <a href={manageHrefHere(p.manageHref, p.manageUrn)} role="menuitem" className={`flex w-full items-center rounded-[8px] px-3 py-[6px] text-left text-[12.5px] hover:bg-[var(--box-bg)] ${rowH}`}>
          Manage sets
        </a>
      ) : null}
    </div>
  );

  return (
    <div ref={ref} data-set-selector={p.kind} className={p.phone ? "flex w-full flex-col gap-1" : "relative inline-flex items-center gap-2"}>
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">{p.label}</span>
      <button
        type="button"
        data-set-button=""
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={p.current ? `${p.current.name} · ${countWords(p.current.count, p.current.main)}` : undefined}
        onClick={() => setOpen((o) => !o)}
        style={p.width && !p.phone ? { width: p.width } : undefined}
        className={`flex min-w-0 items-center gap-2 rounded-[10px] border-[1.5px] border-[var(--accent,var(--fg))] bg-[var(--panel-bg)] px-3 text-left ${p.phone ? "min-h-[44px] w-full" : "min-h-[32px] max-w-[340px]"}`}
      >
        <span className="text-[var(--accent,var(--fg))]">
          <KindIcon kind={p.kind} size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{name}</span>
        <span className="shrink-0 tabular-nums text-[12px] text-[var(--muted2)]">{count}</span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-[var(--muted2)]">▾</span>
      </button>
      {open && !p.phone && (
        <div id={menuId} role="menu" aria-label={p.label} data-set-menu="popover" className="absolute right-0 top-[calc(100%+6px)] z-50 w-[340px] max-w-[92vw] rounded-[12px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-1 shadow-xl">
          <div className="max-h-[60vh] overflow-y-auto">{blocks}</div>
          {actions}
        </div>
      )}
      {open && p.phone && (
        <div className="fixed inset-0 z-[60]" data-set-menu="sheet">
          <button type="button" aria-label="Close" data-set-sheet-backdrop="" className="absolute inset-0 h-full w-full cursor-default bg-black/40" onClick={() => setOpen(false)} />
          <div id={menuId} role="menu" aria-label={p.label} className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-[16px] border-t border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 pb-[max(env(safe-area-inset-bottom),8px)]">
            <button type="button" aria-label="Close" data-set-sheet-handle="" onClick={() => setOpen(false)} className="mx-auto flex h-[44px] w-[88px] shrink-0 items-center justify-center">
              <span className="block h-[5px] w-[44px] rounded-full bg-[var(--panel-border2)]" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto">{blocks}</div>
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}
