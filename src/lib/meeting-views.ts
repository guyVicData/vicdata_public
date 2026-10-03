// VicData 0.6 S7: what a meeting slot's pinned view says about itself -- its settings,
// resolved title, citation (G7), the year it is pinned to, and "move on to the latest
// data". Pure; reads only the catalogue.
//
// A slot holds ONE specific view, literally (scope brief §7.5): every setting resolved
// ("[subject]" -> "Maths (General)", the compare set -> its name), the year pinned to the
// moment it was added ("as of 2024/25") unless the view is kept live.
import { dataviewById, measureById } from "@/catalogue";
import type { CompareKind, DataId, Dataview, DataviewInstance, Phase, ResultsMeasure, SlideConfig, ViewType } from "@/catalogue/types";

// The pinned settings carried on slot.view.pinned (stored as JSON).
export type PinnedSettings = {
  schoolUrn?: string | null;
  schoolName?: string | null;
  phase?: Phase;
  data?: DataId;
  results?: ResultsMeasure;
  // The raw subject and its resolved label ("Maths" / "Maths (General)").
  subject?: string | null;
  subjectLabel?: string | null;
  qualificationType?: string | null;
  // The comparison, resolved to its name ("10 nearest schools", "Sciences & Maths").
  compare?: { kind: CompareKind; name: string } | null;
  // Single-year views: the academic year pinned ("2024/25"). Trend views: the span.
  year?: string | null;
  yearRange?: { from: string; to: string } | null;
  // The view's own parameters at the moment it was pinned (rail state, chosen subjects).
  params?: Record<string, unknown>;
  // Migration provenance (old Meetings page slide key and its parts).
  legacy?: Record<string, unknown>;
};

// What Copy to meeting / Add a view hand over: the settings plus the keep-live choice.
export type PinInput = PinnedSettings & { keepLive?: boolean };

export type ViewSlot = SlideConfig["slots"][number] & { view: NonNullable<SlideConfig["slots"][number]["view"]> };

export function isViewSlot(slot: SlideConfig["slots"][number]): slot is ViewSlot {
  return !!slot.view;
}

export function pinnedOf(slot: SlideConfig["slots"][number]): PinnedSettings {
  return (slot.view?.pinned ?? {}) as PinnedSettings;
}

export function dataviewOf(slot: SlideConfig["slots"][number]): Dataview | undefined {
  const v = slot.view;
  return v && v.kind === "view" ? dataviewById(v.dataview) : undefined;
}

// The measure behind a view at the pinned phase (first of the view's measures that
// matches it), for its citation, name and latest year.
export function measureOf(dv: Dataview | undefined, phase: Phase | undefined) {
  if (!dv) return undefined;
  const ms = dv.measures.map((id) => measureById(id)).filter((m): m is NonNullable<typeof m> => !!m);
  return ms.find((m) => !phase || !m.phase || m.phase === phase) ?? ms[0];
}

// G7: the source citation, from the measure card.
export function citationOf(slot: SlideConfig["slots"][number]): string | null {
  const dv = dataviewOf(slot);
  return measureOf(dv, pinnedOf(slot).phase)?.citation ?? null;
}

// The latest year the registry has for this view's measure ("2024/25").
export function latestYearOf(slot: SlideConfig["slots"][number]): string | null {
  const dv = dataviewOf(slot);
  return measureOf(dv, pinnedOf(slot).phase)?.years.to ?? null;
}

// MeetingPlay's kind words, from the view's type (for "Suggest a title").
export const KIND_WORD: Record<ViewType, string> = {
  numerical: "numbers",
  donut: "donut",
  graph: "graph",
  map: "map",
  ranking: "ranking",
  table: "table",
};

