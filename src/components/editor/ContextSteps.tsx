"use client";

// VicData 0.6 S5: a column's (or a panel override's) data, focus and comparison, set with
// the "Add a view" chooser's own Steps 1-2 (Ch1Data, Ch2Focus, 2a subject, 2b custom area)
// -- reused, not rebuilt -- in the same modal. Used by Edit column, the panel menu's
// "Change data / compared to…" and New 3's Change / Add. No school here, so "Choose other
// schools…" stays off and the comparison set is the relative "10 nearest" (G5).
import { useState } from "react";
import type { DashboardConfig, ColumnHeader, RowTime } from "@/catalogue/types";
import { contextFromPanel, type PanelLabels, type PickPanelContext } from "@/catalogue/pick";
import { AvStyles } from "@/components/chooser-v06/bits";
import { AreaStep, DataStep, FocusStep, SubjectStep, focusOptions } from "@/components/chooser-v06/StepScreens";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { Panel } from "@/components/teacher/chooser/ui";

// A context for a bare column: a one-panel stand-in dashboard, so contextFromPanel (the
// chooser's own resolution) decides every label.
export function contextFromColumn(
  col: Pick<ColumnHeader, "title" | "data" | "focus" | "compare"> & { id?: string; icon?: ColumnHeader["icon"] },
  opts: { dashboard: string; row?: string; time?: RowTime; labels?: PanelLabels } = { dashboard: "New dashboard" },
): PickPanelContext {
  const cfg: DashboardConfig = {
    schema_version: 1,
    id: "__ctx",
    name: opts.dashboard,
    kind: "dashboard",
    owner: "user",
    colour: { key: "neutral" },
    layout: { preset: "1", tracks: [1], accordion: "independent" },
    columns: [{ id: col.id ?? "c", title: col.title, icon: col.icon ?? "candidates", data: col.data, focus: col.focus, compare: col.compare }],
    rows: [{ id: "r", name: opts.row ?? "Any row", time: opts.time ?? "either", openByDefault: true }],
    panels: [{ id: "p", row: "r", column: col.id ?? "c", dataviews: [] }],
  };
  return contextFromPanel(cfg, "p", opts.labels);
}

type Screen = "data" | "focus" | "subject" | "area";

export function ContextStepsDialog({
  original,
  superAdmin,
  startAt = "data",
  theme,
  onDone,
  onClose,
}: {
  original: PickPanelContext;
  superAdmin: boolean;
  startAt?: "data" | "focus";
  theme: "dark" | "light";
  onDone: (ctx: PickPanelContext) => void;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<Screen>(startAt);
  const [draft, setDraft] = useState<PickPanelContext>(original);
  const [compareOn, setCompareOn] = useState(original.compare.kinds.length > 0);
  const [subjectPick, setSubjectPick] = useState<{ key: string; label: string } | null>(null);
  const [area, setArea] = useState<{ ticked: string[]; name: string }>({ ticked: [], name: "" });

  const toFocus = () => {
    const offered = focusOptions(draft, superAdmin);
    if (!offered.some((o) => o.kind === draft.focus.kind)) {
      const pick = offered.find((o) => o.kind === "subject") ?? offered.find((o) => o.kind === "school") ?? offered.find((o) => o.kind === "around_school") ?? offered[0];
      if (pick) setDraft({ ...draft, focus: pick.kind === "subject" ? { kind: "subject", subject: original.focus.subject ?? { mode: "follow-chips", label: null } } : { kind: pick.kind } });
    }
    setScreen("focus");
  };

  let body;
  if (screen === "data") body = <DataStep draft={draft} original={original} superAdmin={superAdmin} theme={theme} onDraft={setDraft} onBack={onClose} onClose={onClose} onNext={toFocus} />;
  else if (screen === "focus")
    body = (
      <FocusStep
        draft={draft}
        original={original}
        superAdmin={superAdmin}
        compareOn={compareOn}
        onCompareOn={setCompareOn}
        canChooseSchools={false}
        onDraft={setDraft}
        onSubject={() => {
          const s = draft.focus.subject;
          setSubjectPick(s?.label ? { key: s.key ?? s.label, label: s.label } : null);
          setScreen("subject");
        }}
        onCustomArea={() => {
          setArea({ ticked: draft.focus.area?.subjects ?? [], name: draft.focus.area?.name ?? "" });
          setScreen("area");
        }}
        onChooseSchools={() => undefined}
        onBack={() => (startAt === "focus" ? onClose() : setScreen("data"))}
        onClose={onClose}
        onNext={() => onDone(compareOn ? draft : { ...draft, compare: { kinds: [] } })}
      />
    );
  else if (screen === "subject")
    body = (
      <SubjectStep
        phase={draft.phase}
        school={draft.labels.school}
        source={undefined}
        picked={subjectPick}
        theme={theme}
        onPick={setSubjectPick}
        onBack={() => setScreen("focus")}
        onClose={onClose}
        onDone={() => {
          if (subjectPick) setDraft({ ...draft, focus: { kind: "subject", subject: { mode: "always", label: subjectPick.label, key: subjectPick.key } } });
          setScreen("focus");
        }}
      />
    );
  else
    body = (
      <AreaStep
        source={undefined}
        ticked={area.ticked}
        name={area.name}
        theme={theme}
        onTicked={(ticked) => setArea({ ...area, ticked })}
        onName={(name) => setArea({ ...area, name })}
        onBack={() => setScreen("focus")}
        onClose={onClose}
        onDone={() => {
          setDraft({ ...draft, focus: { kind: "custom_area", area: { name: area.name.trim() || "Custom area", subjects: area.ticked } } });
          setScreen("focus");
        }}
      />
    );

  return (
    <TeacherModal label="Set data and comparison" backdropLabel="Close" size="chooser" onClose={onClose}>
      <Panel>
        <div className="av-root" style={{ display: "contents" }}>
          <AvStyles />
          {body}
        </div>
      </Panel>
    </TeacherModal>
  );
}
