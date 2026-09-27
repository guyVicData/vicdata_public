# Teacher View — comparator schools chooser redesign — Claude Code build prompt

Guy asked for one pass covering: (a) build the wireframe pixel-perfect, (b) check the
resulting code actually functions, (c) make whatever Supabase changes it needs, (d) check
it headless, (e) commit and push. Treat this whole prompt as this round's go-ahead for all
five, staged the same way round 8 was: each numbered section below is its own commit,
`tsc --noEmit` / `eslint` / production build clean before the next, pushed once clean. This
is a one-off basis for this round, not a new standing default.

**Stop only for something that impinges on the rest of the site** — a schema/RLS change
that could break another consumer of `saved_sets`, a shared module you'd have to change in
a way that changes behaviour elsewhere, anything genuinely destructive or irreversible.
Everything else — an ambiguous filter's exact data source, a colour-system inconsistency, a
count you can't make fully real yet, a Victoria Consultancy Sets design choice — gets a
recorded decision in `docs/OPEN_QUESTIONS.md` (in the file's existing format) and the build
carries on. Don't come back to ask about those; just log them.

## 0. Source of truth for pixel-matching

The wireframe is a Claude-Artifact "Design" canvas, not something you can open from here.
Its exact current (v29) source has been exported alongside this prompt, byte-for-byte, to
`docs/wireframes/comparator-chooser-v29/`:

- `Main.dc.html`, `MainSavedSets.dc.html`, `MainSchoolSets.dc.html` — screen 1, three states
  of the same "start from" hub (default / a saved set picked / a school set picked).
- `MainRankings.dc.html` — the "Regional & national rankings" browse screen reached from
  screen 1.
- `AdjustNearest.dc.html` (2a), `AdjustLA.dc.html` (2b), `AdjustCustom.dc.html` (2c) — the
  three "start from a population, then adjust" fork screens for Nearest-10 / Schools-in-LA /
  a school set once a school is added by name.
- `AdjustRankingDefault.dc.html` (3a), `AdjustRankingCustom.dc.html` (3b) — "build a new
  ranking": an unfiltered national/regional population (3a) that forks into a saved custom
  ranking once any filter narrows it (3b).
- `Desktop.dc.html` — the same flow's desktop-width chrome, for reference only; the phone
  width files are the real spec.

These are plain HTML/CSS (a tiny `<x-dc>`/`support.js` harness around them) — open them in a
browser to see the layout, or read the literal `<style>` block and markup for exact hex
values, spacing, copy, and chip states. "Pixel-perfect" means matching what's literally in
these files, not a paraphrase of them. Where the wireframe and this prompt's prose disagree,
the wireframe file wins — the prose below is grounding for what real code to wire it to, not
a re-specification of the design.

## 1. What already exists — reuse this, don't rebuild it

Every filter and population in the wireframe corresponds to something already real in this
codebase. The single biggest risk in this build is quietly re-deriving one of these instead
of calling it:

- **Nearest-10 / same-LA populations** — `src/lib/default-comparator-lists.ts`. `list1`
  (nearest 10, boarding-aware) and `list2` (in-LA, all sectors, same phase) are exactly
  screens 2a/2b's starting populations; `local16Plus` is the "Includes FE & sixth-form
  colleges" note on 2b — it's **deliberately additive**, not folded into `list2` (see that
  file's own comment on the 2026-09-08 fix). Don't merge it in; keep showing it as its own
  line, as the wireframe already does.
- **Boarding %** — the same file's `boardingBand` (`"top_two" | "bottom_three"`, a real
  quintile position, not a fixed threshold) and `boardingRecipe`
  (`buildBoardingQuintileList`). The wireframe's Boarding filterbox (Any / 100% Day / then
  1–19% / 20–49% / 50–79% / 80%+) needs to read against this real quintile mechanism for a
  boarding target, not a hand-rolled percentage cutoff.
- **Gender** — `genderTag()` in `src/lib/typology.ts` (`"Boys" | "Girls" | "Co-ed"`, derived
  from the GIAS gender field, not a raw column) and `genderMatches` in
  `src/lib/surrounding-schools.ts`.
