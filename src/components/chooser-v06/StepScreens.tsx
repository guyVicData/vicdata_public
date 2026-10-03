"use client";

// Steps 1-2, reached only through "Change" (scope brief §3): Step 1 Data (Ch1Data.dc.html),
// Step 2 Focus (Ch2Focus.dc.html), and the two sub-screens 2a Subject (Ch2Subject.dc.html,
// the onboarding subject picker in its single-select variant) and 2b Custom area
// (Ch2Custom.dc.html, the same picker multi-select). "Choose other schools…" opens the
// existing comparator chooser (the orchestrator mounts it).
//
// Pruning (scope brief §3): an option is offered only when it leads to at least one
// registered dataview. Rolls and Live births are the exception -- registered measures with
// no views yet, so they lead to the empty state (placeholder / ask). Super-admin also sees
// the other unbuilt focus and compare options, because planning a placeholder needs them
// (combinations doc C5, §6); everyone else never meets an option that leads nowhere.
import type { ReactNode } from "react";
import type { AverageId, PickPanelContext } from "@/catalogue/pick";
import {
  AREA_FOCUS,
  DATA_LABEL,
  FOCUS_LABEL,
  PHASE_LABEL,
  SCHOOL_FOCUS,
  compareLabel,
  countViews,
  headerLine,
  isAreaKeyed,
  measureFor,
  resultsLabel,
} from "@/catalogue/pick";
import type { DataId, FocusKind, Phase, ResultsMeasure } from "@/catalogue/types";
import { CategorySubjectPicker, type PickerItem } from "@/components/teacher/CategorySubjectPicker";
import { familyIcon } from "@/components/teacher/QualificationFamilyTiles";
import { Body, ChevronDownIcon, Footer, PrimaryButton } from "@/components/teacher/chooser/ui";
import type { QualificationFamily } from "@/lib/teacher-view-theme";
import { AvHeader, BoardChip, Seg2, StepLabel, SubLabel, Toggle } from "./bits";
import { DATA_FAMILY, type FamilyId } from "./layout";

export type SubjectSource = { items: PickerItem[]; families: QualificationFamily[]; mine: string[] };

const FooterLine = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 12.5, color: "var(--cc-label)", minWidth: 0 }}>{children}</div>;

export const familyOf = (d: DataId): FamilyId => (d === "rolls" ? "rolls" : d === "social.births" ? "social" : "academic");
const ACADEMIC: DataId[] = ["academic.candidates", "academic.results"];
const RESULTS: ResultsMeasure[] = ["points", "threshold", "bands", "counts"];
// Registered measures with no views yet: they lead to the empty state, never pruned.
export const leadsToPlaceholder = (d: DataId) => d === "rolls" || d === "social.births";

export function dataSummary(c: PickPanelContext): string {
  if (familyOf(c.data) !== "academic") return DATA_LABEL[c.data];
  return [PHASE_LABEL[c.phase], DATA_LABEL[c.data], ...(c.data === "academic.results" ? [resultsLabel(c.results ?? "points", c.phase)] : [])].join(" · ");
}

// Block 1's offer for this data (F7): school-keyed or area-keyed, pruned to views.
export function focusOptions(c: PickPanelContext, superAdmin: boolean): { kind: FocusKind; built: boolean }[] {
  const kinds = isAreaKeyed(c) ? AREA_FOCUS : SCHOOL_FOCUS;
  return kinds
    .map((kind) => ({ kind, built: countViews({ data: c.data, phase: c.phase, results: c.results, focus: kind }, superAdmin) > 0 }))
    .filter((o) => o.built || superAdmin || leadsToPlaceholder(c.data));
}

// ------------------------------------------------------------------------------ Step 1

