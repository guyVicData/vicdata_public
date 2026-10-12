"use client";

// VicData 0.7 admissions r2 (D2): the Admissions page's chrome (Main.dc.html / MarketShare.dc.html):
// the nav (VicData; Home, Admissions, then View as, the account menu and the theme toggle -- the
// Teacher pages' own controls), the header bar (the A badge, the school, the Pipelines | Market
// share switch, the entry-point chips with ±, the top bar's filters) and the row heads.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AccountMenu, HOME_ICON } from "@/components/teacher/TeacherNav";
import { ThemeToggle, type Theme } from "@/components/teacher/TeacherChrome";
import { ViewAsPill } from "@/components/view-as/ViewAs";
import { PanelMenu, MenuRow, useDismiss } from "@/components/teacher/PanelMenu";
import type { Filters } from "./api";
import { EntryChip, FChip, cx } from "./ui";

export type DashKey = "pipelines" | "market-share";

const Divider = () => <span aria-hidden="true" className="h-4 w-px bg-[var(--adm-rail-on)]" />;

export function AdmissionsNav({ theme, onTheme, phone = false }: { theme: Theme; onTheme: (t: Theme) => void; phone?: boolean }) {
  if (phone)
    return (
      <nav aria-label="Admissions" className="flex items-center justify-between border-b border-[var(--border)] px-4 pb-3 pt-4 print:hidden">
        <Link href="/teacher" className="text-[15px] font-bold">
          VicData
        </Link>
        <span className="flex items-center gap-2">
          <span className="flex h-7 items-center rounded-[9px] bg-[var(--adm-tint)] px-[10px] text-[12px] font-bold text-[var(--adm-accent-text)]">Admissions</span>
          <AccountMenu />
        </span>
      </nav>
    );
  return (
    <nav aria-label="Admissions" className="flex items-center justify-between text-[13px] print:hidden">
      <Link href="/" className="font-bold tracking-[0.02em]">
        VicData
      </Link>
      <div className="flex items-center gap-[10px] text-[var(--muted)]">
        <Link href="/teacher" className="flex items-center gap-[6px] px-[10px] text-[12px] font-bold hover:text-[var(--fg)] [&>svg]:h-[15px] [&>svg]:w-[15px]">
          {HOME_ICON}
          Home
        </Link>
        <Divider />
        <span aria-current="page" className="flex h-[30px] items-center rounded-[9px] bg-[var(--adm-tint)] px-[10px] text-[12px] font-bold text-[var(--adm-accent-text)]">
          Admissions
        </span>
        <Divider />
        <ViewAsPill tone="teacher" />
        <AccountMenu />
        <ThemeToggle theme={theme} onTheme={onTheme} />
      </div>
    </nav>
  );
}

export function Switch({ active, onSwitch }: { active: DashKey; onSwitch: (d: DashKey) => void }) {
  const item = (k: DashKey, label: string) => (
    <button key={k} type="button" aria-pressed={active === k} onClick={() => onSwitch(k)} className={cx("rounded-full px-[14px] py-[6px] text-[13px] font-bold", active === k ? "bg-[var(--accent)] text-[var(--adm-on-accent)]" : "text-[var(--muted2)] hover:text-[var(--fg)]")}>
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Admissions dashboards" className="inline-flex gap-[2px] rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] p-[3px]">
      {item("pipelines", "Pipelines")}
      {item("market-share", "Market share")}
    </div>
  );
}

function MenuChip<T extends string>({ value, options, onPick, label }: { value: T; options: { id: T; label: string; title?: string }[]; onPick: (v: T) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <span className="relative" ref={ref}>
      <FChip onClick={() => setOpen(!open)} title={label} active={value !== options[0].id}>
        {current.label}
      </FChip>
      {open && (
        <PanelMenu label={label} align="right" width={210}>
          {options.map((o) => (
            <MenuRow
              key={o.id}
              label={o.label}
              selected={o.id === value}
              title={o.title}
              onClick={() => {
                setOpen(false);
                onPick(o.id);
              }}
            />
          ))}
        </PanelMenu>
      )}
    </span>
  );
}

