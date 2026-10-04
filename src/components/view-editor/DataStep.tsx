"use client";

// VicData 0.6.1 S4: 1 · Data (AddView1) -- what is measured, one value per year / subject /
// grade / school, shown as actual / indexed / change, which years, and what it is compared
// with: the lines list (✕, colour swatches), "+ Add a place or a school", and "Add an
// average" (an average of things NOT drawn). Every option is the catalogue's (honest.ts);
// a greyed one says why.
//
// D6, other schools' data (Comparisons): in place of the lines list, "Schools": follows the
// page / 10 nearest / saved set / sector…, drawn in AddView1's own boxes and chips (no board;
// the layout is a logged judgement call, 0.6.1 view editor rebuild).
import { useState } from "react";
import { yearsOf } from "@/catalogue/pick";
import type { CompareSeries, CompareSeriesKind, ViewPer, ViewRows } from "@/catalogue/viewspec";
import {
  AVERAGE_ACROSS_SCHOOLS,
  AVERAGE_AT_SCHOOL,
  LINE_KINDS,
  averageHow,
  catalogueMeasure,
  changeLabel,
  compareHonest,
  dishonestChange,
  perHonest,
  rowsOptions,
  schoolSetHost,
  shownAsHonest,
} from "@/catalogue/honest";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import { addLine, averageOf, defaultColour, honestCtx, removeLine, setAverage, setLine, setPer, setShownAs, type Draft, type EditorEnv } from "./model";
import { Chip, Chips, CloseGlyph } from "./bits";

export type StepProps = {
  draft: Draft;
  set: (fn: (d: Draft) => Draft) => void;
  env: EditorEnv;
  theme: "dark" | "light";
  wide: boolean;
  school: string | null;
};

const PHASE = { ks4: "GCSE", ks5: "Post-16" } as const;

// A compare series' colour token, drawn for the theme.
export function swatchColour(token: string, theme: "dark" | "light"): string {
  const pal = theme === "light" ? PALETTE_LIGHT : PALETTE_DARK;
  if (token === "accent") return "var(--accent, var(--fg))";
  if (token === "muted") return "var(--muted3)";
  if (token === "fg") return "var(--fg)";
  if (token === "england") return pal[3];
  const m = /^palette:(\d)$/.exec(token);
  if (m) return pal[Number(m[1])] ?? pal[0];
  if (token === "palette") return pal[0];
  return token;
}
const SWATCHES = ["palette:3", "palette:4", "palette:6", "palette:2", "palette:0", "palette:1", "palette:5", "muted"];

const yearLabel = (period: number) => `${period}/${String((period + 1) % 100).padStart(2, "0")}`;
const periodOf = (y: string) => Number(y.slice(0, 4));

export function lineName(kind: CompareSeriesKind, env: EditorEnv, average?: CompareSeries["average"]): { name: string; sub: string } {
  const l = env.ctx.labels;
  const how = average === "median" ? "Median" : average === "weighted" ? "Weighted average" : "Average";
  switch (kind) {
    case "self":
      return { name: "This school", sub: `${l.school ?? "The school"} · always shown` };
    case "category":
      return { name: l.category ?? "Subject category", sub: average ? `${how} of the category at this school` : "Category average at this school" };
    case "allSubjects":
      return { name: "All subjects", sub: `${how} at this school` };
    case "selectedSubjects":
      return { name: "Selected subjects", sub: `${how} at this school (the page's selection)` };
    case "la":
      return { name: l.la ?? "Local authority", sub: "Local authority" };
    case "region":
      return { name: l.region ?? "Region", sub: "Region" };
    case "england":
      return { name: "England", sub: "National" };
    case "nearest":
      return { name: "10 nearest schools", sub: `${how} across the set` };
    case "savedSet":
      return { name: "Saved set", sub: `${how} across the set` };
    case "chosenSchool":
      return { name: "A chosen school", sub: "Another school" };
    case "otherSubject":
      return { name: "Another subject", sub: "At this school" };
  }
}

