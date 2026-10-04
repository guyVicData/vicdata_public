"use client";

// VicData 0.6 S7: the stand-in for "Add a view" when MeetingEditor is drawn without an
// `openAddView` (the meeting route now wires S4's chooser: MeetingScreenWithChooser). A
// short form over the live registry: pick a phase and a view, name the subject and
// comparison, pin the year or keep it live.
import { useMemo, useRef, useState } from "react";
import { DATAVIEWS } from "@/catalogue";
import type { CompareKind, DataId, DataviewInstance, Phase } from "@/catalogue/types";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { measureOf, type PinInput } from "@/lib/meeting-views";
import { newId } from "@/lib/meeting-ops";
import { EBtn } from "./MeetingChrome";
import { viewInstance } from "@/catalogue/viewspec";

const HOST_LABEL: Record<string, string> = {
  "teacher.c1.candidates": "Candidates",
  "teacher.c1.results": "Results",
  "teacher.c1.counts": "Grade counts",
  "teacher.c2.context": "Context",
  "teacher.c3.comparisons": "Comparisons",
};

const INPUT = "w-full rounded-[8px] border border-[var(--panel-border2)] bg-transparent px-2.5 py-1.5 text-[13px] text-[var(--fg)]";

export function AddViewFallback({
  school,
  onAdd,
  onClose,
}: {
  school: { urn: string; name: string } | null;
  onAdd: (instance: DataviewInstance, pin: PinInput) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ks4");
  const views = useMemo(() => DATAVIEWS.filter((d) => d.status === "live" && d.supports.phases.includes(phase)), [phase]);
  const [dvId, setDvId] = useState<string>(views[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [compare, setCompare] = useState("");
  const [keepLive, setKeepLive] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dv = views.find((d) => d.id === dvId) ?? views[0];
  const measure = measureOf(dv, phase);
  const latest = measure?.years.to ?? null;

  const add = () => {
    if (!dv) return;
    const data: DataId = dv.supports.data.includes("academic.results") && !dv.supports.data.includes("academic.candidates") ? "academic.results" : dv.supports.data[0];
    const compareKind: CompareKind | undefined = dv.supports.compare[0];
    const pin: PinInput = {
      schoolUrn: school?.urn ?? null,
      schoolName: school?.name ?? null,
      phase,
      data,
      results: dv.supports.results?.[0],
      subject: subject.trim() || null,
      subjectLabel: subject.trim() || null,
      compare: compare.trim() && compareKind ? { kind: compareKind, name: compare.trim() } : null,
      ...(dv.supports.dateMode === "trend" && latest ? { yearRange: { from: measure?.years.from ?? latest, to: latest } } : { year: latest }),
      keepLive,
    };
    onAdd(viewInstance(newId("view"), dv.id), pin);
  };

  return (
    <TeacherModal label="Add a view" backdropLabel="Close" onClose={onClose} initialFocusRef={closeRef} size="compact">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold">Add a view</h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">A short list until the full chooser is connected. The view goes in pinned.</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--fg)]">
          ✕
        </button>
      </div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--muted)]">
        Phase
        <select value={phase} onChange={(e) => { setPhase(e.target.value as Phase); setDvId(""); }} className={INPUT}>
          <option value="ks4">GCSE</option>
          <option value="ks5">Post-16</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--muted)]">
        View
        <select value={dv?.id ?? ""} onChange={(e) => setDvId(e.target.value)} className={INPUT}>
          {views.map((d) => (
            <option key={d.id} value={d.id}>
              {HOST_LABEL[d.host.id] ?? d.host.id} · {d.host.panel === "trend" ? "Over time" : "Latest year"} · {d.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--muted)]">
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Maths (General); blank for the whole school" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--muted)]">
        Compared with
        <input value={compare} onChange={(e) => setCompare(e.target.value)} placeholder="e.g. 10 nearest schools, Sciences & Maths" className={INPUT} />
      </label>
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={keepLive} onChange={(e) => setKeepLive(e.target.checked)} />
        Keep it live (always the latest year){!keepLive && latest ? `; otherwise pinned as of ${latest}` : ""}
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <EBtn onClick={onClose}>Cancel</EBtn>
        <EBtn primary onClick={add} disabled={!dv}>
          Add to slide
        </EBtn>
      </div>
    </TeacherModal>
  );
}