function FamilyCard({
  id,
  open,
  fromColumn,
  theme,
  onOpen,
  children,
}: {
  id: FamilyId;
  open: boolean;
  fromColumn: boolean;
  theme: "dark" | "light";
  onOpen: () => void;
  children?: ReactNode;
}) {
  const f = DATA_FAMILY[id];
  const [bg, fg] = f[theme];
  const icon =
    id === "academic" ? (
      <><path d="M22 10v6" /><path d="M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>
    ) : id === "rolls" ? (
      <><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /></>
    ) : (
      <><circle cx="12" cy="10" r="3" /><path d="M12 21c-4-4-7-7.5-7-11a7 7 0 0 1 14 0c0 3.5-3 7-7 11z" /></>
    );
  return (
    <div style={{ border: open ? "1.5px solid var(--cc-blue)" : "1px solid var(--cc-border)", borderRadius: 12, background: "var(--cc-panel)", overflow: "hidden" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onOpen}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", width: "100%", background: open ? "var(--cc-blue-tint)" : "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 30px", background: bg, color: fg }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icon}
          </svg>
        </span>
        <span style={{ flex: "1 1 auto" }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--cc-ink)" }}>{f.label}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--cc-sub)", marginTop: 1 }}>{f.sub}</span>
        </span>
        {fromColumn ? (
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--cc-blue)", background: "var(--cc-blue-badge)", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>From this column</span>
        ) : !open ? (
          <ChevronDownIcon size={14} stroke="var(--cc-faint)" />
        ) : null}
      </button>
      {open && children}
    </div>
  );
}

const Sec = ({ children, soft }: { children: ReactNode; soft?: boolean }) => (
  <div style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--cc-border)", display: "flex", flexDirection: "column", gap: 8, background: soft ? "var(--av-soft2)" : undefined }}>{children}</div>
);

export function DataStep({
  draft,
  original,
  palette,
  superAdmin,
  theme,
  onDraft,
  onBack,
  onClose,
  onNext,
}: {
  draft: PickPanelContext;
  original: PickPanelContext;
  palette?: DataId[];
  superAdmin: boolean;
  theme: "dark" | "light";
  onDraft: (c: PickPanelContext) => void;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
}) {
  const allowed = (d: DataId) => !palette || palette.includes(d);
  const families = (["academic", "rolls", "social"] as FamilyId[]).filter((f) =>
    f === "academic" ? ACADEMIC.some(allowed) : f === "rolls" ? allowed("rolls") : allowed("social.births"),
  );
  const fam = familyOf(draft.data);
  const set = (patch: Partial<PickPanelContext>) => onDraft({ ...draft, ...patch });
  const openFamily = (f: FamilyId) => {
    if (f === fam) return;
    if (f === "academic") set({ data: familyOf(original.data) === "academic" ? original.data : ACADEMIC.find(allowed)!, results: original.results ?? "points" });
    else set({ data: f === "rolls" ? "rolls" : "social.births" });
  };
  const n = (p: Parameters<typeof countViews>[0]) => countViews(p, superAdmin);
  return (
    <>
      <AvHeader title="Change data" subtitle={headerLine(original)} segs={1} onBack={onBack} onClose={onClose} />
      <Body gap={10}>
        <StepLabel>Step 1 of 3 &middot; What data?</StepLabel>
        {families.map((f) => (
          <FamilyCard key={f} id={f} open={f === fam} fromColumn={f === familyOf(original.data)} theme={theme} onOpen={() => openFamily(f)}>
            {f === "academic" ? (
              <>
                <Sec>
                  <SubLabel>1 &middot; Phase</SubLabel>
                  <Seg2<Phase>
                    ariaLabel="Phase"
                    value={draft.phase}
                    onChange={(phase) => set({ phase })}
                    options={(["ks4", "ks5"] as Phase[]).map((p) => ({ id: p, label: PHASE_LABEL[p], disabled: n({ data: draft.data, phase: p }) === 0 }))}
                  />
                </Sec>
                <Sec>
                  <SubLabel>2 &middot; Measure</SubLabel>
                  <Seg2<DataId>
                    ariaLabel="Measure"
                    value={draft.data}
                    onChange={(data) => set({ data, results: data === "academic.results" ? (draft.results ?? "points") : draft.results })}
                    options={ACADEMIC.filter(allowed).map((d) => ({ id: d, label: DATA_LABEL[d], disabled: n({ data: d, phase: draft.phase }) === 0 }))}
                  />
                </Sec>
                {draft.data === "academic.results" && (
                  <Sec soft>
                    <SubLabel>3 &middot; Which result</SubLabel>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {RESULTS.filter((r) => n({ data: "academic.results", phase: draft.phase, results: r }) > 0).map((r) => (
                        <BoardChip key={r} active={(draft.results ?? "points") === r} onClick={() => set({ results: r })}>
                          {resultsLabel(r, draft.phase)}
                        </BoardChip>
                      ))}
                    </div>
                  </Sec>
                )}
              </>
            ) : (
              <Sec>
                <SubLabel>1 &middot; Measure</SubLabel>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <BoardChip active>{DATA_LABEL[draft.data]}</BoardChip>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--cc-sub)", lineHeight: 1.45 }}>
                  No {DATA_LABEL[draft.data].toLowerCase()} views are built yet: Pick will show what&apos;s missing, so you can {superAdmin ? "plan a placeholder" : "ask for one"}.
                </div>
              </Sec>
            )}
          </FamilyCard>
        ))}
      </Body>
      <Footer>
        <FooterLine>{dataSummary(draft)}</FooterLine>
        <PrimaryButton onClick={onNext}>Next</PrimaryButton>
      </Footer>
    </>
  );
}

