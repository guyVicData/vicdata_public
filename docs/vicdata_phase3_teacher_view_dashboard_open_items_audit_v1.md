# Teacher View dashboard — full audit: discussed vs. wireframed vs. built

Guy's request, verbatim: "before we go too far many many of the changes we discussed are not
done - eg only having 1 subject at a time; removing the add button... Can you please go back
through all discussions since 9am this morning and check... very important detailed changes
not built."

Method: read the full session transcript since this morning's design review started, listed
every concrete decision, then checked EACH ONE directly against the real `vicdata_public` code
just now (not against build reports or memory). Git HEAD at time of writing: `c4ea7a0`.

**Headline finding: only the nav/chrome consistency thread ever reached Claude Code. Every
decision about the dashboard's actual content — the cards, the columns, the accordion, the
icons on the main badge, Export's shape, headings, the GCSE data bugs — is still sitting at
"discussed" or "wireframed only." None of it has been sent to Claude Code as a brief yet, so
none of it is built. This isn't a build miss — it's that we never asked for it to be built.**

## 1. Built and shipped — verified against real code just now

- Top nav bar on `/teacher/[phase]`, theme toggle moved into it — `d3b5db3`
- "Log in" link on the signed-out dashboard error screen — `2edfd0a`
- Wordmark-left / cluster-right nav layout (`justify-between`) — `92b4afc`
- **Per-chip** subject qualification icons on the focus chips (mortarboard/certificate/dots by
  family) — `b58f653`
- `TeacherNav` on Home, Recruitment and Meetings; old site `NavBar` retired on all six teacher
  routes; label-visibility toggle now shared across pages — `d48e5ab`
- Phone-width responsive nav (`PhoneNav`, `sm`/640px breakpoint) — `a09b58a`

That's the complete list of what's real today. Everything below is not.

## 2. Not built — confirmed directly in the code, by topic

### Subject focus / kill "All"
This morning's decision: "if a teacher teaches 3 subjects they look at each one at a time...
lets kill the ALL view and button." **Not built.** `ControlBar.tsx` still renders a live "All"
button (`onClick={() => onFocus(null)}`) and it's still the default state (`focusKey === null`).
Its own code comment says single-select is real for choosing *one* subject, but "All" was never
removed. Column 1 still runs its old "multi-subject bars" comparing the teacher's own subjects
to each other — the comment there reads: *"Column 1's own multi-subject bars are a separate
thing and this does not touch them."*

### Accordion panel mechanism ("+Add" / close button removal)
Agreed: replace "+Add" and per-panel "×" with independent open/shut toggles, default only
"Current" open, 2-open-fits-without-scroll sizing, headline number on collapsed panels.
**Not built, and not even wireframed yet.** `AddPanelButton.tsx` and `ColumnPanels.tsx`'s remove
control are exactly the round 6/7 mechanism: Add offers whatever panels are missing, Remove is
always present and just goes disabled on the last panel. There is no open/shut state anywhere.

### Column 1 redesign — subject vs. category comparison
Agreed: Column 1 becomes "{Subject} vs. other subjects in the same taxonomy category"
(e.g. Maths (General) vs. rest of Science & Maths), using the real family taxonomy, with a
Results-mode England-average-per-subject-in-category overlay. **Not built.** `SubjectPanels.tsx`
still runs the round-8 "focus subject vs. Context's chosen comparison group" pattern — there's
no category-taxonomy comparison logic in there at all yet.

### Context redesign
Agreed: drop the "other subjects in this area" option (that comparison moves to Column 1),
leaving just Whole school / Selected subjects, reactive/symmetric toggle, category-grouped
popup reuse, select-all/clear-all. **Not built.** `ContextPills.tsx` still has exactly the three
original options (Whole school / Other subjects in category / Selected subjects) — its own
comment says "three compare-against options... unchanged."

### Comparisons — school name, highlight, scroll-to-focus
Agreed: "this school" row should show the real school name, highlighted in the phase accent
colour, and a cropped table should auto-scroll to show it with a few rows either side.
**Not built.** `ComparisonsPanels.tsx` still literally labels that row `"This school"` (not the
real name), and there's no highlight-colour or scroll-into-view logic anywhere in the file.

