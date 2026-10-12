"use client";

// VicData 0.7 admissions r2 (D7): the existing view editor's steps for an Admissions column -- no
// new dialogue, the same boxes and controls:
//   1 · Data     the families (Pupils by age, Pipeline, Market share, Rivals' results); the entry
//                point plays the subject's part ("follows the dashboard's entry point"); the compare
//                options this view draws (its feeder set, for a boarding school; its lines)
//   2 · View     the kinds each family can draw, with the look options this view draws; what can't
//                be edited (certainty styling, honesty wording, flag thresholds, shapes not ranked)
//                is a fixed note naming its rules
//   3 · Preview  the view drawn for a school at the edit bar's entry point and the panel's real
//                size, and "Shows for": entry points where Teacher lists result types
//
// 0.7 admissions editor s1-2 (docs/v0.7/admissions_editor_plan_v1.md): every option offered is one
// the page draws (src/catalogue/admissions-editor.ts) -- Guy's decision 1: no control without an
// effect. A view keeps its own dataview while only its looks or compare change (buildAdmissions).
import type { ReactNode } from "react";
import type { ViewKind, ViewSpec } from "@/catalogue/viewspec";
import type { AdmissionsDataId, DataviewId, EntryPointState } from "@/catalogue/types";
import { ADMISSIONS_FAMILIES } from "@/catalogue/admissions";
import { ADMISSIONS_FIXED, ADMISSIONS_KINDS, VIEW_LABEL, admissionsViewHonest } from "@/catalogue/honest";
import { ADMISSIONS_LOOKS, ADMISSIONS_NEEDS_SPAN, ADMISSIONS_SPAN_WARNING, ADMISSIONS_VIEW_COMPARE, compareOf, compareState, type FeederChoice } from "@/catalogue/admissions-editor";
import { ADMISSIONS_VIEW_KINDS } from "@/catalogue/viewspec";
import { presetSpec } from "@/catalogue/viewspec";
import { AXIS_STATES } from "@/catalogue/variants";
import { dataviewById } from "@/catalogue/dataviews";
import { titleTemplateOf } from "@/catalogue/pick";
import { AdmissionsViewPreview, admissionsBodySize } from "@/components/admissions/AdmissionsDashboard";
import { MeasureScale } from "@/components/admissions/views/charts";
import { useBoardingSchool } from "@/components/admissions/useBoardingSchool";
import { KIND_GLYPH, TickGlyph, glyph } from "./bits";
import { buildInstance, hostPresetFor, drawingHost, presetsOf, setView, type Draft, type EditorEnv, type ViewInstance } from "./model";

type Props = { draft: Draft; set: (fn: (d: Draft) => Draft) => void; env: EditorEnv; wide: boolean };
export type AdmissionsDraft = Draft & { entryTicks?: EntryPointState[] };

const familyOf = (d: Draft) => d.spec.data.source as AdmissionsDataId;
const ENTRY_WORD: Record<EntryPointState, string> = { "4+": "4+", "11+": "11+", "16+": "16+", custom: "Custom age" };

/** The entry point the preview draws: the edit bar's (custom previews at 11+ until stage 4). */
export function previewEntry(env: EditorEnv): { entry: string; label: string } {
  const e = env.admissions?.entry ?? "11+";
  return e === "custom" ? { entry: "11+", label: "Custom age (previewed at 11+)" } : { entry: e, label: e };
}

/** The family's first preset on this host and side (the view a family switch starts from). */
export function familyPreset(env: EditorEnv, family: AdmissionsDataId, kind?: ViewKind): ViewSpec | null {
  const list = presetsOf(env.columnHost, env.side).filter((d) => d.supports.data.includes(family));
  const pick = list.find((d) => presetSpec(d.id).view.kind === kind) ?? list[0];
  return pick ? presetSpec(pick.id) : null;
}

// The shape of a view: what makes it this dataview rather than a sibling. Looks and compare are
// the instance's own; they never move it to another preset.
const shapeOf = (s: ViewSpec) => JSON.stringify([s.data.source, s.data.per, s.data.shownAs, s.view.kind]);

/** The dataview an Admissions draft is drawn by: the one it came from while its shape is unchanged,
 * else the host's nearest preset. (Teacher's buildInstance re-picks by the whole spec, which on
 * Admissions would turn a Pool trends table with a dropped line into Your cohort's table.) */
