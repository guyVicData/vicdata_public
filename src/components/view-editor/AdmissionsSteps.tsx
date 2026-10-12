"use client";

// VicData 0.7 admissions r2 (D7): the existing view editor's steps for an Admissions column -- no
// new dialogue, the same boxes and controls:
//   1 · Data     the families (Pupils by age, Pipeline, Market share, Rivals' results); the entry
//                point plays the subject's part ("follows the dashboard's entry point"); the compare
//                options (Day feeders, Boarding feeders, Both, Rivals, Area: LA / region / England)
//   2 · View     the kinds each family can draw, with look-only options; what can't be edited
//                (certainty styling, honesty wording, flag thresholds, shapes not ranked) is a fixed note
//   3 · Preview  the view drawn for a school, and "Shows for": entry points where Teacher lists result types
import type { ReactNode } from "react";
import type { CompareSeries, ViewKind, ViewSpec } from "@/catalogue/viewspec";
import type { AdmissionsDataId, EntryPointState } from "@/catalogue/types";
import { ADMISSIONS_FAMILIES } from "@/catalogue/admissions";
import { ADMISSIONS_COMPARE, ADMISSIONS_FIXED, ADMISSIONS_KINDS, VIEW_KINDS, VIEW_LABEL, admissionsViewHonest } from "@/catalogue/honest";
import { ADMISSIONS_VIEW_KINDS } from "@/catalogue/viewspec";
import { presetSpec } from "@/catalogue/viewspec";
import { AXIS_STATES } from "@/catalogue/variants";
import { dataviewById } from "@/catalogue/dataviews";
import { AdmissionsViewPreview } from "@/components/admissions/AdmissionsDashboard";
import { KIND_GLYPH, TickGlyph, glyph } from "./bits";
import { presetsOf, setView, type Draft, type EditorEnv } from "./model";

type Props = { draft: Draft; set: (fn: (d: Draft) => Draft) => void; env: EditorEnv; wide: boolean };
export type AdmissionsDraft = Draft & { entryTicks?: EntryPointState[] };

const familyOf = (d: Draft) => d.spec.data.source as AdmissionsDataId;
const ENTRY_WORD: Record<EntryPointState, string> = { "4+": "4+", "11+": "11+", "16+": "16+", custom: "Custom age" };

/** The family's first preset on this host and side (the view a family switch starts from). */
export function familyPreset(env: EditorEnv, family: AdmissionsDataId, kind?: ViewKind): ViewSpec | null {
  const list = presetsOf(env.columnHost, env.side).filter((d) => d.supports.data.includes(family));
  const pick = list.find((d) => presetSpec(d.id).view.kind === kind) ?? list[0];
  return pick ? presetSpec(pick.id) : null;
}

