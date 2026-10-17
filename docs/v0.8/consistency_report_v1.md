# VicData 0.8: consistency

Report for `docs/v0.8/vicdata_0_8_consistency_claude_code_prompt_v1.md`, branch `v0.8-consistency` from `main` `1d55bc6`, 17 Oct 2026. Worktree `~/dev/vicdata_public_consistency`. No database writes.

**In one line:**
- Roll direction words now compare the latest census with three years before, everywhere, and read "Steady" when the change rounds to 0%.
- A set's "% change" is the change in the set's yearly average.
- Every minus is "−".
- An arrowed change that rounds to zero shows "–".

I stopped twice to ask (17 Oct): once on the groups' spans and the arrows on "since" figures, and once on which kinds of roll wording to leave.

| Check | Result |
|---|---|
| tsc, eslint, `next build` | clean (eslint: 0 errors, the 2 existing warnings) |
| Unit tests (every `src/**/*.test.ts`, with `.env`) | **443 / 443**. The first run failed one: the generated views preset table was stale after the heading change; regenerated. Catalogue unit tests **77 / 77**. |
| Rule tests (production, read-only) | **107 pass, 0 fail** (MANUAL 15, NONE 19, SUPERSEDED 4), including the 4 new rules. Eight hit statement timeouts on the full run and passed on rerun. |
| PGlite (RLS, usage log, every `supabase/tests/*.mjs`) | **17 / 17** |
| Teacher parity | 2,855 pairs: every text difference is the grade counts heading (35); fixtures byte-identical |
| Public page SSR | differs only in "−" (the narrative's population line) |
| Admissions parity | 328 pairs, 192 identical; every difference in categories 1, 3, 4 |
| SMT parity | 312 files, 200 identical; Subjects 10 cells; every difference in categories 1, 3, 4 |
| Groups parity | 176 files, 60 identical; every difference in categories 1, 3, 4 |
| Data View | every difference in categories 2, 3 |

Production was intermittently slow during the run. `academic_headline_lookup` timed out on `main`'s code too: it failed after 3–4 s, then succeeded in 13 s. Teacher parity needed three attempts, and every capture was retried until it succeeded. Nothing was reused from an earlier round.

## 1. Roll words on 3 years (R-ROLL-WORDS-3YR)

The constant is `ROLL_DIRECTION_SPAN = 3` and the helper is `rollDirection` / `rollDirectionOfPct`, both in `years.ts`. The groups' `GROWING_SPAN` reads it. "Steady" means the 3-year change rounds to 0% (R-FLAT-BAND). A school with fewer than 4 census years uses the longest span it has. Every roll (i) says: "Growing or shrinking compares this year's roll with three years ago."

| Place | Old span | Now |
|---|---|---|
| SMT Overview "Roll, indexed" word (`Lines.tsx`, `RollDirectionWord`) | 2022/23 vs latest, in index points, ±2 | 3 years, % change, rounds to 0% |
| SMT Pupils phases word | same as above | same as above |
| Admissions Momentum x (entry-age change), hovers, axis, header, (i) | since 2022/23 | 3 census years (the base year is 2022/23 while 2025/26 is the latest, so values are unchanged this year) |
| Groups GRP-O-ROLL word | 5-year like-for-like, ±1% | 3-year like-for-like, rounds to 0% (Harris: "▲ Growing" → "▼ Shrinking") |
| Groups GRP-S-GROWING count | 1 year | 3 years ("▲ 25 of 54" → "▲ 28 of 50", Harris) |
| Groups r3 Growing/Shrinking (counts, tile, caption) | 1 year | 3 years |
| Groups map colours and key | 1 year, ±1% ("within 1%") | 3 years, "under 0.5%" |
| Groups schools-table trend arrow | 1 year, ±1 | 3 years (the longest span where the database has none), ±0.5 like the map |
| Group home line and count (`rollSummary`) | this census vs last, any rise | vs 3 years before, "over 3 years"; growing = rounds to ≥ 1% |
| Groups "Schools growing" | 3 years | unchanged |
| SMT roll tile, SchoolTile, Admissions entry tile | arrows on "since 2019/20" | follow their own figure, with the flat band (Guy) |
| Data View roll statement; the Admissions and SMT threshold flags | — | not changed (Guy), logged |

Test schools: Wolverley (135061) +4.8% "Growing"; Pershore High (136925) −11.2% "Shrinking"; The Bewdley School (135035) −0.3% "Steady"; Chilmington Green (149840, census years 2023/24–2025/26) "Growing" over its 2-year span.

## 2. Set "% change" (R-SET-CHANGE-AVERAGE)

`src/lib/set-change.ts` `setAverageChange` gives the change in the set's yearly average. Entries start at the first year with entries (`changeStartFor`); points start at the baseline year. A single year is not a change.

| Set "% change" | Was | Now |
|---|---|---|
| Data View "Candidates, % change", set side, category mode | change in the set's summed entries | **yearly average** (The Chase Health & Care +30% → +6%) |
| Same, subject mode | average of each comparator's change | **yearly average** (The Chase History +23% → +15%) |
| Data View "Results, % change", set side, subject mode | average of each comparator's change | **yearly average** since 2022/23, aligned with category mode (Geography +5% → +4%) |
| Data View "Results, % change", category mode | yearly average since 2022/23 | unchanged (now through the same helper) |
| Data View KS2 domains, "Average across" | average of each school's own change | **yearly average**, aligned (no harness draws it) |
| Teacher Candidates group change; Comparisons "Average across {set}" | change of the yearly mean | unchanged |
| Teacher subject ranking, "Average across {population}" | mean of members' own changes, in the database function and its app mirror | **not changed:** needs a migration (logged) |
| SMT results flag | median of members' own changes (a flag threshold) | not changed (logged) |
| Admissions `gapSince2223` | change of the rivals' yearly mean | unchanged |
| Data View combined roll; Admissions feeder "area" | change in summed totals (a total, not an average) | not changed (logged) |

## 3. Minus sign (R-MINUS-SIGN)

`signedDelta` lost its hyphen option. `MINUS` is "−", `signedValue` handles values, and `UNSIGNED_ZERO` replaces both hyphen styles.

Raw hyphens fixed:
- the Data View map legends;
- the KS2 progress range;
- Teacher's "this moved" candidates magnitude;
- SMT's `fmt` percent (the groups' roll changes print through it);
- Admissions' `fmtPct`;
- the flag-figure hovers (Momentum, SMT Flags, feeder flags).