- **Phase** — `phaseTags()` / `effectivePhaseTags()` in `typology.ts`
  (`"Junior" | "Prep" | "Senior" | "Post 16"`), with `tagDisplayLabel()`'s display overrides
  (`Senior` → "Secondary" on screen, `Special Schools` → "Special"). The Phase filterbox was
  deliberately designed then dropped from the final wireframe (Guy: "design it and then note
  its not needed here") — don't build it; it doesn't appear in any of the exported files.
- **Region / scope** — `src/lib/region-nation-comparator.ts`'s `region_nation_set` Postgres
  function and the `school_region_nation` table, already built and performance-tuned for
  exactly this ("All England" / a school's own region) in the Data View's Compared-with
  panel. Reuse `RegionNationScope` and that function rather than writing a second
  region/nation query path. `resolveTargetRegionNation` (also in `default-comparator-lists.ts`)
  is how a target school's own region is already being resolved elsewhere in Teacher View.
- **Size (XS/S/M/L/XL)** — `SizeBadge` / `sizeBadgeForValue` in
  `src/lib/age-band-distributions.ts` (quintile-based, not fixed headcounts), `AGE_BANDS` in
  `src/lib/roll-data.ts` (`sixth_form` = ages 16–18 = Years 12–13), and the real visual
  convention in `src/components/dashboard/PhaseBreakdownCard.tsx` (25×25px, 7px radius
  squares, muted `#f0ece0`/`#b3ab99` by default, active gold `#a97a1f`/white) — the wireframe
  copies this convention exactly; match it, don't invent a new badge style.
- **KS5 qualification buckets** — `KS5_BUCKETS` / `KS5_BUCKET_LABEL` in
  `src/lib/dfe-qualification-buckets.ts`. The real label for the third bucket is
  "BTec, OCR, VRQ"; the wireframe's compact chip label "BTEC/OCR/VRQ" is a deliberate UI
  shortening of that, not an error — keep it as the chip label, but if you surface the full
  name anywhere (a tooltip, an aria-label), use the real one.
- **Live population counts** — `filteredCount()` in `src/lib/data-view-filters.ts` is the
  Data View's existing mechanism for turning a filter combination into a real count. Check
  whether it (or the `region_nation_set` function's own filtering, per its "Large-set design
  v1" comment) already covers enough of the Adjust-Ranking screens' filter combination to
  reuse directly. If some combination genuinely has no existing counting path (e.g.
  qualification-bucket-at-population-scale may not exist yet — it's currently a per-school,
  per-KS5-subject concept, not a population filter), say so in the build report and
  `docs/OPEN_QUESTIONS.md` rather than fabricating a plausible-looking number. A filter can
  still be fully wired (state, chips, save) with its resulting count marked as not-yet-real,
  logged as an open item — that's not a reason to stop.
- **Save / Save As / Delete, and "shared" sets** — `src/lib/teacher-view-saved-sets.ts`
  already has `saveComparatorSet` (create when `id` is null, update otherwise) and
  `deleteComparatorSet`; the DB (`saved_sets`/`saved_set_members`,
  `supabase/migrations/20260807093000_saved_sets.sql`,
  `20260925232857_personal_comparator_cap_8.sql`) already models exactly the sharing rule
  Guy asked for: `owner_membership_id is null` = a shared/admin-owned set (Guy's "only admin
  users share 'school sets'" — this is already enforced by RLS, not just the UI radio), cap
  is **8** personal sets (not 3 — the old migration's comment is stale, the later migration
  raised it and the constant in the lib file already says 8). **"Save As" is the one new
  function**: call `saveComparatorSet` with `id: null` and the current name/urns/config —
  no schema change needed for it.
- **`ComparatorSetChooser.tsx` today** is a single-modal component (sector tabs + LA cards +
  a "Selected so far" chip panel) — it does not have this hub-then-adjust structure at all.
  This build replaces/restructures it into the multi-screen flow the wireframe shows; how you
  structure that internally (a step enum inside one modal, or several) is your call.

## 2. The one genuinely new thing — Victoria Consultancy Sets

There is no existing concept in this schema of a set authored by Victoria Consultancy
(rather than by a school's own member/admin) or of a per-school visibility toggle for one.
`saved_sets.owner_membership_id` only distinguishes personal-member vs. school-admin; there
is no platform-level "VC staff" role anywhere in the RLS functions
(`is_admin_of_school_account`, `is_account_holder_of_school_account`,
`is_member_of_school_account` — all school-scoped, none platform-scoped).

Guy's spec (screen 1): a "Victoria Consultancy Sets" row, badge "1 set", subtitle "Shared
with leadership, can't be edited", **only visible on a school if Guy (as admin) has turned
it on for that school** — this is Guy/VC turning it on per school, not a school's own admin.
This needs:

1. A way to mark a `saved_sets` row as VC-authored (a school-facing set that isn't tied to
   any of that school's own `school_memberships`).
2. A per-`school_account` visibility toggle that only Guy/VC can set — check how the
   internal admin/ingest side of the platform (the separate `vicdata` repo's `admin` app, or
   any existing service-role usage in this repo) already authenticates a platform operator,
   and follow that precedent rather than inventing a new auth model from scratch. If nothing
   like that exists yet either, that's a real gap worth a short note in
   `docs/OPEN_QUESTIONS.md` — a service-role script/tool run by Guy directly is a fine v1,
   it doesn't need a full new role system to ship this.
3. Design this, implement it as a new migration, and **write down exactly what you chose and
   why in `docs/OPEN_QUESTIONS.md`** — this is squarely a "record the decision" item, not a
   stop-and-ask one, unless the shape you land on would touch `saved_sets`' existing RLS in a
   way that could change who can see/edit today's personal or school-admin sets (that would
   impinge on the rest of the site — stop for that specifically).

A full "browse this VC set's members" sub-state (mirroring "The Chase sets"' sublist
pattern) isn't in the wireframe yet and isn't asked for — don't build it speculatively.

## 3. A colour-system inconsistency worth knowing about, not fixing now

The wireframe's Sector filterbox (screens 3a/3b) uses the four-way brand typology palette —
`TAG_COLOURS` in `src/lib/tag-colours.ts` (Independent = ISC orange `#F37521`, State = green
`#15803d`, FE = fuchsia `#86198f`, Special Schools = red `#b91c1c`) — per Guy's direct colour
instructions this round. The **existing** `ComparatorSetChooser.tsx` and the Comparisons
ranking table elsewhere on the same Teacher View dashboard use a different, binary palette —
`SECTOR` in `src/lib/school-sector.ts` (state = blue `#4b7bd6`, independent = pink
`#c2478b`), which has no FE/Special values at all. Build the new screens to the wireframe
(the four-way typology palette — it's the only one that can represent FE/Special, which this
filter needs), but log in `docs/OPEN_QUESTIONS.md` that this creates two different
"Independent" colours on the same dashboard, and flag it as a follow-up call for Guy: whether
the Comparisons ranking table should eventually move to the four-way typology palette too.
Not a reason to stop this build.

## 4. Build order

1. **Screen 1 — the hub** (`Main`/`MainSavedSets`/`MainSchoolSets` states): the "start from"
   list (10 nearest / Schools in `{LA}` / Regional & national rankings / My saved sets / The
   Chase sets / Victoria Consultancy Sets), its three selected-states, and the
   Next/Done-when-a-school-set-is-picked footer rule.
2. **Screens 2a/2b** (`AdjustNearest`/`AdjustLA`): wire to `list1`/`list2`/`local16Plus` per
   §1. Keep the existing "adding a school by name turns this into a custom set" behaviour.
3. **Screen 2c** (`AdjustCustom`) and the **Save/Save As/Delete** footer, wired to
   `teacher-view-saved-sets.ts` per §1.
4. **`MainRankings`** browse screen, then **screens 3a/3b**
   (`AdjustRankingDefault`/`AdjustRankingCustom`): the filterbox cards (Sector, Boarding,
   Gender, Qualification, Scope, Size), each wired to the real module named for it in §1, and
   the same Save/Save As/Delete footer on 3b.
5. **Victoria Consultancy Sets** (§2): the new migration, the toggle, the screen-1 row.

## 5. Code check

Once built: `tsc --noEmit`, `eslint`, a production build, clean at each numbered stage above
before moving to the next. Then trace every interaction by reading the code, not just
compiling it — every chip/filterbox actually changes the population and the count; the
Sector/Boarding/Gender/Qualification/Scope/Size combination composes correctly (an AND across
filterboxes, matching the wireframe's single running count); "adding a school forks into a
custom set" fires in every screen that says it should (2a, 2b, 3a→3b); the personal cap (8,
not 3) is what's actually enforced and shown; Save As always creates a new row rather than
overwriting; Delete only appears where `editable` is true; the Victoria Consultancy Sets row
only renders when the new per-school toggle is on.

## 6. Headless check

Try it, but Guy's flagged that headless Chrome isn't currently working in this environment —
don't burn time forcing it. If it fails, say exactly how (missing browser, crash, timeout —
not just "doesn't work") in the build report, and fall back to: the clean
`tsc`/`eslint`/build from §5, a full manual trace of each interaction path by reading the
code, and a curl-level smoke check of any API routes touched (`/api/teacher/...`) for a
real school to confirm they return without erroring. Note plainly in the build report that
true visual/pixel confirmation against the wireframe still needs Guy's own live look (he
prefers testing live over reviewing local builds anyway) — list exactly which screens/states
to check so he can do that quickly rather than re-deriving the list himself.

## 7. Commit and push

Per numbered build-order section above: commit once that section is clean, push once it's
committed (the go-ahead at the top of this prompt covers push, same one-off basis round 8
used). Confirm each push is a plain fast-forward onto `origin/main` before pushing; if it
isn't, stop and say so rather than force-pushing.

## 8. Build report

Usual format: name the real school(s)/data verified against, and a "simplifications made
without Guy there to confirm" section — the Victoria Consultancy visibility-toggle mechanism
and the sector-palette note from §3 are the most likely candidates, alongside anything from
§1 where a count couldn't be made fully real yet. Everything logged to
`docs/OPEN_QUESTIONS.md` this round should also be listed in the build report so it isn't
missed.
