# VicData 0.6 — "Add a view": every combination, checked (v1)

*Guy (3 Oct): "think through every combination of choice for columns/rows and check what Add a view would show… what happens if I really change it up? Needs to make sure Add a view throws up the right choices." Companion to `vicdata_0_6_scope_brief_v1.md` §3 and `vicdata_0_6_view_catalogue_and_offer_design_v1.md`. The view inventory used below is drawn from earlier round briefs; S0's audit replaces it with the real list.*

---

## 1. What "Add a view" knows when it opens

The Pick list is a filter over the catalogue. What it shows depends entirely on the **context** the panel passes in, so that has to be defined precisely first.

| Layer | Contributes | Today's Teacher dashboard |
|---|---|---|
| **Dashboard** | Phase (if single-phase); whether it has subject chips; which subject the chips are focused on | GCSE or Post-16; chips = your subjects |
| **Column** | Data + measure; focus; compared-to | Col 1 *my subject*: no comparison. Col 2 *school context*: compared to other subjects. Col 3 *comparisons*: compared to a school set |
| **Row** | **Time**: latest year, over time, or either | Current = latest year; Trends = over time |
| **Panel** | Overrides of any of the above | None today, but see finding F2 |
| **User** | Role palette (decided: Teacher gets no extra datasets) | Teacher = academic only |

**Precedence:** panel override > row (time only) > column (data, focus, compare) > dashboard (phase, subject binding).

**Finding F1 — rows carry time, and the model didn't say so.** "Current" and "Trends" aren't just names: they're the time dimension. If rows are just labels, a Trends panel would offer current-year views and the other way round. **Fix: each row gets a Time setting** (Latest year / Over time / Either). Current and Trends get it by default, and a user's new row defaults to Either. Columns never set time; rows never set data.

---

## 2. The matching rule

A catalogue view appears in Pick when **all** of these hold:

1. **Data and measure** match the column (or the panel override).
2. **Focus** is one the view supports.
3. **Compare** follows a subset rule:
   - with no comparison, only views that don't compare;
   - with one or more comparisons, views whose comparison types are all among those chosen.

   So "10 nearest + 3 averages" offers set views *and* average views, and any view built for both.
4. **Time** matches the row's setting (Either = no filter, results grouped *Latest year* / *Over time*).
5. **Palette**: the user's role is allowed the data.
6. **Status** is `live` (super-admin also sees `draft`).

**Ordering:** views already used on a VicData dashboard in the same position come first, then the rest.

**This is a structural filter, not a data check.** Whether *this* school has enough years for *this* subject is not used to hide views, or the list would change every time someone switches subject chip. Instead the card carries a warning tag (F9), and the view shows its normal honest empty or suppressed state.

---

## 3. The combinations

### A. The Teacher dashboard as it is (3 columns × 2 rows), Candidates

| Panel | Context | Pick shows |
|---|---|---|
| Col 1 × Current | Candidates · my subject · none · latest | Number tiles (entries, rank in category, rank in school) |
| Col 1 × Trends | Candidates · my subject · none · over time | Trend chart (indexed / actual), trend table, change list, change table |
| Col 2 × Current | Candidates · my subject · *in school: category* · latest | Donut (share of group), bar chart, ranked list. Switching the column to "all subjects" or "my subjects" offers the same views |
| Col 2 × Trends | … · over time | Share trend chart and table, change list |
| Col 3 × Current | Candidates · my subject · *10 nearest* · latest | Map, rank tiles, bar chart, ranking |
| Col 3 × Trends | … · over time | Trend map, change map, ranked change bars, trend table, change table |

**Finding F2 — today's Col 1 Trends breaks its own column.** The "against the wider system" views (school vs LA, region and England) compare, but Col 1 says "no comparison". Under the rule they'd *not* be offered in Col 1, which matches your own plan to move them out. For seeding the four VicData dashboards, S3 either:
- gives that panel an explicit override (badge shows "overridden: LA, region, England"), or
- moves those views now to Col 3, or to a new "vs the wider system" column.

