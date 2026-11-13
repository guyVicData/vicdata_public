"use client";

// VicData 0.8 front door (B8-B10): the pieces every home is built from.
//
//   HomeFrame     the page: the nav, the heading, the sections stacked (a thin dark gap between them,
//                 10 px of page background, for a person with more than one role), then "Also here".
//   HomeSection   one area you work in: a [data-field] that takes its part's colour in Mid (C18), with
//                 its chips, its "Open the full ... dashboard" button and its question tiles.
//   QuestionTile  a big real figure (or none), the question, a row of round icons -- one per screen of
//                 its walk, the view's own rail icon -- and the solid arrow, the one key action (B9).
//   AlsoHere      the dark band: Dashboards, Meetings and the role's extras, as today's homes have them.
//
// Mid is read here (useThemePref, listed in MID_PAGES): the root stays dark in Mid, and each field turns
// the tokens to Light's itself (globals.css). Colours are tokens only, never a `dark:` utility, so a
// field draws the same in every theme's own terms.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import * as PanelIcons from "@/components/shell/PanelIcons";
import { COLUMN_ICON_PATHS } from "@/components/shell/DashboardColumn";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { TeacherNav, useNavLabels } from "@/components/shell/TeacherNav";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { useFewerQuestions } from "@/lib/front-door/fewer";
import type { MidField } from "@/lib/front-door/contrast";
import { fillTemplate, screenMeta, type Walk } from "@/lib/front-door/walks";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import type { ColumnId } from "@/lib/teacher-view-catalogue";

const RAIL = PanelIcons as unknown as Record<string, ReactNode>;

/** A view's rail glyph by its catalogue name (TilesIcon, TrendLineIcon...), at the size asked. */
export function RailGlyph({ name, size = 14 }: { name: string; size?: number }) {
  const g = RAIL[name];
  return (
    <span aria-hidden="true" className="flex items-center justify-center [&>svg]:h-[var(--g)] [&>svg]:w-[var(--g)]" style={{ "--g": `${size}px` } as CSSProperties}>
      {typeof g === "function" ? null : g}
    </span>
  );
}

/** A walk's badge glyph: a Teacher column's own icon (COLUMN_ICON_PATHS), else the rail glyph named. */
export function WalkGlyph({ icon, size = 20 }: { icon: string; size?: number }) {
  if (icon in COLUMN_ICON_PATHS)
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {COLUMN_ICON_PATHS[icon as ColumnId]}
      </svg>
    );
  return <RailGlyph name={icon} size={size} />;
}

const ARROW = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const GRID = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export type TileFigure = { figure: string; unit: string } | null;

/** Where a walk starts (B11). */
export function walkHref(walk: Walk, params: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  const s = q.toString();
  return `/teacher/walk/${walk.id}${s ? `?${s}` : ""}`;
}

