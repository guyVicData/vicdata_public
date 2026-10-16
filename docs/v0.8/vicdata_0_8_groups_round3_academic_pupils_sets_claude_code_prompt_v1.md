# VicData 0.8 — Group round 3: Academic and Pupils, and a school's group as a comparison set

Claude Code build prompt, written 15 Oct 2026, for the app repo (`~/dev/vicdata_public`). It completes the group view (Academic and Pupils, spec §3.3) and gives every member school its group as a comparison set across VicData (§3.5).

**Run it after group round 2 is merged.** It reads the same ingest lookups (`docs/vicdata_group_aggregates_report_v1.md` in the ingest repo). If anything it needs isn't there, such as subject areas across a group, stop and list what's missing rather than computing it in the browser.

## Read first

- **The spec, §3:** §3.3 Academic and Pupils, §3.5 the group as a comparison set, §3.6 comparisons.
- **The wireframes:** `docs/wireframes/groups/Academic.dc.html` (Harris Academic, Secondary), `SchoolSide.dc.html` (a member school's view of its group as a set) and `Phone.dc.html`. Pixel-perfect, both themes, from the shell.
- `docs/v0.8/groups_r2_report_v1.md`: the control bar, readings, `GROUP_NOTES`, the rules.
- **The audit-fixes round's rules:** IGCSE excluded everywhere with a count, shared ties, named base years. They apply here from the start.

## Ground rules

As round 2: branch `v0.8-groups-r3` from `main`; commit per stage; the same checks; no server key in client code; stage by name; log calls under "2026-10-xx — 0.8 groups r3".

**Allowed differences, unlike round 2:**
- stage S adds a group set to Teacher's, Admissions', SMT's and the public page's comparison choosers;
- every pair that changes must be a member school gaining that set;
- the default set never changes;
- non-member schools must be byte-identical.

## A — Academic (`Academic.dc.html`)

- **Column 1:**
  - headline results across the group by phase, pupil-weighted, with "average school" as a toggle;
  - n with figures and the excluded list;
  - the group's place in its peer band.
- **Large view rail:**
  - **Schools ranked** (default): each school's headline, its rank within the group and its national rank. IGCSE schools are listed as "not ranked at GCSE".
  - **Subject areas across the group:** the group average against the national average and the comparison set, strengths and weaknesses. **Described, with n per area.** Use the audit-fixes minimum: at least two schools, each with 10 or more entries.
  - **Value added,** in its own panel, never mixed into results:
    - A-level VA for all schools where published;
    - Progress 8 for state schools;
    - independents labelled "not published".
- **Row 2:**
  - results trend by phase against the comparison set;
  - Post-16 trend;
  - a "schools improving and declining" count.
- **Results by band:** not built yet. Leave a labelled placeholder, as SMT has.

## P — Pupils

- **Column 1:**
  - combined roll by phase;
  - change;
  - staying on at 16 (Year 12 against Year 11, the wording from SMT round 2);
  - boarding and day where the group has boarding schools.
- **Large view rail:**
  - **The group's shape:** combined roll by single year of age;
  - **Entry cohorts across schools:** each school's main entry point cohort over time, read-only;
  - **Leaving at 16;**
  - **Market share:** each school's share of its own area, from Admissions where the school has set rivals, otherwise the nearest-schools default, labelled.
- **Row 2:**
  - roll indexed against the comparison set;
  - the projection of children around the group's schools: the sum of each school's catchment from `area_projection`, at each school's own saved or default catchment, **counting each neighbourhood once** where catchments overlap, with the method stated;
  - schools growing and shrinking.
- If the overlap rule can't be done properly from the existing functions, show the projection per school instead, and log what an ingest function would need.

## S — A school's group as a comparison set (§3.5)

- **In the existing chooser,** everywhere a comparison set works (Teacher, Admissions, SMT, the public page's rankings), a member school sees its group: "All Dukes schools", "All Harris Federation schools".
- **Phase filtering with counts:** "3rd of 9 Dukes schools with GCSE results". Preps don't count in a GCSE ranking.
- **Sources:**
  - official groups (GIAS, Club ISS, Companies House) are offered automatically;
  - likely members are included with the source label;
  - self-declared groups only to the school that made them (if any exist yet; otherwise the path is ready and tested with a fixture).
- **A school in several groups** sees each as its own set.
- **The rank within the group** appears beside local, regional and national ranks.
- **Built on** `school_groups_lookup` / `group_schools_lookup` through the same custom-set path as `?set=`. No new chrome.
- **This doesn't depend on the group membership:** every member school gets it (§3.2).

## R — Rules and tests

- **R-GROUP-VA-SEPARATE:** value added never appears in a results chart.
- **R-GROUP-IGCSE:** the audit-fixes rule, at group level.
- **R-GROUP-SET:**
  - the set appears for members only;
  - its count is phase-filtered;
  - the default set is unchanged;
  - non-members are byte-identical in parity.
- **R-GROUP-SET-SOURCES:** likely members are labelled; a self-declared fixture is visible only to its maker.
- **R-GROUP-CATCHMENT-OVERLAP:** each neighbourhood counted once, if built.
- R-METHOD-PRESENT on every new view.

## Report

`docs/v0.8/groups_r3_report_v1.md`:
- what was built;
- each panel's lookup and n;
- the parity pairs gained by stage S, as counts per product and three examples;
- what's missing from the ingest, if anything;
- differences from the wireframes;
- the rules table;
- logged calls;
- **the open decision for Guy:** rank groups only against groups of the same type (the default built), or also offer a mixed comparison with a label.

Screenshots go in `docs/v0.8/groups_r3_screenshots/`:
- Harris Academic (Secondary) and Pupils;
- Dukes Academic (Post-16) and Pupils;
- both themes, 1440 and 390;
- a Dukes school's Teacher view with "All Dukes schools" chosen;
- a Harris academy's SMT rank line;
- a non-member school's chooser, unchanged.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.8-groups-r3 -m "0.8 Groups round 3: Academic, Pupils, a school's group as a comparison set" && npm run build && git push
```

Stop before merging if a non-member school's page changes, if the default set changes anywhere, or if a route lets the wrong user in.