export function AdmissionsDataStep({ draft, set, env }: Props) {
  const family = familyOf(draft);
  const lines = draft.spec.compare === "follows-page" ? null : draft.spec.compare;
  const on = (k: CompareSeries["kind"]) => !!lines?.some((l) => l.kind === k);
  const toggle = (k: CompareSeries["kind"]) =>
    set((d) => {
      const cur = d.spec.compare === "follows-page" ? [{ kind: "self", colour: "accent" } as CompareSeries] : d.spec.compare;
      const next = cur.some((l) => l.kind === k) ? cur.filter((l) => l.kind !== k) : [...cur, { kind: k, colour: k === "england" ? "england" : "muted" } as CompareSeries];
      return { ...d, spec: { ...d.spec, compare: next.length <= 1 ? "follows-page" : next } };
    });
  return (
    <>
      <div className="box">
        <div className="label">The data</div>
        <div className="fact" style={{ flexWrap: "wrap", gap: 6 }}>
          <span className="k">Data</span>
          {ADMISSIONS_FAMILIES.map((f) => {
            const has = presetsOf(env.columnHost, env.side).some((d) => d.supports.data.includes(f.id));
            return (
              <button
                key={f.id}
                type="button"
                className={`chip${family === f.id ? " on" : ""}`}
                disabled={!has}
                title={has ? undefined : "No view of this family sits in this half of the dashboard."}
                aria-pressed={family === f.id}
                onClick={() => {
                  const p = familyPreset(env, f.id, draft.spec.view.kind);
                  if (p) set((d) => ({ ...d, spec: p, title: null }));
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="fact">
          <span className="k">Entry point</span>
          <span>Follows the dashboard&rsquo;s entry point <span className="sub">(4+, 11+, 16+ or a custom age: the chips at the top)</span></span>
        </div>
        <div className="fact">
          <span className="k">Years</span>
          <span>{"latest" in draft.spec.data.years ? "The latest census or results year" : "Every year from 2019/20 (results: 2022/23), rolling on"}</span>
        </div>
      </div>
      <div className="box">
        <div className="label">Compared with</div>
        <div style={{ fontSize: 11, color: "var(--cc-sub)", marginTop: -4 }}>{lines ? "This view's own lines." : "Follows the page: the sets the top bar and the lead's lists give."}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ADMISSIONS_COMPARE.map((o) => {
            const fits = o.families.includes(family);
            return (
              <button key={o.kind} type="button" className={`chip${on(o.kind) ? " on" : ""}`} disabled={!fits} aria-pressed={on(o.kind)} title={fits ? o.why : `Not for this family: ${o.why}`} onClick={() => toggle(o.kind)}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function AdmissionsViewStep({ draft, set, wide }: Props) {
  const family = familyOf(draft);
  // The family's own kinds first, then the other Admissions kinds (greyed with the reason).
  const kinds: ViewKind[] = Array.from(new Set<ViewKind>([...(ADMISSIONS_KINDS[family] ?? []), ...ADMISSIONS_VIEW_KINDS]));
  void VIEW_KINDS;
  const look = draft.spec.view.look as Record<string, unknown>;
  const setLook = (k: string, v: unknown) => set((d) => ({ ...d, spec: { ...d.spec, view: { ...d.spec.view, look: { ...(d.spec.view.look as object), [k]: v } } as ViewSpec["view"] } }));
  const flag = (k: string, label: string): ReactNode => (
    <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
      <input type="checkbox" checked={!!look[k]} onChange={(e) => setLook(k, e.target.checked)} /> {label}
    </label>
  );
  const kind = draft.spec.view.kind;
  const lookBody: ReactNode =
    kind === "pipeline" ? (
      <>
        {flag("pastPools", "Past pools before now")}
        {flag("rungLabels", "Rung labels under the axis")}
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <input type="checkbox" checked={look.projection === "member"} onChange={(e) => setLook("projection", e.target.checked ? "member" : "off")} /> Members can turn the projection on (11+)
        </label>
      </>
    ) : kind === "scatter" ? (
      <>
        {flag("labels", "Name each school")}
        {flag("quadrantNames", "Name the quadrants")}
      </>
    ) : kind === "strengths" ? (
      <>
        {flag("showFlags", "Show the flags column")}
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          Order <select value={String(look.order ?? "gap")} onChange={(e) => setLook("order", e.target.value)}><option value="gap">By the gap</option><option value="az">A to Z</option></select>
        </label>
      </>
    ) : kind === "shapes" ? (
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
        Columns <select value={String(look.columns ?? 2)} onChange={(e) => setLook("columns", Number(e.target.value))}><option>1</option><option>2</option><option>3</option></select>
      </label>
    ) : kind === "flags" ? (
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
        Show <select value={String(look.show ?? "flagged")} onChange={(e) => setLook("show", e.target.value)}><option value="flagged">Flagged rivals</option><option value="all">Every rival</option></select>
      </label>
    ) : (
      <div style={{ fontSize: 12, color: "var(--cc-label)" }}>Nothing more to set for the {VIEW_LABEL[kind].toLowerCase()}: it draws what 1 &middot; Data gives it.</div>
    );
  return (
    <>
      <div className="label">a &middot; Which view</div>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(7, 1fr)" : "repeat(3, 1fr)", gap: wide ? 6 : 7 }}>
        {kinds.map((k) => {
          const h = admissionsViewHonest(family, k);
          const onK = kind === k;
          return (
            <button key={k} type="button" className={`kind${onK ? " on" : ""}${!h.ok && !onK ? " off" : ""}`} disabled={!h.ok && !onK} title={h.ok ? undefined : h.reason} aria-pressed={onK} onClick={() => set((d) => ({ ...d, spec: setView(d.spec, k) }))}>
              {glyph(KIND_GLYPH[k])}
              {VIEW_LABEL[k]}
            </button>
          );
        })}
      </div>
      <div className="box">
        <div className="label">b &middot; How the {VIEW_LABEL[kind].toLowerCase()} looks</div>
        {lookBody}
      </div>
      <div className="box" style={{ background: "var(--cc-panel)" }}>
        <div className="label">Fixed by the catalogue&rsquo;s rules (not editable)</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, lineHeight: 1.5, color: "var(--cc-sub)" }}>
          {ADMISSIONS_FIXED.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** 3 · Preview: the view for a school, and "Shows for" -- entry points, where Teacher lists result types. */
export function AdmissionsPreviewStep({ draft, set, dataview, school, wide }: Props & { dataview: string; school: { urn: string; name: string } | null }) {
  const d = draft as AdmissionsDraft;
  const dv = dataviewById(dataview);
  const can = (dv?.variants?.entryPoint ?? AXIS_STATES.entryPoint) as EntryPointState[];
  const ticks = d.entryTicks ?? can;
  return (
    <>
      <div className="pv" style={{ padding: "9px 10px 8px" }}>
        <div className="pvh">
          <span>Live preview &middot; {school?.name ?? "no school"} &middot; 11+</span>
        </div>
        {school ? <AdmissionsViewPreview dataview={dataview} urn={school.urn} schoolName={school.name} entry="11+" height={wide ? 360 : 300} /> : <div style={{ fontSize: 11, color: "var(--muted)", padding: 8 }}>A live preview needs a school: look as a school to see it drawn.</div>}
      </div>
      <div className="box">
        <div className="label">Shows for</div>
        <div style={{ fontSize: 11, color: "var(--cc-sub)", marginTop: -4 }}>The entry points this view shows on. Untick to take it off one; it can&rsquo;t come off every one.</div>
        <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4, 1fr)" : "1fr 1fr", gap: 7 }}>
          {AXIS_STATES.entryPoint.map((s) => {
            const ok = can.includes(s);
            const onS = ok && ticks.includes(s);
            return (
              <button
                key={s}
                type="button"
                className={`res${onS ? " on" : ""}${ok ? "" : " no"}`}
                disabled={!ok || (onS && ticks.length === 1)}
                aria-pressed={onS}
                title={ok ? undefined : dv?.note ?? "This view can't be drawn on this entry point."}
                onClick={() => set((x) => ({ ...x, entryTicks: onS ? ticks.filter((t) => t !== s) : [...ticks, s] }) as AdmissionsDraft)}
              >
                <span className="rh" style={ok ? undefined : { color: "var(--cc-faint)" }}>
                  <span className={`tick${onS ? "" : " offb"}`}>{onS ? <TickGlyph /> : null}</span>
                  {ENTRY_WORD[s]}
                </span>
                <span className="note">{ok ? "" : "Can't draw"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