The rule test fails on any hyphen style or hand-rolled sign left in `src`.

## 4. Flat band (R-FLAT-BAND)

`flatBand`, `arrowed` and `ARROW` sit beside `signedDelta`. "Steady" means the change rounds to 0 at the precision shown, or falls within a view's own wider band. It prints "–", with a neutral colour. Inside a wider band the size is kept ("– 0.03"); a change that rounds to 0 prints the zero ("– 0%").

| Arrow form | Was | Now |
|---|---|---|
| SMT Now and Pupils tiles, SchoolTile ("since 2019/20") | no band: ▲ at 0 | rounds-to-0 band (Alcester Grammar, −0.38%: "▼ 0%" → "– 0%") |
| SMT Scorecard (cell and phone arrow) | arrow ±0.5, colour ±0.05 | one band per unit, arrow and colour agree |
| SMT Subjects, Areas; Admissions Strengths, Academic | ±0.05, "▬" | ±0.05 kept, "–" |
| SMT Context (children, births, projection, FSM) | no band | rounds-to-0 band |
| SMT pool and births words | ±2%, "▬" | ±2% kept, "–" |
| Admissions entry and market tiles, pool line (both places) | no band | rounds-to-0 band |
| Admissions bars (±2), `arrow` (±0.5), feeder flag | "▬" | bands kept, "–" |
| Groups `pctText` (±0.5), phone roll line (±0.5), share flag (±0.1 pp), peers word (±0.5) | "▬" | bands kept, "–" |
| Group home line | no band | rounds-to-0 band |
| Data View trend pill (±15%) | "▬" | band kept, "–" |
| Teacher ↑ ↓ → (R-TREND-FLAT-4PCT, ±4%) | — | not changed: already wider than rounding (logged) |
| Flag markers (Momentum), sort glyphs | — | not change arrows |

## 5. Small: grade counts

The heading now reads "{subject}'s entries at each grade, change since 2022/23: 2022/23 against {latest}". Every copy matches: the views=v2 series, the catalogue template, the view editor, the tests and the views preset table. The (i) gains one line: "It starts later than Candidates (which runs from the first year with entries, 2020/21) because these are grades…".

## 6. Parity: every difference, with its reason

Both trees' fixtures were captured back to back from the same data.
- **Teacher:** fixtures byte-identical.
- **SMT:** fixtures byte-identical.
- **Admissions:** fixtures differ only by the new `entryBasePeriod`.
- **Groups:** fixtures differ only in the per-school `trend` and the growing counts.
- **Data View:** fixtures byte-identical.