export function admissionsDataview(draft: Draft, env: EditorEnv, original?: ViewInstance): DataviewId {
  for (const id of [original?.dataview, draft.spec.preset].filter(Boolean) as DataviewId[]) {
    try {
      if (shapeOf(presetSpec(id)) === shapeOf(draft.spec)) return id;
    } catch {
      /* an id the catalogue no longer has */
    }
  }
  return hostPresetFor(draft.spec, drawingHost(env), env.side, draft.spec.data.source as never).id;
}

/** The instance an Admissions draft saves as: Teacher's builder, held to the view's own dataview. */
export function buildAdmissions(draft: Draft, env: EditorEnv, original?: ViewInstance): ViewInstance {
  const built = buildInstance(draft, { ...env, ctx: { ...env.ctx, data: draft.spec.data.source as never } }, original);
  const id = admissionsDataview(draft, env, original);
  if (id === built.dataview) return built;
  const dv = dataviewById(id)!;
  const preset = presetSpec(id);
  const same = JSON.stringify({ d: preset.data, c: preset.compare, v: preset.view, i: preset.icon }) === JSON.stringify({ d: draft.spec.data, c: draft.spec.compare, v: draft.spec.view, i: draft.spec.icon });
  const typed = draft.title?.trim() && draft.title.trim() !== titleTemplateOf(dv).trim() ? draft.title : null;
  const spec: ViewSpec = same ? preset : { ...structuredClone(draft.spec), ...(preset.variants ? { variants: structuredClone(preset.variants) } : {}), title: titleTemplateOf(dv), preset: id };
  if (!preset.variants) delete spec.variants;
  const keepParams = original && original.dataview === id ? { ...(original.params ?? {}) } : {};
  return {
    id: original?.id ?? "new",
    kind: "view",
    dataview: id,
    spec,
    ...(Object.keys(keepParams).length ? { params: keepParams } : {}),
    ...(typed ? { title: typed } : {}),
    ...(original?.variants ? { variants: structuredClone(original.variants) } : {}),
  };
}

// ------------------------------------------------------------------------------ 1 · Data