S0 flags every panel like this, where the hand-built placement doesn't match its column.

### B. Same dashboard, Results

| Change | Pick shows | Note |
|---|---|---|
| Average points, Col 2 Current | Bar chart, ranked list. **No donut** | A share of an average isn't meaningful; the live code already drops it. The catalogue enforces it |
| Grade 4+ rate, Col 3 with averages ticked | Set views only. Averages chips **hidden** at step 2 | No LA, region or England Grade 4+ benchmark exists |
| Grade 4+ rate, Col 1 Trends | Trend chart, table, pp change bar | Numbers: Rate / Change in pp |
| Grade bands, any column | Distribution chart, tiles (once the grade-bands round ships) | **Open:** trend of bands, is that built or planned? |

### C. Really changing it up

| # | Setup | What Pick should do | Finding |
|---|---|---|---|
| C1 | User renames rows to "Overview" and "Detail" | Time = Either. Show everything, grouped *Latest year* / *Over time* | F1 |
| C2 | One column, one row, no comparison | Every non-comparative view for that data, both time groups | Fine |
| C3 | 4th column "vs England" (compare = averages) | Geography comparison chart and table | This is where F2's views naturally live |
| C4 | Trends panel spanning Col 1 (no comparison) and Col 3 (10 nearest) | Left-most rule → non-comparative only, which is probably *not* what someone spanning into Comparisons wanted | **F3:** when a span covers columns with different settings, ask once, "Use settings from: Candidates / Comparisons", left-most pre-picked |
| C5 | Custom area focus × compare 10 nearest | Probably **nothing built** (group vs set) | **F4:** needs an empty state (§4) |
| C6 | Column changed from Candidates to Births after views were added | Existing views no longer fit | **F5:** revalidate on change (§4) |
| C7 | Admissions dashboard: Rolls / Births / Rolls vs 10 nearest | In 0.6 the Rolls and Births *measures* are registered, so the columns can be set up, but Pick is empty until their views are built | **F6, resolved:** skeleton with placeholders (§6), build the views next round, then swap them in |
| C8 | Births column with focus "School" | Births are area data. "School" has to mean *around your school* (its LA, area, region, England) | **F7:** focus options come from the data's keying (school-keyed vs area-keyed). The schema already records this (`entity_keying`) |
| C9 | Academic column with focus "Surrey" | "Maths in Surrey" as a subject of its own has thin support | **F7 again:** for school-keyed data, *beyond school* only makes sense as a comparison, not a focus. Step 2 shows the beyond-school row only for area-keyed data |
| C10 | GCSE column and Post-16 column on one dashboard | Phase can't come from the dashboard | **F8:** phase belongs to the column's data (GCSE/Post-16 sub-list at step 1). The dashboard default only pre-fills it (revises D2) |
| C11 | Subject focus on a dashboard with subject chips | Should the view follow the chips, or stay on Maths? | **F10:** focus = Subject has two modes, *Follow the subject chips* (default on dashboards with chips) and *Always [subject]*. A dashboard shows subject chips only if at least one column follows them |
| C12 | Col 1's several-subjects-side-by-side views | Focus isn't one subject, it's *my ticked subjects* | **F11:** add focus "My subjects" (personal, live), distinct from "Custom area" (named and fixed) |
| C13 | Trends row, subject with only 2 years at this school | Trend views stay listed, tagged "Not enough years here yet: shows a table" | **F9:** warning tags, not hiding |
| C14 | School with no Post-16 data, Post-16 column | Views listed; panel shows "No Post-16 data for The Chase" | F9. And the column's step 1 should warn when picked |
| C15 | Teacher's copy of a School-Admin dashboard that includes Births | Viewing is fine. Add a view in that column: empty state "Births isn't in your plan" | **F12:** palette limits *adding*, never *viewing* |
| C16 | Column with no data set yet (custom layout, columns not configured) | Add a view opens at **step 1**, not at Pick | Fine, just needs stating |
| C17 | Panel override then column change | Override wins. Revalidation (F5) skips overridden settings | Fine |

