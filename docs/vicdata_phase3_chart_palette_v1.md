# VicData Public — Chart Palette (v1)
*Started during the shape-chart design session (review Task 3). Grows as more categories get defined — not a complete system yet.*

---

## Gender

- **Boys**: `#8000FF` (purple)
- **Girls**: `#FB0207` (red)

Deliberately avoids the conventional pink/blue pairing — Guy's standing preference, not an industry or accessibility requirement (no universal "agreed" gender-color standard exists in data visualisation). **Status: proposed, not yet validated.** This project already has a precedent worth matching exactly — the historical trend charts were run through an actual colourblind-safety validator before being treated as final, not just eyeballed. This pairing hasn't had that check yet. Reasoning for why it's a *plausible* safe choice (not a substitute for the real check): purple's blue component gives colourblind viewers a distinguishing channel that red-green deficiency — the most common form — doesn't affect, unlike a red-vs-green or red-vs-brown pairing would.

**Action before this is final**: run `#8000FF` / `#FB0207` through the same colourblind-safety validator used for the trend charts.

## Edge-age tinting (shape chart specifically)

Ages 4 and 18 shown at 50% opacity of whichever gender color applies (tested at 60% first — "almost too well," settled on 50%), rather than hidden — visually communicates "this data exists but is excluded from the shape reading" without losing the information entirely. See rolls spec §4 update: shape classification itself uses ages 5–17 only (4 and 18 are structurally incomplete cohorts at census date, a measurement artefact not a real enrolment signal).

---

## Typology tags — the start of the filtering system, not just visual labels

These four categories are both the visual tags shown on a school (and its surrounding-schools list) *and* the basis for future filtering (Comparator Set, Feeder Set, "nearest N [tags] schools" copy) — worth building/documenting as one shared system, not separately per feature.

**Two distinct contexts, different tiers**:
- **Single school's own tags** (labeling the page you're on, e.g. Leighton Park's own header) — appears everywhere, free and paid, since it's just describing the school, not a comparison.
- **Tagged list of named schools** (each surrounding/comparator/feeder school shown with its own row of tags) — **member-area only**. This is where the tag system earns its keep most (scanning several named schools at once), but it's also exactly the named-comparison view the free tier must not show (per the summary-only rule just established for surrounding schools). **Purpose in the Comparator Set specifically: verification, not just scanning** — a member should be able to see the 10 schools' tags and visually confirm the aggregate is genuinely like-with-like, not take the matching on faith. This raises the bar on tag accuracy (they're doing real methodological work now, not decoration) and suggests a future idea worth keeping in mind: visually flagging any comparator school whose tags don't fully match the primary school's own.

- **Sector**: Independent / State
- **Boarding**: Boarding / Day / **Boarding & day** — not a clean binary; Leighton Park (136 board/445 day) is a real example of a genuinely mixed school. Threshold for when a school counts as "mixed" vs. predominantly one or the other is still open.
- **Phase**: Junior / Senior / Through / Sixth (form) — boundaries not yet agreed, flagged by Guy as needing discussion.
- **Gender**: Boys / Girls / Co-ed — new, added specifically because it's foundational to filtering (a girls' school comparing against other girls' schools), not just descriptive. **Also the natural trigger condition for the single-sex suppression check** (rolls spec §8) — an authoritative GIAS-sourced tag is a cleaner signal for "is this school single-sex" than inferring it from pupil-count ratios, which is what that flagged risk was actually about.

**Colors, first pass** — deliberately a different family from the pupil-count gender chart's red/purple, since this tag means something different (the school's own type) from what those chart colors represent (individual pupil counts):
- Independent: blue 50/800 | Boarding & day: teal 50/800 | Boarding: coral 50/800 | Senior: amber 50/800 | Girls: pink 50/800 | Co-ed: gray 50/800 | Boys, Junior, Through, Sixth: not yet assigned

**Action needed, not urgent**: confirm GIAS actually has a `Gender` field (Boys/Girls/Mixed) against real data — believed to exist but not yet checked the way phase/boarding/age-range/size were. Batch with other outstanding Claude Code checks once the review concludes.

## Phase boundaries — confirmed, stackable tags not a single band

Junior/Prep/Senior/Sixth are independent tags that can co-occur, not one mutually-exclusive category per school. Using `StatutoryLowAge`/`StatutoryHighAge`:

