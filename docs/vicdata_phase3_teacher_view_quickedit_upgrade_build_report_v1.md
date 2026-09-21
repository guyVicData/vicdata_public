# Teacher view — dashboard quick edit upgraded to the onboarding picker (Round C) — build report

Covers `vicdata_phase3_teacher_view_quickedit_upgrade_brief_v1.md`. Built against `GCSE-QuickEdit.dc.html` (read from the Design artifact), whose own script comment is the brief's point: "Same taxonomy as GCSE-Step2 — kept identical so quick-edit and onboarding never disagree."

One file changed: `src/app/teacher/[phase]/page.tsx`. No new components.

## What changed

**The foot-of-dashboard section** (`<section id="subjects">`) now renders Round B's `QualificationFamilyTiles` and `CategorySubjectPicker` on one screen, as the QuickEdit mockup does: tiles, then the tabbed, category-grouped picker straight underneath, with no Next button. The section's wrapper, `id`, `scroll-mt-4`, heading ("Which subjects do you teach?") and subcopy ("Personal to you. Changing it updates every card above.") are untouched. So is the "±" link in the chip header (`href="#subjects"`, scroll, not navigate).

**Default tile selection comes from the real current state.** A family is pre-ticked when at least one of its subjects is in the teacher's saved selection. Onboarding keeps its own default (every family with data), which suits someone who hasn't chosen yet. The derived selection is frozen into explicit state on the first edit, whether a tile or a subject, so unticking a family's last subject does not make that family's tile and tab disappear mid-edit.

**The mockup's "ticked but nothing to pick underneath it" note** (`noDataFamiliesSelected`) cannot arise here. Tiles are only offered where the school has real entries, the same rule as onboarding, so a ticked family always has subjects beneath it. With every tile unticked, the section shows the mockup's own prompt: "Tick GCSE or BTEC & OCR above to choose subjects."

**Unticking a family unticks its subjects** and saves that, exactly as onboarding does. Otherwise they would stay saved, hidden from the picker, while still showing on every card above.

**Ticking a subject** goes through the existing `toggle` → `persist` path, the same one the old list used. It updates `ticked`, and so the chip header and all four cards, immediately, with no reload.

## Removals and one shared helper

- **`SubjectPicker` is removed.** Its only other call site was a `phase !== "ks2"` branch inside the KS2-only onboarding block, left over from Round B, which could never run. That dead branch is removed too; KS2 onboarding renders exactly as before. The now-unused `TickList` import in the page is gone. `TickList` itself stays, used by `ColumnBuilder` and the meetings page.
- **Flagged, as it touches onboarding code:** the subject-to-picker-row mapping (subject name, the duplicate-subject qualification label, entry count, family, category) was inline in onboarding step 2. It is now one `toPickerItems` helper used by both onboarding and quick edit. The output is identical: the same expressions, lifted out, with `familyOf` and `familyOfItem` both being `qualificationFamilyOf(phase, qualificationType)`. Two copies of that mapping are exactly what could let quick edit and onboarding drift apart.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on all Teacher view files; `next build` passes.

**Live verification: NOT done.** vicdata.co.uk still returns the Basic Auth gate to this session's browser (re-checked this round), and the production preview link isn't available here. The checklist is outstanding, for both phases and both themes:
1. the foot-of-page section shows tiles and the category picker;
2. tiles are pre-ticked from the saved selection;
3. ticking a subject updates the header chips and all four cards with no reload;
4. "±" still scrolls to the section.

**What does carry over from Round B's verification:** `QualificationFamilyTiles` and `CategorySubjectPicker` are unchanged and were rendered and exercised against Acland Burghley's real subjects in both phases and themes last round. What is new this round is the page-level wiring: the derived default, the freeze-on-first-edit, and the family-untick rule. That wiring depends on signed-in data, so only the live check covers it.
