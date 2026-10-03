"use client";

// VicData 0.6 S6: the role home's pieces (scope brief §4.10; board
// docs/wireframes/v0.6/HomeSMT.dc.html) for /teacher: the role switch (the "lens
// switcher", shown only to people holding more than one role), the key-dashboard tiles,
// the empty "key dashboards" tile SMT and Admissions show until theirs are built, and the
// Dashboards (library) tile. Every tile is HomeCard, so a role home reads exactly like
// the Teacher home it extends.
import type { CSSProperties } from "react";
import type { DashboardConfig } from "@/catalogue/types";
import { HomeCard } from "@/components/teacher/HomeCard";
import { colourOf, iconOf, LIBRARY_ACCENT, resolveIcon } from "@/lib/dashboard-icons";
import { VISIBLE_ROLE_LABELS, VISIBLE_ROLES, VISIBLE_ROLES_PROSE_ORDER, visibleRolesOf, type VisibleRoleId } from "@/lib/roles";
import { IconGlyph, KeyDashboardsGlyph, LibraryGlyph } from "./DashboardIcon";
import { HOME } from "./layout";

// A lens is a role with a home. School-Admin is an admin, not a lens (S1): its holder
// sees the homes of the roles they hold.
export type Lens = "teacher" | "smt" | "admissions";

export function lensesOf(m: Parameters<typeof visibleRolesOf>[0]): Lens[] {
  const held = visibleRolesOf(m).filter((r): r is Lens => r !== "school_admin");
  const lenses = (VISIBLE_ROLES_PROSE_ORDER as VisibleRoleId[]).filter((r): r is Lens => held.includes(r as Lens));
  return lenses.length ? lenses : ["teacher"];
}

// The home a multi-role person opens on: the last one they chose, else their most senior
// (SMT, then Teacher, then Admissions -- VISIBLE_ROLES' order, as HomeSMT draws SMT on).
export const LENS_KEY = "vicdata.home.lens";

export function initialLens(lenses: Lens[], stored: string | null): Lens {
  if (stored && (lenses as string[]).includes(stored)) return stored as Lens;
  return (VISIBLE_ROLES as string[]).map((r) => r as Lens).find((r) => lenses.includes(r)) ?? lenses[0] ?? "teacher";
}

export function readStoredLens(): string | null {
  try {
    return window.localStorage.getItem(LENS_KEY);
  } catch {
    return null;
  }
}

export function storeLens(lens: Lens): void {
  try {
    window.localStorage.setItem(LENS_KEY, lens);
  } catch {
    // Remembered for this visit only.
  }
}

// Look at it as… (?as=role): the previewed role picks the lens; School-Admin previews the
// Teacher home (an admin, not a lens).
export function lensForLookAs(role: string): Lens {
  return role === "smt" || role === "admissions" ? role : "teacher";
}

export function LensSwitch({ lenses, lens, onLens }: { lenses: Lens[]; lens: Lens; onLens: (l: Lens) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div role="tablist" aria-label="Your roles" className="flex w-fit rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] p-[3px]" style={{ gap: HOME.switchGap }}>
        {lenses.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={l === lens}
            onClick={() => onLens(l)}
            className={`rounded-full border-0 text-[13px] font-bold ${l === lens ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-transparent text-[var(--muted)]"}`}
            style={{ padding: HOME.switchPad }}
          >
            {VISIBLE_ROLE_LABELS[l]}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] leading-[1.3] text-[var(--muted3)]">Shown because a School-Admin gave you more than one role. Each has its own home.</p>
    </div>
  );
}

const KEY_EMPTY_LINE: Record<Exclude<Lens, "teacher">, string> = {
  smt: "Coming after 0.6: overviews first, then down to subject performance",
  admissions: "Coming after 0.6: rolls, births and how you compare with nearby schools",
};

// HomeSMT's dashed tile: no key dashboards for this role yet.
export function KeyDashboardsEmpty({ lens }: { lens: Exclude<Lens, "teacher"> }) {
  return (
    <div className="flex items-center rounded-[14px] border-[1.5px] border-dashed border-[var(--edge-strong)] bg-transparent" style={{ padding: HOME.tilePad, gap: HOME.tileGap }}>
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] text-[var(--muted3)] [&>svg]:h-5 [&>svg]:w-5" style={{ background: "color-mix(in srgb, var(--fg) 6%, var(--bg))" } as CSSProperties}>
        {KeyDashboardsGlyph}
      </div>
      <div className="min-w-0 flex-grow">
        <p className="text-[15px] font-bold text-[var(--muted2)]">{VISIBLE_ROLE_LABELS[lens]} key dashboards</p>
        <p className="mt-0.5 text-[13px] text-[var(--muted3)]">{KEY_EMPTY_LINE[lens]}</p>
      </div>
    </div>
  );
}

// A key VicData dashboard as a home tile (no tour line: the ≈4-step path is GCSE and
// Post-16's).
export function KeyDashboardTile({ href, config, lens }: { href: string; config: DashboardConfig; lens: Lens }) {
  return (
    <HomeCard
      href={href}
      colour={colourOf(config.colour)}
      icon={<IconGlyph drawing={resolveIcon(iconOf(config))} size={20} />}
      title={config.name}
      description={`A key VicData dashboard for ${VISIBLE_ROLE_LABELS[lens]}`}
    />
  );
}

const SHARED_WITH: Record<Lens, string> = { teacher: "teachers", smt: "SMT", admissions: "Admissions" };

export function LibraryTile({ lens, href = "/dashboards" }: { lens: Lens; href?: string }) {
  return (
    <HomeCard
      href={href}
      colour={LIBRARY_ACCENT}
      icon={<span className="flex h-5 w-5 [&>svg]:h-5 [&>svg]:w-5">{LibraryGlyph}</span>}
      title="Dashboards"
      description={`Shared with ${SHARED_WITH[lens]}, and the ones you've made`}
    />
  );
}
