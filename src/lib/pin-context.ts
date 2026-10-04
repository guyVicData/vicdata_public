// VicData 0.6 integration: a chooser context (PickPanelContext) turned into the pinned
// settings a meeting slot, a Copy this view source or a live preview draws with
// (PinnedSettings / PinInput, src/lib/meeting-views.ts). One place, so the meeting's Add a
// view, the panel's Copy this view and the chooser's live previews resolve a context the
// same way (scope brief §7.5: "every setting is resolved", "the year is pinned to the
// moment it was added", with a per-view keep-live option).
import { dataviewById } from "@/catalogue";
import { averagesLabel, contextFromPanel, defaultFromYear, latestYear, resolveTitle, titleOverrideOf, viewTitle, type PanelLabels, type PickPanelContext } from "@/catalogue/pick";
import type { CompareKind, DashboardConfig, Dataview, DataviewInstance, ResultsMeasure } from "@/catalogue/types";
import type { CopyViewSource } from "./copy-view";
import type { PinInput } from "./meeting-views";

export type PinSchool = { urn: string; name: string } | null;

// A subject item key ("Maths::GCSE (9-1) Full Course", subjectItemsOf) split into its
// subject and qualification. A bare subject name has no qualification.
export function subjectOfKey(key: string): { subject: string; qualificationType: string | null } {
  const i = key.indexOf("::");
  return i < 0 ? { subject: key, qualificationType: null } : { subject: key.slice(0, i), qualificationType: key.slice(i + 2) || null };
}

// Context's compare-against, from the subjects comparison's scope.
export function againstOfScope(scope: NonNullable<PickPanelContext["compare"]["subjects"]>["scope"] | undefined): "category" | "whole" | "selected" | null {
  if (!scope) return null;
  if (scope === "whole") return "whole";
  if (scope === "selected" || scope === "my_subjects") return "selected";
  return "category";
}

// The one comparison a pinned view carries: the first of the view's own compare kinds the
// context has (a view compares one way), named as the context names it.
export function pinnedCompare(ctx: PickPanelContext, dv: Dataview | undefined): { kind: CompareKind; name: string } | null {
  const kinds = dv ? dv.supports.compare.filter((k) => ctx.compare.kinds.includes(k)) : ctx.compare.kinds;
  const kind = kinds[0];
  if (!kind) return null;
  if (kind === "schools") return { kind, name: ctx.compare.schools?.label && !/^10 nearest$/i.test(ctx.compare.schools.label) ? ctx.compare.schools.label : "10 nearest schools" };
  if (kind === "subjects") return { kind, name: ctx.compare.subjects?.label ?? "its category" };
  return { kind, name: averagesLabel(ctx.compare.averages ?? ["england"], ctx).join(", ") };
}

export type PinOptions = {
  // Keep the view on the latest data instead of pinning the year.
  keepLive?: boolean;
  // The real latest year / first year where the caller knows them (a live dashboard);
  // otherwise the measure card's range.
  latest?: string | null;
  from?: string | null;
};

export function pinFromContext(ctx: PickPanelContext, dv: Dataview | undefined, school: PinSchool, opts: PinOptions = {}): PinInput {
  const subj = ctx.focus.kind === "subject" ? ctx.focus.subject : undefined;
  const key = subj?.key ?? (subj?.mode === "always" ? subj.label ?? undefined : undefined);
  const parsed = key ? subjectOfKey(key) : null;
  const latest = opts.latest ?? latestYear(ctx);
  const from = opts.from ?? defaultFromYear(ctx);
  const against = ctx.compare.kinds.includes("subjects") ? againstOfScope(ctx.compare.subjects?.scope) : null;
  const trend = dv?.supports.dateMode === "trend";
  return {
    schoolUrn: school?.urn ?? null,
    schoolName: school?.name ?? ctx.labels.school ?? null,
    phase: ctx.phase,
    data: ctx.data,
    ...(ctx.data === "academic.results" ? { results: ctx.results ?? "points" } : {}),
    subject: parsed?.subject ?? null,
    subjectLabel: subj?.label ?? parsed?.subject ?? null,
    qualificationType: parsed?.qualificationType ?? null,
    compare: pinnedCompare(ctx, dv),
    ...(trend ? { yearRange: latest ? { from: from ?? latest, to: latest } : null } : { year: latest }),
    ...(against ? { params: { against } } : {}),
    keepLive: !!opts.keepLive,
  };
}

// The chooser's roll-forward choice on a picked instance (Customise's toggle); a
// ready-made view has none, so it is pinned.
export function rollsForward(instance: DataviewInstance): boolean {
  return instance.kind === "view" && (instance.params as { rollForward?: unknown } | undefined)?.rollForward === true;
}