| School's actual range | Tags |
|---|---|
| Starts young, high age ≤ 11 | Junior only |
| Starts young, high age 12–14 | Junior + Prep |
| Starts young, high age 15–16 | Junior + Senior |
| Starts young, high age 17–18 | Junior + Senior + Sixth |
| Starts at 11+, high age 16 | Senior only |
| Starts at 11+, high age 17–18 | Senior + Sixth |
| Starts at 16+ | Sixth only |

Prep drops away once a school's range extends into genuine Senior territory (15+) — it does not persist alongside Senior. Some real schools will fall through the gaps between these bands (Guy's own words: "that is good," i.e. an acceptable, expected outcome, not something to over-fit the boundaries to avoid).

**Still genuinely open**: does "Through" survive as its own tag, or is it now redundant given a genuinely all-through school just naturally shows Junior/Prep + Senior + Sixth stacked together? Not yet answered.

## Surrounding-schools matching — expanded from sector+phase alone

Original design (rolls spec §4) matched on sector and age band/phase only. **Expanded per Guy's own worked example**: a state boarding school like Sexey's is only meaningfully compared against *other* state boarding schools — sector alone (state) or boarding alone would both mislead. Matching criteria are now combined, not single-axis:

- **Sector** (state/independent) — exact match
- **Boarding** — exact category match (Boarding-only compares only against Boarding-only; the same logic should apply consistently across all three boarding categories, not just the boarding-only case specifically — worth confirming that's the intended symmetry)
- **Gender** — same-gender match (Boys↔Boys, Girls↔Girls, Co-ed↔Co-ed)
- **Phase** — already established (age-band/phase matching)
- **ISC membership** — flagged as a future filter criterion, same family as the above, once ISC data is actually added (still next-round for implementation, but the architecture should treat it as a matching filter, not just a descriptive tag, when it arrives)

**Real tension worth deciding, not assuming**: combining this many filters will make some genuine combinations (state boarding, especially) very thin nationally — a fixed-radius "nearest 10" search may reliably return fewer than 10 for rare intersections, even at a wide radius. Two ways to handle this: (a) keep the free tier's "nearest 10" mechanism simple/non-adaptive as designed, and let it honestly show fewer than 10 when the pool is genuinely thin — consistent with the existing precedent for the 6th-form/FE gap ("honest degrade, not silently misrepresented"); or (b) borrow the adaptive-radius mechanism from Feeder Set/Comparator Set, which would blur the deliberate free/paid mechanism split established earlier in this project. Leaning toward (a) for consistency, but this is a real product decision, not a technical detail to just pick.

## Map — content/behaviour spec

Viewed school gets a distinct marker (always shown). Place-name labels for orientation. **Local Authority: colour and label only the viewed school's own LA** (not every LA the surrounding schools happen to span) — the contrast between the single coloured region and where the surrounding-school markers actually fall *is* the useful context: they might all sit within it, or the search may have needed to reach further afield, and either is informative. Surrounding schools are **tier-split**: free tier shows unlabelled dots only (location/density as context); member tier (the actual Comparator Set) shows labelled, clickable markers with names and tags — matching the same summary-vs-named-list boundary established for the text version.

## Chart chrome

- **Axis labels**: `#cccccc` (dark mode) / `#4d4d4d` (light mode), detected via `prefers-color-scheme`. Canvas-based charts (Chart.js) can't resolve CSS variables directly, so this hardcoded light/dark pair is the pattern to replicate in the real build, not just this mockup.

## Not yet defined

- **ISC membership flag** — explicitly next round, not this build. Worth knowing: ISC membership data may already exist in a related repo — memory references an `isc_membership` table in the club-iss Supabase project and a real member file (1,785 rows) — worth checking whether that's reusable rather than sourcing fresh.
- **GIAS governance/ownership info** — explicitly next round. Genuinely unsure whether GIAS carries this cleanly: academies likely have trust/federation fields (a well-known GIAS pattern), but independent-school ownership/proprietor data is not something I can confirm exists without checking the real file — same "verify, don't assume" discipline as everything else data-related in this project.
- Sector colors (state/independent) beyond the tag pills already defined
- Free/paid tier visual distinction beyond the join-prompt copy already defined
