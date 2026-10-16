# VicData 0.8 — Group round 2: the Overview and Schools dashboards

Claude Code build prompt, written 15 Oct 2026, for the app repo (`~/dev/vicdata_public`, app database `lnhulykjlxmoneappnsp`). Group round 1 built who can see what: head-office accounts, grants, the Access page and the head-office home. This round builds the first two group dashboards, **Overview** and **Schools**, for Harris Federation and Dukes Education.

**Run it only after the ingest's group-aggregates round is promoted** (`~/dev/vicdata/docs/vicdata_group_aggregates_report_v1.md`). If `group_aggregate_lookup`, `group_comparison_lookup` and `group_schools_year_lookup` don't answer in production, stop and say so. **Read that report's G0 (the Dukes ▼8.9% check) before drawing Dukes' roll.**

## Read first

- **The spec:** `docs/v0.8/vicdata_one_dashboard_ux_smt_and_groups_spec_v1.md`, §3: §3.3 Overview and Schools, §3.4 honesty wording, §3.6 comparisons.
- **The wireframes:** `docs/wireframes/groups/Main.dc.html` (Harris Overview, with "Against others"), `Schools.dc.html` (Dukes Schools, light theme) and `Phone.dc.html`. **Pixel-perfect, both themes, from the shell** (`src/components/shell/`), group accent as round 1 set it.
- `docs/v0.8/groups_r1_report_v1.md`: the access rules, `GROUP_NOTES`, the head-office home's "coming" chips, View as.
- `docs/v0.8/smt_r4_report_v1.md`: the method on every view (R-METHOD-PRESENT), and the audit-fixes round's IGCSE rule. **The group views follow both from the start.**

## Ground rules

- **Branch `v0.8-groups-r2` from `main`.** Commit per stage.
- **Clean before merge:** tsc, eslint, build, unit, rule, RLS (all, including groups r1's 102), usage log, Teacher, Admissions and SMT parity, the public page, groups r1 screens.
- **Only the group dashboards and the head-office home's Overview and Schools chips** (which go from "coming" to live) may change.
- **Database changes are written and tested (PGlite), never applied by you;** none are expected. Give commands as `&&` chains with the project-ref check and no `exit`.
- No server key in client code. Stage files by name. Leave Guy's files alone.
- **Log calls** under "2026-10-xx — 0.8 groups r2" in `docs/OPEN_QUESTIONS.md`.

## A — Access and routes

- **Routes:**
  - `/teacher/group` stays the head-office home;
  - the dashboards are `/teacher/group/overview` and `/teacher/group/schools`;
  - the switch reads Overview · Schools · Academic · Pupils, with Academic and Pupils shown as coming until round 3.
- **Who:**
  - head office of that group;
  - a member school's SMT and School-Admin **only while the school holds a current grant** (round 1's rules);
  - platform admins through View as (read-only, never logged).

  Every route checks this on the server. Add route tests for:
  - another group's head office;
  - a non-member school;
  - a revoked grant;
  - a school that left the group.
- **Usage log:** `product = group`, with the dashboard, view, focus chip and reading, as round 1 set up.

## B — The control bar

- **Focus chips:** All phases · Primary · Secondary · Post-16.
- **The school picker:** highlights one member school across every view on the board, and clears with ×.
- **The reading pill:** "Members at the time" (default) · "All schools listed now", with the `GROUP_NOTES` line for each.
- **"Compared against" pill** (§3.6): peer groups (same type and size band, the default) · named groups (pick up to 3) · non-group schools · the group's areas · England · mix-matched (labelled).
  - Self-declared groups are never offered.
  - Each choice's (i) states the set and how many schools are behind it.

## C — Overview (`Main.dc.html`)

- **Column 1, "The group now":**
  - schools by phase;
  - combined roll and its change (1, 3 and 5 years; the default from the wireframe);
  - the XS–XL spread;
  - regions covered;
  - **source label and last-checked date** ("Membership as of {date}, from {source}");
  - likely members counted and labelled.