export function AdmissionsDataStep({ draft, set, env, school = null, dataview }: Props & { school?: { urn: string; name: string } | null; dataview: DataviewId }) {
  const family = familyOf(draft);
  // 0.7 r3 (F2): previewing a day school, the feeder set isn't a choice (no boarding feeders).
  const boardingSchool = useBoardingSchool(school?.urn ?? null);
  const opts = ADMISSIONS_VIEW_COMPARE[dataview];
  const st = compareState(draft.spec.compare, opts);
  const write = (next: typeof st) => set((d) => ({ ...d, spec: { ...d.spec, compare: compareOf(next, opts) } }));
  const feederChoices: { id: FeederChoice; label: string }[] = [
    { id: "page", label: "Follow the page" },
    { id: "day", label: "Day feeders" },
    { id: "boarding", label: "Boarding feeders" },
    { id: "both", label: "Both" },
  ];
  const showFeeders = !!opts?.feeders && boardingSchool === true;
  const lines = opts?.lines ?? [];
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
        {!showFeeders && !lines.length ? (
          <div data-adm-compare="none" style={{ fontSize: 11.5, color: "var(--cc-sub)", lineHeight: 1.45 }}>
            {dataview === "DV-ADM-P-FUNNEL"
              ? "The funnel draws one area: the school's LA, or the lead's LA blend. Births and the Year 6 or Year 11 pool both follow it, so there is nothing to choose here."
              : "This view draws the page's sets: the top bar's feeder lists, or the lead's rivals. Nothing to choose for it."}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--cc-sub)", marginTop: -4 }}>{draft.spec.compare === "follows-page" ? "Follows the page: the sets the top bar and the lead's lists give." : "This view's own sets."}</div>
            {showFeeders && (
              <div data-adm-compare="feeders" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {feederChoices.map((c) => (
                  <button key={c.id} type="button" className={`chip${st.feeders === c.id ? " on" : ""}`} aria-pressed={st.feeders === c.id} onClick={() => write({ ...st, feeders: c.id })}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {lines.length > 0 && (
              <div data-adm-compare="lines" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {lines.map(({ kind: k, label }) => {
                  const on = st.lines.has(k);
                  // At least one line stays: a view with none would draw nothing.
                  const last = on && lines.filter((l) => st.lines.has(l.kind)).length === 1;
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`chip${on ? " on" : ""}`}
                      aria-pressed={on}
                      disabled={last}
                      title={last ? "The view needs at least one" : undefined}
                      onClick={() => {
                        const next = new Set(st.lines);
                        if (on) next.delete(k);
                        else next.add(k);
                        write({ ...st, lines: next });
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------ 2 · View

export function AdmissionsViewStep({ draft, set, wide, dataview }: Props & { dataview: DataviewId }) {
  const family = familyOf(draft);
  // The family's own kinds first, then the other Admissions kinds (greyed with the reason).
  const kinds: ViewKind[] = Array.from(new Set<ViewKind>([...(ADMISSIONS_KINDS[family] ?? []), ...ADMISSIONS_VIEW_KINDS]));
  const look = draft.spec.view.look as Record<string, unknown>;
  const setLook = (k: string, v: unknown) => set((d) => ({ ...d, spec: { ...d.spec, view: { ...d.spec.view, look: { ...(d.spec.view.look as object), [k]: v } } as ViewSpec["view"] } }));
  const kind = draft.spec.view.kind;
  // Only the options this view draws (a kind changed in this step is another view: none until saved).
  const options = draft.spec.view.kind === presetSpec(dataview).view.kind ? (ADMISSIONS_LOOKS[dataview] ?? []) : [];
  const row = (k: string, body: ReactNode) => (
    <label key={k} data-adm-look={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
      {body}
    </label>
  );
  const lookBody: ReactNode = options.length ? (
    <>
      {options.map((o) => {
        const value = look[o.key] ?? o.fallback;
        if (o.choices === "tick")
          return row(
            o.key,
            <>
              <input type="checkbox" checked={!!value} onChange={(e) => setLook(o.key, e.target.checked)} /> {o.label}
            </>,
          );
        const choices = o.choices;
        return row(
          o.key,
          <>
            {o.label}{" "}
            <select value={String(value)} onChange={(e) => setLook(o.key, choices.find((c) => String(c.value) === e.target.value)?.value)}>
              {choices.map((c) => (
                <option key={String(c.value)} value={String(c.value)}>
                  {c.label}
                </option>
              ))}
            </select>
          </>,
        );
      })}
    </>
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
            <li key={f.text}>
              {f.text} <span style={{ color: "var(--cc-faint)" }}>({f.rules.join(", ")})</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------ 3 · Preview

/** The span warning (Guy's decision 2): a view that needs two columns, in a one-unit panel. */
export function spanWarning(env: EditorEnv, dataview: DataviewId): string | null {
  return env.admissions && (env.admissions.span ?? 1) < 2 && ADMISSIONS_NEEDS_SPAN.has(dataview) ? ADMISSIONS_SPAN_WARNING : null;
}

/** The view at the panel's real size on the Admissions page, scaled down to `width` when wider. */
export function AdmissionsScaledPreview({ env, dataview, spec, school, width }: { env: EditorEnv; dataview: DataviewId; spec?: ViewSpec; school: { urn: string; name: string }; width: number }) {
  const a = env.admissions ?? { family: "" };
  const size = admissionsBodySize(a.span ?? 1, a.firstRow ?? true, a.railed ?? true);
  const k = Math.min(1, width / size.width);
  return (
    <div data-adm-preview={`${size.width}x${size.height}`} style={{ width, height: Math.round(size.height * k), overflow: "hidden", position: "relative" }}>
      <div style={{ width: size.width, transform: k < 1 ? `scale(${k})` : undefined, transformOrigin: "0 0" }}>
        <MeasureScale.Provider value={k}>
          <AdmissionsViewPreview dataview={dataview} spec={spec} urn={school.urn} schoolName={school.name} entry={previewEntry(env).entry} height={size.height} />
        </MeasureScale.Provider>
      </div>
    </div>
  );
}

/** 3 · Preview: the view for a school, and "Shows for" -- entry points, where Teacher lists result types. */
export function AdmissionsPreviewStep({ draft, set, env, dataview, spec, school, wide }: Props & { dataview: DataviewId; spec?: ViewSpec; school: { urn: string; name: string } | null }) {
  const d = draft as AdmissionsDraft;
  const dv = dataviewById(dataview);
  const can = (dv?.variants?.entryPoint ?? AXIS_STATES.entryPoint) as EntryPointState[];
  const ticks = d.entryTicks ?? can;
  const warn = spanWarning(env, dataview);
  return (
    <>
      {school && (
        <div className="pv" style={{ padding: "9px 10px 8px" }}>
          <div className="pvh">
            <span>
              Live preview &middot; {school.name} &middot; {previewEntry(env).label}
            </span>
          </div>
          <AdmissionsScaledPreview env={env} dataview={dataview} spec={spec} school={school} width={308} />
        </div>
      )}
      {warn && (
        <div className="note warn" data-adm-span-warning="" style={{ fontSize: 11.5 }}>
          {warn}.
        </div>
      )}
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