export function QuestionTile({ walk, figure, ctx, href, loading }: { walk: Walk; figure: TileFigure; ctx: { subject?: string | null; category?: string | null; entry?: string | null }; href: string | null; loading?: boolean }) {
  const question = fillTemplate(walk.question, ctx);
  return (
    <article data-home-tile={walk.id} className="fd-tile flex min-h-[200px] min-w-0 flex-col justify-between gap-4 rounded-[20px] border border-[var(--tile-border)] p-5 sm:px-[26px] sm:py-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
          <WalkGlyph icon={walk.icon} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-[var(--tile-accent-text)]">{walk.label}</span>
          {walk.kind && <span className="block text-[12px] text-[var(--muted2)]">{walk.kind}</span>}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {figure ? (
          <p data-tile-figure="" className="flex flex-wrap items-baseline gap-x-2.5 text-[var(--fg)]">
            <span className="text-[40px] font-semibold leading-none tracking-[-0.02em] sm:text-[44px]">{figure.figure}</span>
            <span className="text-[14px] text-[var(--muted2)]">{figure.unit}</span>
          </p>
        ) : loading ? (
          <p aria-hidden="true" className="h-[44px] w-24 rounded-md bg-[var(--box-bg)] opacity-60" />
        ) : null}
        <h3 className="text-[19px] font-medium leading-snug text-[var(--fg)]">{question}</h3>
      </div>
      <div className="flex items-center gap-2">
        <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={`The ${walk.screens.length} screens of this walk`}>
          {walk.screens.map((s, i) => {
            const meta = screenMeta(s.view);
            const name = meta?.label ?? s.view;
            return (
              <li key={i} role="img" data-screen-icon={s.view} aria-label={`Screen ${i + 1}: ${name}`} title={name} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
                <RailGlyph name={meta?.icon ?? "TilesIcon"} />
              </li>
            );
          })}
        </ul>
        <span className="grow" />
        {href ? (
          <Link href={href} data-tile-action="" aria-label={`Start: ${question}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tile-accent)] text-[var(--tile-on-accent)] hover:opacity-90">
            {ARROW}
          </Link>
        ) : (
          <span className="text-[12px] text-[var(--muted2)]">Coming</span>
        )}
      </div>
    </article>
  );
}

/** A tile with no walk yet (a primary school's KS2 Academic): it says so in its own space (B8). */
export function NoWalkTile({ walk, why }: { walk: Walk; why: string }) {
  return (
    <article data-home-tile={walk.id} data-no-walk="" className="fd-tile flex min-h-[200px] flex-col justify-between gap-4 rounded-[20px] border border-[var(--tile-border)] p-5 sm:px-[26px] sm:py-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
          <WalkGlyph icon={walk.icon} />
        </span>
        <span>
          <span className="block text-[13.5px] font-semibold text-[var(--tile-accent-text)]">{walk.label}</span>
          {walk.kind && <span className="block text-[12px] text-[var(--muted2)]">{walk.kind}</span>}
        </span>
      </div>
      <h3 className="text-[19px] font-medium leading-snug text-[var(--fg)]">{walk.question}</h3>
      <p className="text-[13px] text-[var(--muted2)]">{why}</p>
    </article>
  );
}

export type SectionChip = { label: ReactNode; strong?: boolean };

/**
 * One area you work in. `field` picks its Mid colour; `accent` is its product accent for Dark and Light.
 * In "fewer questions" mode the dashboard button leads and the questions are one line of links (B10).
 */
export function HomeSection({
  field,
  accent,
  chip,
  controls,
  dashboard,
  heading,
  tiles,
  links,
  cols,
  children,
  note,
}: {
  field: MidField;
  accent: { hex: string; rgb: string } | null;
  chip: string;
  controls?: ReactNode;
  dashboard: { label: string; href: string } | null;
  heading?: ReactNode;
  tiles: ReactNode;
  links: { label: string; href: string | null }[];
  cols: 2 | 3;
  children?: ReactNode;
  note?: ReactNode;
}) {
  const [fewer] = useFewerQuestions();
  const style = (accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) as CSSProperties;
  return (
    <section data-field={field} data-home-section={chip} style={style} className="px-4 py-8 sm:px-10 sm:py-11">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
        {heading}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-[6px] bg-[var(--field-chip-bg)] px-2.5 py-1 text-[12.5px] font-bold text-[var(--field-chip-fg)]">{chip}</span>
          {controls}
          <span className="grow" />
          {dashboard && !fewer && (
            <Link href={dashboard.href} className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--field-chip-border)] bg-[var(--field-chip-bg)] px-3.5 py-2 text-[14px] font-semibold text-[var(--field-chip-fg)] hover:opacity-90">
              {GRID} {dashboard.label}
            </Link>
          )}
        </div>
        {fewer ? (
          <div className="flex flex-col gap-3" data-fewer="">
            {dashboard && (
              <Link href={dashboard.href} className="fd-tile flex items-center justify-center gap-2.5 rounded-[16px] px-5 py-5 text-[18px] font-semibold text-[var(--fg)]">
                {GRID} {dashboard.label}
              </Link>
            )}
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
              {links.map((l, i) =>
                l.href ? (
                  <Link key={i} href={l.href} className="font-medium text-[var(--field-ink)] underline decoration-from-font underline-offset-2">
                    {l.label}
                  </Link>
                ) : (
                  <span key={i} className="text-[var(--field-ink)] opacity-80">{l.label}</span>
                ),
              )}
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-[18px] ${cols === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}>{tiles}</div>
        )}
        {children}
        {note && <p className="text-[13px] text-[var(--field-ink)]">{note}</p>}
      </div>
    </section>
  );
}

/** The heading every home opens on. `onField`: drawn inside a field (a one-section home). */
export function HomeHeading({ sub, onField }: { sub: string; onField: boolean }) {
  return (
    <div className="flex max-w-[860px] flex-col gap-2.5">
      <h1 className={`text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px] ${onField ? "text-[var(--field-ink)]" : "text-[var(--fg)]"}`}>What would you like to know?</h1>
      <p className={`text-[16px] leading-relaxed sm:text-[18px] ${onField ? "text-[var(--field-ink)]" : "text-[var(--muted)]"}`}>{sub}</p>
    </div>
  );
}

export type AlsoItem = { href: string | null; title: string; line: string; icon: ReactNode; colour: { hex: string; rgb: string } };

export function AlsoHere({ items }: { items: AlsoItem[] }) {
  if (!items.length) return null;
  return (
    <section data-also-here="" className="px-4 pb-12 pt-8 sm:px-10">
      <div className="mx-auto max-w-[1160px]">
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Also here</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {items.map((it) => {
            const body = (
              <>
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: `rgba(${it.colour.rgb},0.16)`, color: it.colour.hex }}>
                  {it.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-[var(--fg)]">{it.title}</span>
                  <span className="block truncate text-[13px] text-[var(--muted)]">{it.line}</span>
                </span>
              </>
            );
            const cls = "flex items-center gap-3 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3";
            return it.href ? (
              <Link key={it.title} href={it.href} className={`${cls} hover:border-[var(--panel-border2)]`}>
                {body}
              </Link>
            ) : (
              <div key={it.title} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** "Show fewer questions": the home's own switch (the account menu has the same one). */
export function FewerToggle() {
  const [fewer, setFewer] = useFewerQuestions();
  return (
    <button type="button" data-fewer-toggle="" aria-pressed={fewer} onClick={() => setFewer(!fewer)} className="text-[13px] font-medium text-[var(--muted)] underline decoration-from-font underline-offset-2 hover:text-[var(--fg)]">
      {fewer ? "Show the questions again" : "Show fewer questions"}
    </button>
  );
}

/**
 * The page. The root draws Dark in Mid (the header and "Also here" stay dark); `data-pref` lets the
 * fields take their colour. `heading` is drawn above the sections when there is more than one.
 */
export function HomeFrame({ heading, sections, also, banner, labelsUrn, labelsPhases = [], rootStyle, strip }: { heading: ReactNode | null; sections: ReactNode[]; also: AlsoItem[]; banner?: ReactNode; labelsUrn?: string | null; labelsPhases?: TeacherPhase[]; rootStyle?: CSSProperties; strip?: ReactNode }) {
  const [pref] = useThemePref();
  const theme = effectiveTheme(pref);
  const [labelsOn, setLabelsOn] = useNavLabels(labelsUrn ?? null, labelsPhases);
  return (
    <main id="teacher-root" data-theme={theme} data-pref={pref} data-front-door-home="" className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={rootStyle}>
      <div className="mx-auto max-w-[1240px] px-4 pt-4 sm:px-6">
        {banner ?? <ViewAsBanner />}
        <TeacherNav phase={null} phases={[]} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={() => {}} />
      </div>
      {strip}
      {heading && <div className="px-4 pb-8 pt-10 sm:px-10"><div className="mx-auto max-w-[1160px]">{heading}</div></div>}
      <div className="flex flex-col gap-[10px]" data-home-sections={sections.length}>
        {sections}
      </div>
      <div className="px-4 pt-4 sm:px-10">
        <div className="mx-auto flex max-w-[1160px] justify-end">
          <FewerToggle />
        </div>
      </div>
      <AlsoHere items={also} />
    </main>
  );
}