- **Large view rail:**
  - **Against others** (default): the group beside its comparison sets on population (roll indexed, share of places), change (schools growing and shrinking) and results (headlines by phase).
    - The counts are always shown: "Harris: 32 secondaries with GCSE results; non-group: 1,104".
    - Where the group sits in its peer band: "4th of 11 MATs with 41+ schools on Attainment 8". Shared ties.
  - **Map:** member schools sized by roll and coloured by trend, on the shared Leaflet map. Schools outside England are listed beside the map, not drawn on it.
  - **Joined and left:** a timeline, dated where the source dates it and "last seen {date}" where not.
- **Row 2:**
  - combined roll trend indexed to 100, against the comparison set (the base year named, per the audit-fixes helper);
  - combined results trend by phase, pupil-weighted, with "average school" as a toggle;
  - share of the region's places.

## D — Schools (`Schools.dc.html`)

- **The large view: the schools table.** One row per member school, with:
  - roll, phase, XS–XL, shape;
  - headline results and national rank;
  - VA where published;
  - trend;
  - confidence (confirmed / likely);
  - "joined {date}".

  Sortable. Each row opens:
  - that school's **SMT read-only** (round 1's rule: only where the school has its own VicData membership; Admissions panels follow the school's sharing setting);
  - otherwise, **its public page**.

  Rows for schools without results show the reason ("IGCSE: not ranked at GCSE", "prep: no KS2 published", "outside England"), never a blank.
- **Alongside:**
  - shape small multiples, one per school, described and never ranked;
  - a size-and-results scatter, with the picked school highlighted.

## E — Honesty, methods and rules

- **`GROUP_NOTES`** (§3.4), each locked with a rule:
  - "Membership as of [date], from [source]";
  - the combined-figures sentence, by reading;
  - "compares only groups of the same type and a similar size band";
  - "missing results are listed".
- **Every view has a method** (R-METHOD-PRESENT), generated from the lookups' metadata where there is any:
  - which schools are counted;
  - the reading;
  - pupil-weighting;
  - the comparison set and its n;
  - exclusions;
  - sources and years.
- **Rules:**
  - **R-GROUP-COUNTS:** every figure shows its n, and it equals the lookup's;
  - **R-GROUP-MISSING:** every member school appears in the Schools table, with a figure or a reason;
  - **R-GROUP-READING:** both readings give the lookup's figures, and the default is "at the time";
  - **R-GROUP-PEERS:** no self-declared group in any peer set, and the peer band equals the ingest's;
  - **R-GROUP-HARRIS-ROLL:** Harris' combined roll equals the sum of its schools' census rolls (the ingest's G5);
  - **R-GROUP-DUKES:** Dukes' roll and change equal the ingest's corrected G0 figures, with Cardiff Sixth Form College listed as "outside England".
- **If any figure differs from the ingest's spot checks, stop and report; don't change the test to match.**

## Report

`docs/v0.8/groups_r2_report_v1.md`:
- what was built;
- each panel's lookup, years and n;
- the Dukes figures and G0's explanation, as shown to the user;
- differences from the wireframes;
- the rules table;
- logged calls.

Screenshots go in `docs/v0.8/groups_r2_screenshots/`:
- Harris Overview with each "Compared against" choice;
- Dukes Schools in light;
- both dashboards for both groups, both themes, 1440 and 390;
- a member school's SMT opened from the Schools table;
- a non-member's public page opened from it;
- the negative route test.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.8-groups-r2 -m "0.8 Groups round 2: Overview and Schools dashboards" && npm run build && git push
```

Stop before merging if Teacher, Admissions, SMT or the public page differ, if any route lets the wrong user in, or if a figure doesn't match the ingest. Push the branch and report instead. If a push fails, give Guy the HTTPS command.