---

## 4. Screens this adds (for the canvas)

1. **Row Time setting**: in New dashboard step 2 and the editor's row header ("Latest year / Over time / Either").
2. **Pick, Either row**: the list grouped *Latest year* / *Over time*.
3. **Pick, empty state**: "Nothing built for this yet", with one-tap relaxations that each show how many views they'd unlock:
   - "Without comparison (4 views)";
   - "Over time instead (6)";
   - "Change data".

   Plus **"Ask for this view"**. That sends the context to super-admin as a catalogue request, so gaps users actually hit become the build backlog.
4. **Card warning tag** (F9): one line on the card.
5. **Span: which column?** (F3): one question when a span covers mismatched columns.
6. **Column change revalidation** (F5): "2 views don't fit Births. Keep them as overrides / Remove / Swap to nearest equivalent".
7. **Step 2 focus**: add "My subjects"; add the follow-chips / always toggle on Subject; beyond-school row only for area data.

---

## 5. Decisions for Guy (all defaults accepted, 3 Oct)

| # | Decision | Recommended default |
|---|---|---|
| A1 | Rows carry Time (Latest / Over time / Either) | Yes; Current and Trends default to it |
| A2 | Matching rule as §2, including the comparison subset rule | Yes |
| A3 | Data gaps tag cards rather than hide them | Yes |
| A4 | Today's Col 1 geography views: override in place, or move now | Override in place for 0.6 parity; move in your planned Trends pass |
| A5 | Span with mismatched columns asks once | Yes, left-most pre-picked |
| A6 | Academic data: beyond-school is comparison only, never focus | Yes |
| A7 | Phase is per column, dashboard only pre-fills it | Yes (revises D2) |
| A8 | Subject focus follows the chips by default; "My subjects" added as a focus | Yes |
| A9 | Empty state with relaxations and "Ask for this view" | Yes |
| A10 | Rolls and births in 0.6 | **Decided (3 Oct):** Guy will build Admissions and SMT straight after 0.6, by skeleton → code → refine (§6). 0.6 registers the Rolls and Births **measures** (data layer, rules, fetch) so columns can be set to them. Their **views** come next round, built against placeholders |

---

## 6. Skeleton, then code, then refine (Guy, 3 Oct)

Guy's plan for Admissions and SMT: sketch the dashboard in the builder, add the missing views in code, then refine in the builder. 0.6 supports this directly.

1. **Skeleton in the builder.** Columns can be set to any *registered measure*, even one with no views yet. So 0.6 registers Rolls and Births as measures. Where Pick comes up empty, super-admin gets **"Add a placeholder"**:
   - a one-line description;
   - a rough shape;
   - build notes.

   The placeholder saves the panel's *exact* context: data, measure, focus, compare, time.
2. **Placeholders on the dashboard.** These are dashed "Planned" panels. They're visible only to super-admin; a dashboard assigned to users hides them until a real view replaces them.
3. **Export planned views.** One button in the editor bar writes every placeholder on a dashboard as a list, each with its context in catalogue terms plus your notes. That list becomes the Claude Code brief for the round that builds them. Users' "Ask for this view" requests land in the same list.
4. **Build in code.** Each new view is registered as `draft` with the capability declaration from its placeholder, following the catalogue's definition of done.
5. **Refine in the builder.** When a draft view matches a placeholder's context, that panel shows "Ready to swap in": preview, then swap. Then customise, retitle, reorder, and promote to `live`.

**For the 0.6 build:**
- S2 registers the Rolls and Births measures (cards, rules, fetch functions), with no views.
- S5 adds placeholder panels, "Add a placeholder" (super-admin) / "Ask for this view" (others), "Export planned views", and placeholder matching on new drafts.
- Placeholders are stored in the dashboard config as a dataview with `kind: "placeholder"`, so the renderer, move/copy and save all work on them unchanged.

Canvas boards: "Nothing built yet" and "Skeleton dashboard".
