"use client";

// VicData 0.6 integration: a meeting's "Add a view" is S4's chooser (scope brief §7.5).
// A slot has no column to pre-fill from, so the chooser starts at Step 1 (Data), with the
// meeting's school for Step 2a's subjects and Pick's live previews. What comes back is
// pinned for the slot (pinFromContext): every setting resolved, the school from the
// person's membership, the latest year pinned -- unless the view was customised to roll
// forward, which keeps it live.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DataviewInstance } from "@/catalogue/types";
import { AddViewChooser } from "@/components/chooser-v06/AddViewChooser";
import { loadSubjectSources } from "@/components/chooser-v06/schoolSubjects";
import type { SubjectSource } from "@/components/chooser-v06/StepScreens";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import type { PinInput } from "@/lib/meeting-views";
import { mySchool } from "@/lib/meeting-store";
import { meetingChooserContext, meetingPin, type PinSchool } from "@/lib/pin-context";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { MeetingEditorScreen, type OpenAddView } from "./MeetingEditor";

// `root`: the chooser draws inside #teacher-root (its theme lives there; TeacherModal
// renders in place), so it is portalled into the meeting's own root.
type Open = { slideId: string; add: (instance: DataviewInstance, pin: PinInput) => void; root: HTMLElement | null };

export function MeetingScreenWithChooser({ id }: { id: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [theme] = useTeacherTheme();
  const [school, setSchool] = useState<PinSchool>(null);
  const [subjects, setSubjects] = useState<Partial<Record<"ks4" | "ks5", SubjectSource>> | undefined>(undefined);
  const [open, setOpen] = useState<Open | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await mySchool(supabase);
        if (!s) return;
        setSchool({ urn: s.urn, name: s.name });
        setSubjects(await loadSubjectSources(supabase, s.urn));
      } catch {
        /* the chooser still works without a school: data-free previews, no subjects */
      }
    })();
  }, [supabase]);

  const openAddView = useMemo<OpenAddView>(() => (slideId, add) => setOpen({ slideId, add, root: document.getElementById("teacher-root") }), []);
  const base = useMemo(() => meetingChooserContext(school, null), [school]);

  return (
    <>
      <MeetingEditorScreen id={id} openAddView={openAddView} />
      {open && open.root &&
        createPortal(
        <AddViewChooser
          open
          theme={theme}
          context={base}
          startAt="data"
          columnless
          superAdmin={false}
          subjects={subjects}
          school={school}
          persistAsk
          onClose={() => setOpen(null)}
          onAdd={(instance, _override, ctx) => {
            open.add(instance, meetingPin(instance, ctx ?? base, school));
            setOpen(null);
          }}
        />,
          open.root,
        )}
    </>
  );
}
