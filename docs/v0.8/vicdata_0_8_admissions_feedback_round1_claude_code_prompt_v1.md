Build Admissions feedback round 1 (F-12 to F-21) from your triage, with Guy's decisions below. First save this message as docs/v0.8/vicdata_0_8_admissions_feedback_round1_claude_code_prompt_v1.md and commit it. Follow the ground rules in docs/v0.8/vicdata_0_8_smt_feedback_round1_claude_code_prompt_v1.md: branch v0.8-admissions-fb1 from main over HTTPS, use a worktree if the checkout is busy, no database writes (migrations written and tested in PGlite for Guy), tsc/eslint/build/tests/parity clean, stage files by name, log calls in docs/OPEN_QUESTIONS.md.

Decisions:
- F-12, F-14, F-18, F-19, F-16, F-20 as triaged.
- F-15: as triaged. Pipelines Shape and size shows the local shape plus the shapes of the current set's feeder schools. Nothing moves to Market share.
- F-17: every table in every product tints the featured row in that product's own colour (Admissions blue; Teacher GCSE and Post-16 colours; SMT; groups orange). Add one token per product, in light and dark.
- F-21: share of the whole Y7-Y11 roll, year by year, as the last view in the rail.
- F-13: rebuild the Funnel as "Why did our intake change?". It is a waterfall from 2019/20 to the latest year that splits the change in the entry cohort into three parts: births (cohort size), families moving (area Y6 against births), and the school's share (its Y7 against area Y6). 16+ uses area Y11 and the school's Y12. 4+ gets no funnel. Round the parts, and use a 3-year average where intakes are small.
- The area for the funnel is a catchment radius, not LAs. Births are ONS LSOA population at age 0 within the radius. Check how far back the loaded LSOA single ages go. If they don't reach the cohort's birth year, use the earliest age held and say so in the (i). If the LSOA data can't do it at all, fall back to an LA blend weighted by the catchment's population in each LA. Log which you used, and carry on rather than stopping.
- Radius: independents use 15 km, editable. State schools use a density radius: the smallest radius holding their 5 nearest same-phase state schools, editable. The (i) says how the radius was set. Check SMT round 4's catchment and make it use the same rule, so the funnel, local births and SMT Context share one area.
- The (i) notes that boarding schools draw from beyond any radius, and that "families moving" includes children crossing the radius to go to school.
- Feeder lists do not change the funnel. The view names its area, e.g. "15 km around Leighton Park (not your feeder list)".
- New view next to the funnel: local births. Catchment births by year, indexed against the region and England, with a second x-axis label "Year 7 entry in" (16+: "Year 12 entry in").
- Republish the Pipelines config so the live Funnel picks up the new view.

Report in docs/v0.8/admissions_feedback_round1_report_v1.md: each item as built, with screenshots in light and dark for Leighton Park and The Chase, the funnel method and which births source was used, the radius rule, and Guy's commands in order (migrations, merge, Render deploy).