const ADD_WORD: Partial<Record<CompareSeriesKind, string>> = {
  category: "Subject category",
  la: "LA",
  region: "Region",
  england: "England",
  chosenSchool: "A chosen school…",
  otherSubject: "Another subject here…",
};

function XButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="x" aria-label={label} onClick={onClick}>
      <CloseGlyph size={12} width={2.4} />
    </button>
  );
}

export function DataStep({ draft, set, env, theme, wide }: StepProps) {
  const spec = draft.spec;
  const ctx = honestCtx(env);
  const schoolSet = schoolSetHost(env.columnHost);
  const span = "from" in spec.data.years;
  const [open, setOpen] = useState<number | null>(null);
  const setSpec = (fn: (s: Draft["spec"]) => Draft["spec"]) => set((d) => ({ ...d, spec: fn(d.spec) }));
  const measure = catalogueMeasure(env.phase, env.measure);
  const years = yearsOf(measure);
  const latest = years[years.length - 1];
  const fromYears = years.slice(0, -1);
  const subjectLabel = env.ctx.focus.subject?.label ?? null;

  // ------------------------------------------------------------ The data
  const dataBox = (
    <div className="box">
      <div className="label">The data</div>
      <div className="fact">
        <span className="k">Data</span>
        {PHASE[env.phase]} &middot; {env.ctx.data === "academic.candidates" ? "Candidates" : "Results"}
        <button type="button" className="link" disabled title={`A view draws its column's data: this column is ${env.ctx.data === "academic.candidates" ? "Candidates" : "Results"}. Other data goes in its own column.`}>
          Change
        </button>
      </div>
      <div className="fact">
        <span className="k">Subject</span>
        <span>
          Follows the dashboard&rsquo;s subject{subjectLabel ? <span className="sub"> ({subjectLabel})</span> : null}
          {spec.data.subject === "follows-or-whole-school" ? <span className="sub"> &middot; the whole school with none</span> : null}
        </span>
      </div>
    </div>
  );

  // ------------------------------------------------------------ The numbers
  const PER: { per: ViewPer; label: string }[] = [
    { per: "year", label: "Year" },
    { per: "subject", label: "Subject" },
    { per: "grade", label: "Grade" },
    { per: "school", label: "School" },
  ];
  const rowsOpts = rowsOptions(env.columnHost);
  const showRows = !schoolSet && rowsOpts.length > 0 && (spec.data.per === "year" || spec.data.per === "subject");
  const sameRows = (a: ViewRows | undefined | null, b: ViewRows | null) => (a ?? null) === b || (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));
  const off = dishonestChange(env.measure);
  const fromActive = (p: number, i: number) => "from" in spec.data.years && (spec.data.years.from === p || (spec.data.years.from === "first" && i === 0));
  const numbersBox = (
    <div className="box">
      <div className="label">The numbers</div>
      <div className="fact" style={{ alignItems: "flex-start" }}>
        <span className="k" style={{ paddingTop: 4 }}>One value per</span>
        <Chips>
          {PER.map(({ per, label }) => {
            const h = perHonest(ctx, per);
            return (
              <Chip key={per} on={spec.data.per === per} off={!h.ok && spec.data.per !== per} reason={h.reason} onClick={() => setSpec((s) => setPer(s, per, env))}>
                {label}
              </Chip>
            );
          })}
        </Chips>
      </div>
      {showRows && (
        <div className="fact" style={{ alignItems: "flex-start" }}>
          <span className="k" style={{ paddingTop: 4 }}>Which subjects</span>
          <Chips>
            {rowsOpts.map((o) => (
              <Chip
                key={o.label}
                on={sameRows(spec.data.rows, o.rows)}
                onClick={() =>
                  setSpec((s) => {
                    const data = { ...s.data };
                    if (o.rows) data.rows = o.rows;
                    else delete data.rows;
                    return { ...s, data };
                  })
                }
              >
                {o.label}
              </Chip>
            ))}
          </Chips>
        </div>
      )}
      <div className="fact" style={{ alignItems: "flex-start" }}>
        <span className="k" style={{ paddingTop: 4 }}>Shown as</span>
        <Chips>
          {(["actual", "indexed", "change"] as const).map((a) => {
            const h = shownAsHonest(ctx, a, spec.data.per);
            const label = a === "actual" ? "Actual" : a === "indexed" ? "Indexed" : changeLabel(env.measure);
            return (
              <Chip key={a} on={spec.data.shownAs === a} off={!h.ok && spec.data.shownAs !== a} reason={h.reason} onClick={() => setSpec((s) => setShownAs(s, a, env))}>
                {label}
              </Chip>
            );
          })}
          {off && (
            <Chip off reason={off.reason}>
              {off.label}
            </Chip>
          )}
        </Chips>
      </div>
      <div className="fact">
        <span className="k">Years</span>
        {"from" in spec.data.years ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            {fromYears.map((y, i) => (
              <Chip key={y} on={fromActive(periodOf(y), i)} onClick={() => setSpec((s) => ({ ...s, data: { ...s.data, years: { ...("from" in s.data.years ? s.data.years : { rollOn: true }), from: i === 0 ? "first" : periodOf(y) } } }))}>
                {y}
              </Chip>
            ))}
            <span className="sub">&rarr; latest &middot; rolls on</span>
          </div>
        ) : (
          <span>
            Latest year{latest ? <span className="sub"> ({latest}) &middot; rolls on</span> : null}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--cc-faint)" }}>
        {env.side === "trend" ? "Year is picked because this is the Trends row. On a Current row it starts on Subject, latest year." : `${schoolSet ? "School" : "Subject"} is picked because this is the Current row. On a Trends row it starts on Year.`}
        {measure.results && measure.results !== "points" && !schoolSet && spec.data.per !== "school" ? " School grade rows cover 2023/24 and 2024/25 only." : ""}
      </div>
    </div>
  );

  // ------------------------------------------------------------ Compared with
  const list = spec.compare === "follows-page" ? null : spec.compare;
  const avg = averageOf(spec);
  const lineRow = (c: CompareSeries, i: number) => {
    const n = lineName(c.kind, env, c.average);
    const h = compareHonest(ctx, c.kind, { span });
    const isOpen = open === i;
    return (
      <div key={`${c.kind}-${i}`} className="row" style={{ flexWrap: isOpen ? "wrap" : undefined, ...(h.ok ? {} : { borderStyle: "dashed" }) }}>
        <button type="button" className={`sw${isOpen ? " open" : ""}`} style={{ background: swatchColour(c.colour, theme) }} aria-label={`Colour for ${n.name}${isOpen ? ", open" : ""}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{n.name}</div>
          <div className="sub" style={h.ok ? undefined : { color: "var(--cc-banner-fg)" }}>
            {h.ok ? n.sub : h.reason}
          </div>
        </div>
        {c.kind !== "self" && <XButton label={`Remove ${n.name}`} onClick={() => { setOpen(null); setSpec((s) => removeLine(s, i)); }} />}
        {isOpen && (
          <div style={{ flex: "1 0 100%", display: "flex", gap: 6, alignItems: "center", padding: "6px 0 1px 27px", flexWrap: "wrap" }}>
            <span className="sub">Colour</span>
            {[...(c.kind === "self" ? ["accent"] : []), ...SWATCHES].map((t) => (
              <button
                key={t}
                type="button"
                className="sw"
                style={{ background: swatchColour(t, theme), ...(t === c.colour ? { outline: "2px solid var(--cc-ink)", outlineOffset: 1 } : {}) }}
                aria-label={t === "accent" ? "The dashboard's colour" : t === "muted" ? "Pale grey" : `Colour ${t.slice(8)}`}
                aria-pressed={t === c.colour}
                onClick={() => setSpec((s) => setLine(s, i, { colour: t }))}
              />
            ))}
          </div>
        )}
      </div>
    );
  };
  const present = new Set((list ?? []).filter((c) => !c.average).map((c) => c.kind));
  const addable = LINE_KINDS.filter((k) => !present.has(k));
  const comparedBox = (
    <div className="box">
      <div className="label">Compared with</div>
      {list ? (
        list.map((c, i) => (c.average ? null : lineRow(c, i)))
      ) : (
        <div className="row">
          <span className="sw" aria-hidden="true" style={{ background: "var(--accent, var(--fg))", cursor: "default" }} />
          <div style={{ minWidth: 0 }}>
            <div className="nm">Follows the page</div>
            <div className="sub">{followsWords(env)}</div>
          </div>
          <XButton label="Stop following the page: choose the lines here" onClick={() => setSpec((s) => removeLine(s, -1))} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--cc-ink)" }}>+ Add a place or a school</div>
        <Chips>
          {addable.map((k) => {
            const h = compareHonest(ctx, k, { span });
            return (
              <Chip key={k} off={!h.ok} reason={h.reason} onClick={() => setSpec((s) => addLine(s, k))}>
                {ADD_WORD[k]}
              </Chip>
            );
          })}
        </Chips>
      </div>
    </div>
  );

  // ------------------------------------------------------------ D6: Schools
  const rows = spec.data.rows;
  const setName = env.ctx.compare.schools?.label ?? "10 nearest schools";
  const schoolsBox = (
    <div className="box">
      <div className="label">Schools</div>
      <div className="fact" style={{ alignItems: "flex-start" }}>
        <span className="k" style={{ paddingTop: 4 }}>Schools</span>
        <Chips>
          <Chip on={!rows || rows === "follows-page"} onClick={() => setSpec((s) => ({ ...s, data: { ...s.data, rows: "follows-page" } }))}>
            Follows the page
          </Chip>
          <Chip on={rows === "nearest"} onClick={() => setSpec((s) => ({ ...s, data: { ...s.data, rows: "nearest" } }))}>
            10 nearest
          </Chip>
          <Chip on={typeof rows === "object"} off={typeof rows !== "object"} reason="A saved set is chosen on the page: pick it in Compared against, then use Follows the page.">
            {typeof rows === "object" ? rows.savedSet : "Saved set…"}
          </Chip>
          <Chip off reason="Sector sets aren't in a view's settings yet.">
            Sector&hellip;
          </Chip>
        </Chips>
      </div>
      <div className="sub" style={{ lineHeight: 1.4 }}>
        {!rows || rows === "follows-page" ? <>The members&rsquo; own Compared against set (now: {setName}). Their choice keeps working.</> : rows === "nearest" ? "Always the 10 nearest schools, whatever the page is set to." : typeof rows === "object" ? `Always the saved set ${rows.savedSet}.` : ""}
      </div>
      <div className="row">
        <span className="sw" aria-hidden="true" style={{ background: swatchColour(list?.find((c) => c.kind === "self")?.colour ?? "accent", theme), cursor: "default" }} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">This school</div>
          <div className="sub">{env.ctx.labels.school ?? "The school"} &middot; always shown, highlighted</div>
        </div>
      </div>
    </div>
  );

  // ------------------------------------------------------------ Add an average
  const across = avg ? AVERAGE_ACROSS_SCHOOLS.includes(avg.series.kind) : schoolSet;
  const kinds = across ? AVERAGE_ACROSS_SCHOOLS : AVERAGE_AT_SCHOOL;
  const firstOk = (ks: CompareSeriesKind[]) => ks.find((k) => compareHonest(ctx, k, { span }).ok);
  const startAvg = (ks: CompareSeriesKind[]): CompareSeries | null => {
    const k = firstOk(ks);
    return k ? { kind: k, colour: defaultColour(k), average: avg?.series.average ?? "mean" } : null;
  };
  const canAvg = !!firstOk([...AVERAGE_AT_SCHOOL, ...AVERAGE_ACROSS_SCHOOLS]);
  const averageBox = (
    <div className="box" style={{ gap: 7 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: canAvg ? "var(--cc-ink)" : "var(--cc-faint)", cursor: canAvg ? "pointer" : "not-allowed" }} title={canAvg ? undefined : "No average is published for this measure."}>
        <input type="checkbox" checked={!!avg} disabled={!canAvg} onChange={(e) => setSpec((s) => setAverage(s, e.target.checked ? startAvg(schoolSet ? AVERAGE_ACROSS_SCHOOLS : AVERAGE_AT_SCHOOL) ?? startAvg(AVERAGE_ACROSS_SCHOOLS) : null))} style={{ width: 15, height: 15, accentColor: "var(--cc-primary)", margin: 0 }} />
        Add an average
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, color: "var(--cc-faint)" }}>a line for something not drawn</span>
      </label>
      {avg && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingLeft: 23 }}>
          <div className="seg3">
            {[
              { id: false, label: "At this school", ks: AVERAGE_AT_SCHOOL },
              { id: true, label: "Across schools", ks: AVERAGE_ACROSS_SCHOOLS },
            ].map((o) => {
              const can = !!firstOk(o.ks);
              return (
                <button key={o.label} type="button" className={across === o.id ? "on" : ""} disabled={!can} title={can ? undefined : (compareHonest(ctx, o.ks[0], { span }).reason ?? undefined)} aria-pressed={across === o.id} onClick={() => setSpec((s) => setAverage(s, startAvg(o.ks)))}>
                  {o.label}
                </button>
              );
            })}
          </div>
          <Chips>
            {kinds.map((k) => {
              const h = compareHonest(ctx, k, { span });
              const off2 = !h.ok || (k === "savedSet" && !schoolSet);
              const on = avg.series.kind === k;
              return (
                <Chip key={k} picked={on} off={off2 && !on} reason={h.reason ?? "A saved set is chosen on a Comparisons page."} onClick={() => setSpec((s) => setAverage(s, { ...avg.series, kind: k }))}>
                  {lineName(k, env).name}
                  {on ? " ✓" : ""}
                </Chip>
              );
            })}
          </Chips>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--cc-sub)", flexWrap: "wrap" }}>
            <span>As a</span>
            {(["mean", "median", "weighted"] as const).map((how) => {
              const h = averageHow(ctx, how);
              return (
                <Chip key={how} sm picked={avg.series.average === how} off={!h.ok} reason={h.reason} onClick={() => setSpec((s) => setAverage(s, { ...avg.series, average: how }))}>
                  {how === "weighted" ? "weighted by entries" : how}
                </Chip>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const started = (
    <div style={{ fontSize: 11.5, color: "var(--cc-sub)", lineHeight: 1.45 }}>
      {list ? (
        <>
          Lines: <b style={{ color: "var(--cc-label)" }}>{list.map((c) => lineName(c.kind, env, c.average).name + (c.average ? " average" : "")).join(" + ")}</b>. Removing or adding here changes this view only.
        </>
      ) : (
        <>
          Started from the column: <b style={{ color: "var(--cc-label)" }}>{followsWords(env)}</b>. Removing or adding here changes this view only.
        </>
      )}
    </div>
  );

  const compare = schoolSet ? schoolsBox : comparedBox;
  if (wide)
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {dataBox}
          {numbersBox}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {compare}
          {averageBox}
          {started}
        </div>
      </div>
    );
  return (
    <>
      {dataBox}
      {numbersBox}
      {compare}
      {averageBox}
      {started}
    </>
  );
}

// What "follows the page" draws, in the page's words.
export function followsWords(env: EditorEnv): string {
  const c = env.ctx.compare;
  if (env.columnHost === "teacher.c2.context") return `the members' Compare against setting (now: ${c.subjects?.label ?? "the category"})`;
  if (env.columnHost === "teacher.c3.comparisons") return `the members' Compared against set (now: ${c.schools?.label ?? "10 nearest schools"})`;
  return "what this column draws today";
}

export { yearLabel };