// ---------------------------------------------------------------------------------
// A live panel as a Copy this view source (S6's CopyViewSourceContext), from the
// dashboard's runtime state (DashboardRuntimeContext): the page's real school, focus
// subject, Results measure, Context group and comparison set.

export type RuntimeLabels = {
  school: PinSchool;
  // The Results pill's value (the column follows it).
  results: ResultsMeasure;
  focus: { key: string; label: string } | null;
  // The focused subject's category ("Sciences & Maths").
  category: string | null;
  // Context's live group: its compare-against and label ("All subjects").
  contextAgainst: "category" | "whole" | "selected";
  contextGroupLabel: string;
  // The Comparisons column's set, by name ("10 nearest schools", a saved set's name).
  setLabel: string | null;
  // The real data years on the page ("2024/25"), where known.
  latestYear: string | null;
  firstYear: string | null;
};

const SCOPE_OF_AGAINST = { category: "category", whole: "whole", selected: "selected" } as const;

export function copySourceFor(config: DashboardConfig, panelId: string, instance: Extract<DataviewInstance, { kind: "view" }>, rt: RuntimeLabels): CopyViewSource {
  const dv = dataviewById(instance.dataview);
  const labels: PanelLabels = {
    results: rt.results,
    subject: rt.focus ? { label: rt.focus.label, key: rt.focus.key } : null,
    school: rt.school?.name,
    category: rt.category ?? undefined,
    setLabel: rt.setLabel ?? undefined,
  };
  const base = contextFromPanel(config, panelId, labels);
  // A column that follows Context's pill compares with whatever group the pill is on now.
  const panel = config.panels.find((p) => p.id === panelId);
  const column = config.columns.find((c) => c.id === panel?.column);
  const spec = panel?.override?.compare ?? column?.compare ?? null;
  const context: PickPanelContext =
    base.compare.subjects && (spec?.subjects === "pill" || spec?.subjects === undefined)
      ? { ...base, compare: { ...base.compare, subjects: { scope: SCOPE_OF_AGAINST[rt.contextAgainst], label: rt.contextGroupLabel } } }
      : base;
  const pinned = pinFromContext(context, dv, rt.school, { latest: rt.latestYear, from: rt.firstYear });
  // 0.6 snag 4 / 01: the view's own title (Customise's) resolved as the panel shows it; else
  // the dataview's title for this context. Never a raw template with its placeholders. A
  // trend's [year] is where its honest series starts (defaultFromYear, as the trend panels
  // and Customise's preview start), a single year's the page's real latest.
  const own = titleOverrideOf(instance);
  const title = own ? resolveTitle(own, dv ?? null, context, { latest: rt.latestYear }) : dv ? viewTitle(dv, context) : (instance.title ?? instance.dataview);
  return { instance, context, pinned, title };
}

// 0.6 snag 4 / 01: the title a configured panel's view shows in place of its host's own --
// the instance's override resolved for the page's school, subject, Results measure, Context
// group, comparison set and real years. null = no override (the host's titles, as before).
export function panelTitleOverride(config: DashboardConfig, panelId: string, instance: Extract<DataviewInstance, { kind: "view" }>, rt: RuntimeLabels): string | null {
  if (!titleOverrideOf(instance)) return null;
  try {
    return copySourceFor(config, panelId, instance, rt).title;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------
// A meeting slot's Add a view (scope brief §7.5): no column to pre-fill from, so the
// chooser starts at Step 1 with nothing inherited -- GCSE Candidates, one subject (picked
// in Step 2a) against its subject category (Column 1's own question; every registered view
// compares something, so "no comparison" would open on an empty Pick), either time.

export function meetingChooserContext(school: PinSchool, slideTitle: string | null): PickPanelContext {
  return {
    data: "academic.candidates",
    phase: "ks4",
    focus: { kind: "subject", subject: { mode: "always", label: null } },
    compare: { kinds: ["subjects"], subjects: { scope: "category", label: "its category" } },
    time: "either",
    labels: { dashboard: "Meeting", column: "Slide", row: slideTitle || "New view", school: school?.name },
  };
}

// The picked view as a slot's pin: every setting resolved, the school's, the latest year
// pinned unless Customise's roll-forward keeps it live.
export function meetingPin(instance: DataviewInstance, ctx: PickPanelContext, school: PinSchool): PinInput {
  const dv = instance.kind === "view" ? dataviewById(instance.dataview) : undefined;
  return pinFromContext(ctx, dv, school, { keepLive: rollsForward(instance) });
}
