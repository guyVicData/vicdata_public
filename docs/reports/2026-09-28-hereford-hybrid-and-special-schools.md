# Hereford hybrid-page fix + special schools narrative fixes

2026-09-28. `src/app/schools/[urn]/page.tsx`, `src/components/dashboard/FeCollegeCards.tsx`,
`src/lib/surrounding-summary.ts`, `src/lib/narrative.ts`.

## PART 1 — Hereford hybrid page fix

Both bugs traced to the same root cause: `showFeTemplate` (2026-09-26) covers
institutions whose only real ILR data is the aggregate `dfe_fe_participation_academy`
figure, but the surrounding card logic was never updated for that case.

### Bug 1 — leftover old card

`showIlrCard` used to be `ilrSnapshot !== null && (!roll || roll.period <
CURRENT_CENSUS_PERIOD)`. The `!roll` disjunct was the pre-`showFeTemplate` fallback,
now fully superseded — every real `!roll`-with-`ilrSnapshot` case is, by construction,
already `showFeTemplate === true`. Narrowed to:

```ts
const showIlrCard = ilrSnapshot !== null && roll !== null && roll.period < CURRENT_CENSUS_PERIOD;
```

The `reason` prop's `roll ? ... : "this school has no DfE census roll data"` ternary
was left with a now-dead else branch (that case can't reach this card any more) —
simplified to just the roll-present message.

### Bug 2 — no headline stat for the aggregate-only case

`FeCollegeLocalContextCard` only rendered a `CompactIlrStat` when `under19Snapshot`
and/or `adultSnapshot` were real (the crosswalk-scoped split). Hereford has neither —
only the aggregate `ilrSnapshot`. Added a third prop, `aggregateSnapshot:
IlrParticipationSnapshot | null`, rendered as a fallback `CompactIlrStat` ONLY when
both `under19Snapshot` and `adultSnapshot` are null. Eyebrow: **"Participation
(ILR)"** — deliberately not "Under-19," since this source's own age split isn't known
the way the crosswalk-scoped sources' is. Checked against the old standalone
`IlrParticipationCard`'s own default eyebrow ("FE participation data (ILR)") for
consistency, shortened to match `CompactIlrStat`'s terser "Under-19 (ILR)"/"Adult 19+
(ILR)" style. Threaded through from `page.tsx`'s own `ilrSnapshot` at the call site.

### Verified live

- **Hereford (143929)**: old standalone card gone; new "Participation (ILR)" stat
  shows real total **2,190** (1,230 girls, 960 boys) — matches the figure confirmed in
  an earlier round exactly; single coherent template top to bottom, "Current state of
  the college" narrative present.
- **Rochdale (144463) and Solihull (144887)**: same fix confirmed — old card gone, new
  aggregate stat present.
- **Trafford and Stockport (130519, real under-19/adult split)**: completely
  unchanged — "Under-19 (ILR)" and "Adult 19+ (ILR)" both still render; the new
  aggregate-fallback stat correctly does NOT appear (never both).
- **Genuinely stale-but-present-census school**: could not find a live example. Ran a
  comprehensive check across the full real 42-institution population that has any
  `dfe_fe_participation_academy` data in the current period (2025) — zero of them
  currently have a stale (`roll.period < CURRENT_CENSUS_PERIOD`) census. An earlier
  round in this session found exactly one such case (BOA Stage and Screen Production
  Academy, URN 148635, `roll.period=2021` at the time) — re-checked it live just now
  and its census has since been refreshed to the current period (2025/26), so it no
  longer exercises this path either. The narrowed `showIlrCard` condition was verified
  correct by direct code inspection instead (a straightforward boolean, unchanged
  logic for the case it still covers, just the dead `!roll` OR-branch removed) — not
  something I could exercise against live data today, and I'm not claiming otherwise.
- **What was already correct, confirmed untouched**: `FeParticipationSizeCard`/
  `FeParticipationSplitCard` still correctly return null for Hereford (both totals
  null); `CurrentStateNarrative`/`RegionalSixthFormCard` still render correctly,
  gated on `showFeTemplate`, unaffected by either bug fix.

## PART 2 — Special schools narrative fixes

Both bugs share one root cause: `typology.sector` for special schools is the noun
`"Special Schools"` (plural), but both places below treated `sector` as an adjective
slot the way `"Independent"`/`"State"`/`"FE"` work — which breaks for a plural noun.

### 2a. "Nearest matched schools" summary (`surrounding-summary.ts`)

Was producing (real, confirmed live before the fix): "Cambridge School is a small
special schools day senior school — 80% below the average roll of 721 for the 8
nearest special schools senior schools" — `sector.toLowerCase()` folded into both the
generic adjective chain and `poolLabel`, wrong for a plural noun in both places.

Special-cased `typology.sector === "Special Schools"` with its own sentence structure
(same `found === 0`/`averageRoll === null` early-return guard as the generic path;
null phase handled by omitting it, same "just drop it" discipline the generic path's
own `.filter(Boolean)` already uses):

```
${schoolName} is a${phase ? ` ${phase}` : ""} special school. It is ${descriptorClause}
— ${pctAbs}% ${direction} the average roll of ${avg} for the ${found} nearest
${phase ? `${phase} phase ` : ""}special schools.
```

### 2b. "Current state" opening sentence (`narrative.ts`, `paragraph1PhaseGender`)

Had no sector awareness at all. Added a new `isSpecialSchool: boolean` parameter
(passed as `typology.sector === "Special Schools"` from the `page.tsx` call site),
inserting "special" between phase and "school" in both the single-sex and co-ed
return branches. The a/an article logic is unaffected — it already agrees with
`phase`, not the word after it.

### Verified live (Cambridge School, URN 100382, real special school)

- **Nearest matched schools**: *"Cambridge School is a senior special school. It is a
  small day school — 80% below the average roll of 721 for the 8 nearest senior phase
  special schools."* — exact match to Guy's worked example.
- **Current state**: *"Cambridge School is a senior special school, with pupils from
  Year 7 to Year 12..."* — exact match.
- **Regression check (Acland Burghley, URN 100053, mainstream state school)**:
  *"Acland Burghley School is a large state day senior school — 177% above the average
  roll of 452 for the 7 nearest state senior schools."* and *"Acland Burghley School
  is a s[enior school], ..."* — both sentence structures completely unchanged, no
  "special" inserted, `sector.toLowerCase()` still used normally for non-plural
  sectors.

## Checks

`tsc --noEmit` and `eslint` clean across every touched file.