export function FilterChips({ dash, filters, onFilters, rivalsChip }: { dash: DashKey; filters: Filters; onFilters: (f: Filters) => void; rivalsChip?: ReactNode }) {
  return (
    <>
      {rivalsChip}
      {dash === "pipelines" ? (
        <MenuChip
          label="Which feeder lists make the pool"
          value={filters.lists}
          onPick={(lists) => onFilters({ ...filters, lists })}
          options={[
            { id: "both", label: "Day + boarding" },
            { id: "day", label: "Day only" },
            { id: "boarding", label: "Boarding only" },
          ]}
        />
      ) : (
        <MenuChip
          label="Which rivals"
          value={filters.boardingOnly ? "boarding" : "both"}
          onPick={(v) => onFilters({ ...filters, boardingOnly: v === "boarding" })}
          options={[
            { id: "both", label: "Day + boarding" },
            { id: "boarding", label: "Rivals with boarders" },
          ]}
        />
      )}
      <MenuChip
        label="Pupils"
        value={filters.sex}
        onPick={(sex) => onFilters({ ...filters, sex })}
        options={[
          { id: "all", label: "All pupils" },
          { id: "female", label: "Girls", title: "Births have no girl/boy split: a girls' pool from births is an estimate (49%)." },
          { id: "male", label: "Boys", title: "Births have no girl/boy split: a boys' pool from births is an estimate (51%)." },
        ]}
      />
      <MenuChip
        label="Sector"
        value={filters.sector}
        onPick={(sector) => onFilters({ ...filters, sector })}
        options={[
          { id: "all", label: "State + independent" },
          { id: "state", label: "State only" },
          { id: "independent", label: "Independent only" },
        ]}
      />
    </>
  );
}

export function HeaderBar({
  schoolName,
  dash,
  onDash,
  entries,
  entry,
  onEntry,
  onEditEntries,
  editTitle,
  filters,
  onFilters,
  rivalsChip,
}: {
  schoolName: string;
  dash: DashKey;
  onDash: (d: DashKey) => void;
  entries: { id: string; label: string }[];
  entry: string;
  onEntry: (id: string) => void;
  onEditEntries: (() => void) | null;
  editTitle: string;
  filters: Filters;
  onFilters: (f: Filters) => void;
  rivalsChip?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-4 py-[10px]">
      <div className="flex items-center gap-[14px]">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--adm-tint)] text-[17px] font-extrabold text-[var(--adm-accent-text)]">
          A
        </span>
        <h1 className="text-[16px] font-bold">
          Admissions <span className="text-[13px] font-medium text-[var(--muted2)]">&mdash; {schoolName}</span>
        </h1>
        <Switch active={dash} onSwitch={onDash} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[var(--muted2)]">Entry point</span>
        {entries.map((e) => (
          <EntryChip key={e.id} label={e.label} active={e.id === entry} onClick={() => onEntry(e.id)} />
        ))}
        <button
          type="button"
          onClick={onEditEntries ?? undefined}
          disabled={!onEditEntries}
          title={editTitle}
          aria-label="Choose entry points"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--panel-border2)] text-[var(--muted2)] hover:text-[var(--fg)] disabled:opacity-50"
        >
          &plusmn;
        </button>
        <span aria-hidden="true" className="mx-1 h-[18px] w-px bg-[var(--adm-rail-on)]" />
        <FilterChips dash={dash} filters={filters} onFilters={onFilters} rivalsChip={rivalsChip} />
      </div>
    </div>
  );
}

export function RowHead({ title, context, open, onToggle }: { title: string; context: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 px-[2px] py-1 text-left text-[12.5px] font-bold text-[var(--fg)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ transform: open ? undefined : "rotate(-90deg)" }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {title} <span className="text-[11px] font-medium text-[var(--muted2)]">&middot; {context}</span>
    </button>
  );
}

export function PhoneHeader({ dash, onDash, entries, entry, onEntry, onEditEntries }: { dash: DashKey; onDash: (d: DashKey) => void; entries: { id: string; label: string }[]; entry: string; onEntry: (id: string) => void; onEditEntries: (() => void) | null }) {
  return (
    <>
      <div className="self-start">
        <Switch active={dash} onSwitch={onDash} />
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {entries.map((e) => (
          <EntryChip key={e.id} label={e.label} active={e.id === entry} onClick={() => onEntry(e.id)} />
        ))}
        <button type="button" onClick={onEditEntries ?? undefined} disabled={!onEditEntries} aria-label="Choose entry points" className="rounded-full border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 py-[6px] text-[12px] font-semibold text-[var(--chip-fg)] disabled:opacity-50">
          &plusmn;
        </button>
      </div>
    </>
  );
}