// ------------------------------------------------------------------------------ Step 2

function Block({ n, title, end, children }: { n: number; title: string; end?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--cc-border)", borderRadius: 12, background: "var(--cc-panel)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "var(--cc-soft)", borderBottom: children ? "1px solid var(--cc-border)" : "none" }}>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--cc-primary)", color: "var(--cc-on-primary)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 20px" }}>{n}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-ink)", flex: "1 1 auto" }}>{title}</span>
        {end}
      </div>
      {children && <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9 }}>{children}</div>}
    </div>
  );
}

const Band = ({ children }: { children: ReactNode }) => (
  <div style={{ borderTop: "1px solid var(--cc-line)", paddingTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>{children}</div>
);

export function focusShort(c: PickPanelContext): string {
  if (c.focus.kind === "subject") return c.focus.subject?.label?.replace(/ \(.*\)$/, "") ?? "Subject chips";
  if (c.focus.kind === "custom_area") return c.focus.area?.name ?? "Custom area";
  if (c.focus.kind === "la") return c.labels.la ?? "LA";
  if (c.focus.kind === "region") return c.labels.region ?? "Region";
  return FOCUS_LABEL[c.focus.kind];
}

export function FocusStep({
  draft,
  original,
  superAdmin,
  compareOn,
  onCompareOn,
  canChooseSchools,
  onDraft,
  onSubject,
  onCustomArea,
  onChooseSchools,
  onBack,
  onClose,
  onNext,
}: {
  draft: PickPanelContext;
  original: PickPanelContext;
  superAdmin: boolean;
  compareOn: boolean;
  onCompareOn: (v: boolean) => void;
  canChooseSchools: boolean;
  onDraft: (c: PickPanelContext) => void;
  onSubject: () => void;
  onCustomArea: () => void;
  onChooseSchools: () => void;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
}) {
  const area = isAreaKeyed(draft);
  const exempt = leadsToPlaceholder(draft.data);
  const offers = (k: "schools" | "averages" | "subjects") =>
    exempt || superAdmin || countViews({ data: draft.data, phase: draft.phase, results: draft.results, focus: draft.focus.kind, compareHas: k }, superAdmin) > 0;
  const measure = measureFor(draft);
  const geo = (a: AverageId) => !!measure?.geographies[a === "england" ? "england" : a].ok;
  const averages: AverageId[] = (["la", "region", "england"] as AverageId[]).filter(geo);
  const c = draft.compare;
  const setCompare = (next: PickPanelContext["compare"]) => onDraft({ ...draft, compare: next });
  const toggleKind = (k: "schools" | "averages" | "subjects", on: boolean) => {
    const kinds = on ? [...new Set([...c.kinds, k])] : c.kinds.filter((x) => x !== k);
    return kinds;
  };
  const focusChips = focusOptions(draft, superAdmin);
  const focusName = (k: FocusKind) => (k === "la" ? (draft.labels.la ?? "LA") : k === "region" ? (draft.labels.region ?? "Region") : k === "custom_area" ? "Custom area…" : FOCUS_LABEL[k]);
  const schoolsLabel = c.schools?.label ?? original.compare.schools?.label ?? "10 nearest schools";
  const schoolsFromColumn = !!original.compare.schools && original.compare.schools.label === schoolsLabel;
  const subjectScopes: { id: "category" | "whole" | "my_subjects"; label: string }[] = [
    { id: "category", label: draft.labels.category ?? "Its category" },
    { id: "whole", label: "All subjects" },
    { id: "my_subjects", label: "My subjects" },
  ];

  return (
    <>
      <AvHeader title="Change focus" subtitle={dataSummary(draft)} segs={2} onBack={onBack} onClose={onClose} />
      <Body gap={12}>
        <StepLabel>Step 2 of 3 &middot; What&apos;s it about?</StepLabel>

        <Block n={1} title={area ? "Which area" : "Which part of your school"}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {focusChips.map(({ kind, built }) => (
              <BoardChip
                key={kind}
                size="md"
                more={kind === "custom_area"}
                active={draft.focus.kind === kind}
                title={built ? undefined : "Nothing built for this yet: Pick will offer a placeholder"}
                onClick={() => {
                  if (kind === "custom_area") return onCustomArea();
                  onDraft({
                    ...draft,
                    focus: kind === "subject" ? { kind, subject: draft.focus.subject ?? original.focus.subject ?? { mode: "follow-chips", label: null } } : { kind },
                  });
                }}
              >
                {focusName(kind)}
              </BoardChip>
            ))}
          </div>
          {draft.focus.kind === "subject" && (
            <Band>
              <SubLabel>Which subject</SubLabel>
              <Seg2<"follow-chips" | "always">
                ariaLabel="Which subject"
                size="sm"
                value={draft.focus.subject?.mode ?? "follow-chips"}
                onChange={(mode) => onDraft({ ...draft, focus: { ...draft.focus, subject: { label: draft.focus.subject?.label ?? null, key: draft.focus.subject?.key, mode } } })}
                options={[
                  { id: "follow-chips", label: "Follow the subject chips" },
                  { id: "always", label: "Always the same one" },
                ]}
              />
              <div style={{ fontSize: 11.5, color: "var(--cc-sub)" }}>
                {draft.focus.subject?.label ? `Now showing ${draft.focus.subject.label} · ${PHASE_LABEL[draft.phase]}. ` : "Follows the dashboard's subject chips. "}
                <button type="button" onClick={onSubject} style={{ color: "var(--cc-blue)", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}>
                  Pick another
                </button>
              </div>
            </Band>
          )}
          {draft.focus.kind === "custom_area" && draft.focus.area && (
            <div style={{ fontSize: 11.5, color: "var(--cc-sub)" }}>
              {draft.focus.area.name}: {draft.focus.area.subjects.length} subjects.{" "}
              <button type="button" onClick={onCustomArea} style={{ color: "var(--cc-blue)", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}>
                Edit
              </button>
            </div>
          )}
        </Block>

        <Block
          n={2}
          title="Compare with something"
          end={
            <Toggle
              size="md"
              on={compareOn}
              label="Compare with something"
              onChange={(v) => {
                onCompareOn(v);
                if (!v) setCompare({ kinds: [] });
                else if (!c.kinds.length && original.compare.kinds.length) setCompare(original.compare);
              }}
            />
          }
        >
          {compareOn ? (
            <>
              {offers("schools") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <SubLabel>Other schools &middot; pick one</SubLabel>
                  <button
                    type="button"
                    aria-pressed={c.kinds.includes("schools")}
                    onClick={() =>
                      setCompare({ ...c, kinds: toggleKind("schools", !c.kinds.includes("schools")), schools: c.schools ?? original.compare.schools ?? { spec: "10-nearest", label: "10 nearest schools" } })
                    }
                    style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${c.kinds.includes("schools") ? "var(--cc-blue)" : "var(--cc-border)"}`, borderRadius: 9, padding: "9px 11px", background: c.kinds.includes("schools") ? "var(--cc-blue-tint)" : "var(--cc-panel)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <span style={{ flex: "1 1 auto", fontSize: 13, fontWeight: 600, color: "var(--cc-ink)" }}>{schoolsLabel}</span>
                    {schoolsFromColumn && <span style={{ fontSize: 11, color: "var(--cc-blue)" }}>from this column</span>}
                  </button>
                  <div style={{ fontSize: 12 }}>
                    <button
                      type="button"
                      onClick={onChooseSchools}
                      disabled={!canChooseSchools}
                      style={{ color: canChooseSchools ? "var(--cc-blue)" : "var(--cc-faint)", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: canChooseSchools ? "pointer" : "default", fontSize: "inherit", fontFamily: "inherit" }}
                    >
                      Choose other schools&hellip;
                    </button>{" "}
                    <span style={{ color: "var(--cc-faint)" }}>{canChooseSchools ? "opens the comparator chooser" : "on a dashboard, opens the comparator chooser"}</span>
                  </div>
                </div>
              )}
              {offers("averages") && averages.length > 0 && (
                <Band>
                  <SubLabel>Averages &middot; tick any</SubLabel>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {averages.map((a) => {
                      const on = (c.averages ?? []).includes(a) && c.kinds.includes("averages");
                      return (
                        <BoardChip
                          key={a}
                          size="md"
                          active={on}
                          onClick={() => {
                            const list = on ? (c.averages ?? []).filter((x) => x !== a) : [...(c.kinds.includes("averages") ? (c.averages ?? []) : []), a];
                            setCompare({ ...c, averages: list, kinds: toggleKind("averages", list.length > 0) });
                          }}
                        >
                          {a === "la" ? (draft.labels.la ?? "LA") : a === "region" ? (draft.labels.region ?? "Region") : "England"}
                        </BoardChip>
                      );
                    })}
                  </div>
                </Band>
              )}
              {!area && offers("subjects") && (
                <Band>
                  <SubLabel>Other subjects here &middot; pick one</SubLabel>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {subjectScopes.map((s) => {
                      const on = c.kinds.includes("subjects") && (c.subjects?.scope === s.id || (s.id === "category" && (c.subjects?.scope === "pill" || !c.subjects)));
                      return (
                        <BoardChip
                          key={s.id}
                          size="md"
                          active={on}
                          onClick={() => setCompare({ ...c, kinds: toggleKind("subjects", !on), subjects: on ? undefined : { scope: s.id, label: s.label } })}
                        >
                          {s.label}
                        </BoardChip>
                      );
                    })}
                  </div>
                </Band>
              )}
            </>
          ) : null}
        </Block>
      </Body>
      <Footer>
        <FooterLine>
          {focusShort(draft)} &middot; {compareLabel(draft)}
        </FooterLine>
        <PrimaryButton onClick={onNext}>Next</PrimaryButton>
      </Footer>
    </>
  );
}

// ------------------------------------------------------------------- 2a: one subject

export function SubjectStep({
  phase,
  school,
  source,
  picked,
  theme,
  onPick,
  onBack,
  onClose,
  onDone,
}: {
  phase: Phase;
  school: string | undefined;
  source: SubjectSource | undefined;
  picked: { key: string; label: string } | null;
  theme: "dark" | "light";
  onPick: (p: { key: string; label: string }) => void;
  onBack: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const items = source?.items ?? [];
  const byKey = new Map(items.map((i) => [i.key, i]));
  const familyHex = (fid: string) => source?.families.find((f) => f.id === fid)?.hex ?? "var(--cc-faint)";
  const mine = (source?.mine ?? []).map((k) => byKey.get(k)).filter((x): x is PickerItem => !!x);
  return (
    <>
      <AvHeader title="Choose a subject" subtitle={`Pick one · ${PHASE_LABEL[phase]}${school ? ` at ${school}` : ""}`} segs={null} onBack={onBack} onClose={onClose} />
      <Body gap={12}>
        {!source ? (
          <div style={{ fontSize: 12.5, color: "var(--cc-sub)", lineHeight: 1.45 }}>The school&apos;s subjects load when Add a view opens from a dashboard.</div>
        ) : (
          <>
            {mine.length > 0 && (
              <>
                <StepLabel>Your subjects</StepLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {mine.map((i) => {
                    const on = picked?.key === i.key;
                    return (
                      <button
                        key={i.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onPick({ key: i.key, label: i.label })}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${on ? "var(--cc-primary)" : "var(--cc-border2)"}`, background: on ? "var(--cc-primary)" : "var(--cc-panel)", color: on ? "var(--cc-on-primary)" : "var(--cc-ink)", borderRadius: 20, padding: "4px 10px 4px 5px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <span
                          className="av-qi"
                          style={{ width: 17, height: 17, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 17px", background: on ? familyHex(i.familyId) : "var(--cc-chipbg)", color: on ? "#0a0a0b" : "var(--cc-sub)" }}
                        >
                          {familyIcon(phase, i.familyId)}
                        </span>
                        {i.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "var(--cc-faint)", marginTop: -4 }}>Same chips as the dashboard&apos;s control bar &mdash; the subjects you ticked on the tour.</div>
              </>
            )}
            <StepLabel top={4}>Or any subject</StepLabel>
            <CategorySubjectPicker
              single
              search
              families={source.families}
              items={items}
              ticked={picked ? [picked.key] : []}
              onToggle={(key) => onPick({ key, label: byKey.get(key)?.label ?? key })}
              theme={theme}
              defaultExpanded={picked ? [byKey.get(picked.key)?.category?.id ?? ""] : []}
            />
          </>
        )}
      </Body>
      <Footer>
        <FooterLine>{picked ? `${picked.label} · ${PHASE_LABEL[phase]}` : "Nothing picked"}</FooterLine>
        <PrimaryButton onClick={onDone} disabled={!picked}>Done</PrimaryButton>
      </Footer>
    </>
  );
}

// ------------------------------------------------------------------- 2b: custom area

export function AreaStep({
  source,
  ticked,
  name,
  theme,
  onTicked,
  onName,
  onBack,
  onClose,
  onDone,
}: {
  source: SubjectSource | undefined;
  ticked: string[];
  name: string;
  theme: "dark" | "light";
  onTicked: (keys: string[]) => void;
  onName: (v: string) => void;
  onBack: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const seg = (on: boolean, disabled = false) =>
    ({ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: on ? "var(--cc-on-primary)" : "var(--cc-label)", background: on ? "var(--cc-primary)" : "transparent", border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit" }) as const;
  return (
    <>
      <AvHeader title="Custom area" subtitle="Tick the subjects to group together" segs={null} onBack={onBack} onClose={onClose} />
      <Body gap={12}>
        {!source ? (
          <div style={{ fontSize: 12.5, color: "var(--cc-sub)", lineHeight: 1.45 }}>The school&apos;s subjects load when Add a view opens from a dashboard.</div>
        ) : (
          <CategorySubjectPicker
            families={source.families}
            items={source.items}
            ticked={ticked}
            onToggle={(k) => onTicked(ticked.includes(k) ? ticked.filter((x) => x !== k) : [...ticked, k])}
            theme={theme}
          />
        )}
        <div style={{ border: "1px solid var(--cc-border)", borderRadius: 10, padding: 12, background: "var(--cc-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cc-ink)" }}>Name this area</div>
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            aria-label="Area name"
            placeholder="e.g. Separate sciences"
            style={{ border: "1px solid var(--cc-border2)", borderRadius: 8, padding: "9px 10px", fontSize: 13, color: "var(--cc-ink)", outline: "none", background: "var(--cc-panel)", fontFamily: "inherit" }}
          />
          <div role="radiogroup" aria-label="Keep it" style={{ display: "flex", border: "1px solid var(--cc-border2)", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
            <button type="button" role="radio" aria-checked style={seg(true)}>Just this view</button>
            <button type="button" role="radio" aria-checked={false} disabled title="Saved areas arrive with the editor" style={seg(false, true)}>Save to reuse</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--cc-faint)", lineHeight: 1.4 }}>Saved areas will sit next to your saved comparator sets, with the same personal cap.</div>
        </div>
      </Body>
      <Footer>
        <FooterLine>{ticked.length} {ticked.length === 1 ? "subject" : "subjects"}</FooterLine>
        <PrimaryButton onClick={onDone} disabled={!ticked.length}>Done</PrimaryButton>
      </Footer>
    </>
  );
}