Differences in the walks:
- **Category 1, roll words:**
  - SMT: the roll word's new title attribute. The words themselves are unchanged for the test schools, so Leighton Park's Overview image is identical.
  - Admissions: Momentum's caption, hovers and header.
  - Groups: trends, counts, map, flag and r3 caption.
- **Category 2, set change:** the Data View's subject-area set side, both modes.
- **Category 3, minus sign:** "-" → "−" in the Data View, the SMT, Admissions and group tooltips and flag figures, and the public page's population sentence.
- **Category 4, flat band:**
  - "▬" → "–" everywhere;
  - "▲ 0%" → "– 0%" (Admissions, 24);
  - SMT Subjects "▬ 0.03" → "– 0.03".
- **Category 5, the heading:** the grade counts heading (Teacher, 35 views).

Noise and reruns:
- **Dukes phone Overview images** differ by up to 89/255 on about 110 pixels, with identical HTML. The arrow and its words are now separate text nodes, so glyph placement shifts; they read identically.
- **One Teacher case crashed on `main`** (a TypeError on load) and drew nothing. A rerun of both trees drew 20 views each, identical apart from the heading.
- **One group school per group still shows "—"** on both trees: Harris Aspire Academy (no yearly rolls) and Cardiff Sixth Form College (outside England).

## 7. Screenshots (`docs/v0.8/consistency_screenshots/`, light theme, `main` vs branch from the same fixtures)

- **SMT Overview and Pupils, Leighton Park:** `smt_110110_overview_*`, `smt_110110_pupils_*`. Overview is identical: Leighton Park's word and figures didn't change.
- **Admissions Momentum:** `adm_137625_momentum_*`. Header: "change since 2022/23" → "pupils over 3 years · results since 2022/23".
- **A group home:** `group_home_*`, Harris.
  - The harness feeds this page's API, using the database's 3-year combined change on the branch. That approximates the route, which recomputes from census rolls with the band.
  - Main: "roll ▼ 0.2% · 25 growing". Branch: "roll ▲ 6.2% over 3 years · 28 growing".
  - Also `group_overview_*`: Harris Overview, the map step with the new key and the roll flag.
- **A Data View page with negative changes:** `dataview_negative_*`, King's Worcester Post-16 Graphs.
- **A tile with a sub-0.5% fall:** `tile_sub05_*`, Alcester Grammar School (136622), roll 1,304 → 1,299 (−0.38% since 2019/20). The tile goes from "▼ 0%" to "– 0%" and the Scorecard row from "▬ 0%" to "– 0%".

## 8. Rules

| Rule | Status |
|---|---|
| R-ROLL-WORDS-3YR | **new**. Test: Wolverley growing, Pershore shrinking, Bewdley steady, Chilmington Green (3 census years) on its longest span; The Chase's Momentum base year; the groups' span; the (i) sentence in all seven roll views |
| R-SET-CHANGE-AVERAGE | **new**. Test: The Chase and its 10 nearest, subject mode (History) and category mode (Humanities), each against a plain yearly-mean sum |
| R-MINUS-SIGN | **new**. Test: every style, the Data View's bars rendered, SMT, Admissions and flag figures; no hyphen style or sign left in `src` |
| R-FLAT-BAND | **new**. Test: the helper, the SMT tile, colour and arrow, Admissions' arrow, the group home line and its count; no "▬" or unbanded ▲/▼ left in `src` |
| R-NO-NEGATIVE-ZERO | updated to the new styles |
| R-ADM-VIEW-MOMENTUM | statement and test updated: 3 census years |

`docs/catalogue/*.md` regenerated; `src/lib/signed-delta.test.ts` extended.

## 9. Logged calls

Under "2026-10-17 — consistency" in `docs/OPEN_QUESTIONS.md`:
1. **Groups' spans:** they were 1, 3 and 5 years; now all 3 (Guy).
2. **Database growing counts:** they count any rise, with no band.
3. **Arrows on "since" figures:** they follow their figure (Guy).
4. **Left as they were (Guy):** the Data View roll statement and the threshold flags.
5. **SMT's roll word:** it reads the first line (the day line at a boarding school).
6. **Wider bands:** views keep their own wider steady bands.
7. **Teacher's arrows:** "→" is unchanged.
8. **Other set changes:** left unchanged, with the reasons in §2.
9. **A set needs two years:** a set with one year shows no change.
10. **Grade counts heading:** every copy matches.
11. **Seen, not changed:** GRP-S-GROWING always shows "▲", and the SMT Scorecard's "Since 2022/23" heading sits over rows measured since 2019/20.