### Column/panel heading restructuring (Guy's A/B/C/D list)
Full-sentence column headings; Context/Comparisons headings naming the actual comparator
("Whole School Context 2024/25", "Candidates at the Nearest 10 schools 2024/25"); uniform
"Trends"/"% Change" headings with a "From 2020/21" **dropdown** replacing the prev/next arrows.
**Not built.** The Trend panel still uses a plain next/previous-period click handler
(`nextStart`), not a dropdown, and the headings are unchanged.

### Trend line and the first warning flag, moved to the bottom row
Agreed: the "Trend line" toggle moves into the bottom row before the Info button; the
growth/decline message moves to the bottom row, right-aligned, as the first instance of the
future warning-flags system. **Not built.** The "Trend line" pill is still at the top of the
Trend panel's own controls. The growing/stable/declining vocabulary that exists elsewhere in
the codebase (`trend-labels.ts`) isn't wired into Column 1 at all yet, so there's no message
here to move in the first place.

### GCSE live-review bugs (real bugs, found live this morning, not yet fixed)
- Candidates mode: independent schools (e.g. Malvern College, Malvern St James) still appear
  in state-school comparison sets with no exclusion at all.
- Results mode: those same schools show as "not comparable" placeholders instead of being
  omitted entirely, which is what the existing rule actually calls for.
- Post-16: several schools show bare, unlabeled "—/—" with no explanation and should not
  appear in that subject's view at all.
These are on top of the general GCSE exclusion rule that already shipped (`514e285`) — that
fix doesn't cover all three cases above, and none of the three has been touched since being
found live.

### England-average extension
Agreed: extend the England-average comparator to every subject in the category, not just the
focused one, at GCSE (Post-16 needs its own backend round first). **Not built.**

### The main qualification badge icon
This is the one most likely behind "icons for GCSE subjects are wrong." Guy's original note
this morning was "GCSE has the wrong icon — should be exactly the same as the one used on the
teacher home screen." **The per-chip icons got fixed (`b58f653`), but the big 40px badge next
to "GCSE — {school}" was never included in that build prompt and is still wrong.**
`ControlBar.tsx` still defines its own invented `QUALIFICATION_ICON` (a generic mortarboard)
for that badge, instead of reusing the real `PhaseGlyph` "G" glyph from the Teacher home
screen. Confirmed by reading the file directly — this was wireframed correctly this morning,
but the fix scope for the actual build only ever covered the per-chip icons.

### Export as an icon
Agreed this morning: "Light dark and export should be icons — export should [use the] same
icon as the one used on the individual panel." **Not built.** The whole-dashboard `ExportButton`
(`TeacherChrome.tsx`) still renders literal text, "Export", in a bordered button. Per-panel
export already IS an icon (`PanelExport`/`ExportIcon` in `PanelFooter.tsx`) — that's the icon
the whole-dashboard button was supposed to match, and doesn't yet.

### Wireframed only, never sent to build
- The "Av. Points 2024/25" Column 1 tag wording fix — wireframed (`Redesign.dc.html` v27),
  never briefed to Claude Code.

### Stages (Guy's own staged plan, logged 2026-09-25)
Stage 01 final part (data review), Stage 02 (full-screen view design), Stage 03
(warning-flags review), Stage 04 (changes/additions) — **none started.** Nothing above counts
against any of these yet since none of it has been scoped into a brief.

## 3. What this means practically

Everything in section 2 is real, agreed, and — for the nav/chrome work aside — still only
exists as a conversation and (for the top nav / phone nav specifically) a wireframe. The
dashboard *content* redesign (kill-All, accordion, Column 1, Context, Comparisons, headings,
the badge icon, Export, the GCSE data bugs) has not been wireframed in detail beyond the
initial discussion, and has not been turned into any brief or Claude Code prompt. Guy's own
scoping rule from this morning — "only wireframe the interfaces that need development, no need
to draw every change" — is why most of this skipped the wireframe step; what it should NOT have
skipped is ending up in a brief at all, and it didn't yet.

Recommended next step: work through this list live with Guy (he's starting his review now),
confirm/adjust each item, then batch the confirmed ones into scoped briefs the same way the nav
work was done — probably several rounds given the size (subject-focus + accordion is one
natural round; Column 1 + Context + Comparisons content is another; the badge icon + Export
icon + GCSE data bugs are small enough to combine into a third "fixes" round).