// The resolved title: the instance's own title when it carries one (Copy to meeting
// passes the panel's resolved title), else the registry template with every placeholder
// filled from the pinned settings.
export function slotTitle(slot: SlideConfig["slots"][number]): string {
  const v = slot.view;
  if (!v) return "Text box";
  if (v.kind === "placeholder") return v.description;
  if (v.title) return v.title;
  const dv = dataviewById(v.dataview);
  if (!dv) return "View no longer available";
  return resolveTemplate(dv, pinnedOf(slot));
}

export function resolveTemplate(dv: Dataview, p: PinnedSettings): string {
  const measure = measureOf(dv, p.phase);
  const subject = p.subjectLabel || p.subject || "the subject";
  const group = p.compare?.name || "its category";
  const fill: Record<string, string> = {
    subject,
    year: p.year || measure?.years.to || "",
    category: group,
    "comparison-group": group,
    set: p.compare?.name || "comparison set",
    school: p.schoolName || "Your school",
    measure: measure?.name ?? dv.label,
    headline: measure?.name ?? dv.label,
    "Entries|Results": p.data === "academic.results" ? "Results" : "Entries",
    range: "the range picked",
  };
  return dv.titleTemplate
    .replace(/\[([^\]]+)\]/g, (_, key: string) => fill[key] ?? key)
    .replace(/\s+/g, " ")
    .trim();
}

// The small uppercase line above a slot's title (Meeting.dc.html: "Pinned · as of 2024/25").
export function pinLine(slot: SlideConfig["slots"][number]): string {
  const v = slot.view;
  if (!v) return "Text";
  const p = pinnedOf(slot);
  if (v.keepLive || (!p.year && !p.yearRange)) return "Live · latest data";
  if (p.yearRange) return `Pinned · ${p.yearRange.from} to ${p.yearRange.to}`;
  return `Pinned · as of ${p.year}`;
}

// "data as of 2024/25" for a meeting card: the latest pinned year across its slots, or
// null when every view is live.
export function dataAsOf(slides: SlideConfig[]): string | null {
  const years: string[] = [];
  for (const s of slides)
    for (const slot of s.slots) {
      if (!slot.view || slot.view.keepLive) continue;
      const p = pinnedOf(slot);
      const y = p.yearRange?.to ?? p.year;
      if (y) years.push(y);
    }
  return years.length ? years.sort().at(-1)! : null;
}

// Academic-year arithmetic for "move every view on to the latest data": "2021/22" + 3 ->
// "2024/25". Calendar years ("2025") shift as plain numbers.
export function shiftYear(year: string, by: number): string {
  const m = /^(\d{4})\/(\d{2})$/.exec(year);
  if (m) {
    const start = Number(m[1]) + by;
    return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
  }
  return /^\d{4}$/.test(year) ? String(Number(year) + by) : year;
}

function yearStart(year: string): number | null {
  const m = /^(\d{4})/.exec(year);
  return m ? Number(m[1]) : null;
}

// One slot moved on to the latest year the registry has: single years jump to it; a
// trend span keeps its length and ends there. Live views and text are unchanged.
export function rollSlotForward<T extends SlideConfig["slots"][number]>(slot: T): T {
  const v = slot.view;
  if (!v || v.keepLive) return slot;
  const latest = latestYearOf(slot);
  if (!latest) return slot;
  const p = pinnedOf(slot);
  const next: PinnedSettings = { ...p };
  if (p.yearRange) {
    const a = yearStart(p.yearRange.to);
    const b = yearStart(latest);
    if (a !== null && b !== null && b > a) next.yearRange = { from: shiftYear(p.yearRange.from, b - a), to: latest };
  } else if (p.year) {
    next.year = latest;
  }
  return { ...slot, view: { ...v, pinned: next } };
}

// Build the stored slot view from what Copy to meeting / Add a view hand over.
export function pinView(instance: DataviewInstance, pin: PinInput): NonNullable<SlideConfig["slots"][number]["view"]> {
  const { keepLive, ...pinned } = pin;
  return { ...instance, pinned: pinned as Record<string, unknown>, keepLive: !!keepLive };
}
