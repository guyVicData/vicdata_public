# VicData 0.8: Guy's feedback of 15 Nov, build A (bugs), report

Branch `v0.8-feedback-a`, from `main` 38c9cee, in its own worktree. Not pushed or merged. Every call made without asking is logged under "2026-11-15: feedback build A" in `docs/OPEN_QUESTIONS.md`.

## The milestones and their commits

| | What | Commit |
|---|---|---|
| M1 | A1 subject matching (R-SUBJECT-MATCH), with A5's Teacher guards (R-RANK-MIN, R-WALK-NO-REPEAT) and the unpublished years' reasons, which share the walk's files | 2579772 |
| M2 | A2 head office walks (R-GROUP-WALKS-LOAD) and HO3; A3 duplicate groups; A4 the stall between walks | 8b0c684 |
| M3 | The screenshots beside Guy's; the walk error's own words; the indexed chart's base named honestly | ac71e01 |
| M4 | This report | 2970b0c |
| M5 | The runner's two lint warnings; the report's final test column | (this commit) |

`role-walks.tsx` carries both A2 (the walk error, the account) and A4 (the Admissions walk), so A2, A3 and A4 share M2.

## Each note: fixed, not a bug, or left

Build A covers Teacher 3–8, head office 1–3, Platform 1, Admissions 3, and the A5 guards. The other notes belong to builds B and C.

| Note | Result |
|---|---|
| **T3** (empty "nearby and nationally") | **Fixed (M1).** Two causes. (1) The nearby schools publish "Fine Art", so the 10 nearest had no figure; with subjects matched they do. (2) The base year had to have a figure on every line. Now the base is the school's own first year with a figure: of those years, the earliest that the most comparators share. Comparators with no figure that year are named and not drawn. The chart is empty only when the school has fewer than two years. The Chase: base 2021/22 (its 2020/21 isn't published for England or the LA); The Chase 129, the 10 nearest 92, Worcestershire 55, England 95. The dashboard's area chart indexes each line to its own first year, so it never had this bug. |
| **T4** (2023/24 "not published") | **Fixed (M1)** in part: the label gives the reason, "2023/24: 3 entries, too few to publish", on the chart and in the answer. A year with no entries says "no entries". The 2020/21 label lead: 2020/21's "A level" rows are now read as "GCE A level", so The Chase's 12 entries that year are back. **Left for build C (C11):** a gap in place of the dotted bridge, and small cohorts marked on the chart. |
| **T5** (Chart and Area chart the same) | **Fixed (M1).** The Results chart draws the area's other subjects with points (Film Studies here), as its title says. The area chart draws the 10 nearest and Worcestershire, now that subjects match. R-WALK-NO-REPEAT checks every Teacher walk on every fixture. |
| **T6** (all 10 nearest "no figure") | **Fixed (M1).** This was the root cause (D2). Each school's own title is shown beside its name ("Hanley Castle High School (Fine Art)"). The map's dots are sized by entries and hollow where a school has no figure, and The Chase is row 0 of the list. |
| **T7** ("1st of 1 schools") | **Fixed (M1).** "4th of 7 schools on average points in Art and Design (all titles), 2024/25 (only 9 students). 4 schools publish no figure." Cleeve 42.7, Pershore 40.7, Tewkesbury 38.3, The Chase 35.6, Christopher Whitehead 32.9, Hanley Castle 32.5, All Saints' 28.8. Cleeve reads 42.7, not Guy's 43.6: its Fine Art (11 entries, 43.6) is merged with its Graphics and Photography, weighted by entries. |
| **T8** (Rank over time on 1 school) | **Fixed (M1).** "Down: 1st of 9 in 2021/22, 4th of 7 in 2024/25." With fewer than 3 schools with a figure, a year has no place. With no such year, the screen says "Not enough schools with a figure to rank". |
| **HO1, HO2** (every walk "couldn't load") | **Fixed (M2, M3).** Root cause below. The walk's error now names what failed, with the route's own message and its code ("The group figures aren't available yet. (error 503)"), logs it, and always links home. Every group walk loads on the fixtures for Harris, Nexus (special), Birmingham (nursery federation), Shaw and Dukes, each with and without an account (R-GROUP-WALKS-LOAD). |
| **HO3** ("Public page" cards) | **Fixed (M2).** The cause wasn't `link.kind`. A card opened SMT only when the member school itself holds a VicData account, which none of Nexus's or Harris's do, and the SMT routes refused for the same reason. **Decided:** a platform admin in head-office View as opens every member school's SMT, read-only, from published data. A real head office keeps G2's rule (SMT only for schools that have joined), and the heading then says so. No group has an account live, so today every head office is View as. SMT Overview, Academic and Pupils build without error for Abbey School (142768, a Nexus special school). Their empty states are on the live list. |
| **P1** (Nexus listed four times) | **Fixed (M2).** These are two real GIAS records per trust: the trust (capitals) and its "School sponsor" record (title case, its own id), with identical member schools. 836 of production's 848 sponsor records are such twins. The search folds each twin into its trust: the trust's id, the mixed-case name, and the sponsor's id kept as an alias. Each row shows the group id. Sponsors that span several trusts (12, e.g. dioceses) stay as they are. The fixtures' Nexus, group:16125, is the trust record. Companies House numbers would need `school_groups_lookup` to return them (an ingest change, SQL below). |
| **Adm 3** (walk 1 → walk 2 stalls) | **Fixed (M2).** Walk 2 waited for the rivals answer before drawing anything. That answer reads England's results, about 16 s on a cold server cache (measured through the route handlers: home 0.4–9.7 s, walk 1 0.4 s, walk 2's rivals 16.4 s cold, 0.4 s warm), and nothing warmed it. The walks also skipped the dashboard's browser cache. Now the walks and the Admissions home share that cache. Walk 2 draws as soon as market share is in, and only rivals' screens wait. The home and walk 1 warm rivals. |
| **A5 guards** | **Fixed (M1).** A rank needs 3 schools with a figure (R-RANK-MIN; the home's nearby tile too). Rank over time draws no line for 1 school. No two screens draw the same series (R-WALK-NO-REPEAT). "Not published" labels give the reason. |

### A2's root cause

The walk's own request was never wrong: it returns 200 for Harris 3320, Nexus 16125, the nursery federation and the others. I ran it through the route itself (a stubbed platform admin with the View as cookie, on live production) and through a local server in a browser. The production database's request log for Guy's session shows View as opened on **group:16132** and **group:3319**, the GIAS "School sponsor" twins of Nexus and Harris that Platform 1's duplicate rows offered, never on 16125 or 3320. For those ids the live route read the group's aggregate and made no further group read. So it answered before the comparisons, either 503 (no figures) or 502 (a throw); the exact code isn't in any log I can read. The walk then showed one sentence for every failure code, so the cause was invisible, and it offered no way out.

Fixed three ways: the twins no longer appear in View as (A3); the walk shows the route's message, its code and the way home; and the walk reads its `account` through the router's `useSearchParams`. It used to read `window.location`, which on a client navigation from the home isn't updated yet when the state initialises: harmless under View as, but the wrong group for a head office with several accounts. A View as cookie already set to a twin id isn't rewritten: Back to me and picking again gives the trust.

## Subject title families, for Guy to confirm (D2)

Only **Art and Design** is grouped: A level and AS **Art and Design, Fine Art, Photography, Graphics, Textiles, 3D Studies, Critical Studies** as "Art and Design (all titles)". A BTEC "Art and Design" stays apart. The data holds no DfE subject code, so the equivalence is a list (`src/lib/subject-match.ts`).

The other title families in the data (Post-16, 2021/22–2024/25, national rows; GCSE where noted). None is grouped; each needs Guy's yes or no:

| Family | Titles in the data | Note |
|---|---|---|
| Art and Design, edges | History of Art; Visual Arts (IB); Fashion / Textiles Design (BTEC); Graphics Software (Use) (vocational); Design and Technology (Textiles Technology) | Left out of the group: different subjects or qualifications. D&T Textiles sits under Arts, Media & Design in the data. |
| Art and Design at GCSE | Art and Design; Photography | GCSE Photography is an Art and Design title too. Not grouped (D2 says A level). |
| Design and Technology | Design and Technology (IB); Design and Technology (Product Design); (Engineering); (Textiles Technology); Three Dimensional Design (3D Design) | |
| Mathematics | Mathematics; Mathematics (Further); Mathematics (Statistics); Mathematical Studies (IB, and Core Maths) | Further Maths is a second A level, so likely not one subject. |
| English | English Language; English Literature; English Language and Literature | Three distinct A levels. |
| Media and film | Film Studies; Media / Film / TV Studies; Film / Video / Television Production (BTEC); Multimedia (BTEC, OCR) | |
| Drama | Drama and Theatre Studies; Theatre Studies (IB); Speech and Drama (BTEC) | |
| Music | Music; Music Technology; Music Technology (Electronic) (BTEC); Music Performance (Group) (BTEC) | |
| Sport and PE | Physical Education / Sports Studies; Sports Studies (BTEC, OCR); Sports / Movement Science (BTEC) | |
| Religious studies | Religious Studies; Religious Education | |
| Computing | Computer Science; Information and Communications Technology; Computer Appreciation (Introduction); Computer Architecture / Systems; Computer Games | |
| Law | Law (A level); Law / Legal Studies (BTEC); Legal Services (T Level) | |
| Business and finance | Business Studies; Management Studies / Science (IB); Small Business Management; Accounting and Finance; Accounting; Finance | |
| Health | Health Studies (BTEC, OCR); Health (T Level); Healthcare Science (T Level) | |
| Science, applied | Applied Science; Science (T Level) | |
| Engineering | Engineering Studies; Electronic / Electrical Engineering; Mechanical Engineering (General); Manufacturing Engineering; Aerospace Engineering | |
| Classics | Classical Civilisation; Classics (General); Classical Greek; Latin; Other Classical Languages | |
| Environment | Environmental Science; Environmental Management | |

## Figures that changed, before and after

On purpose, from A1. The Chase (137625), Post-16, Art and Design, 2024/25:

| Where | Before | After |
|---|---|---|
| The 10 nearest (walk map, bars, ranking) | all "no figure" | 7 with points (Cleeve 42.7 … All Saints' 28.8); all 10 with entries |
| The Chase's place | "1st of 1 schools" | "4th of 7 schools" |
| Rank over time | 1st of 1, every year | 1st of 9 in 2021/22, 4th of 7 in 2024/25 |
| Nearby and nationally (entries, indexed) | empty | base 2021/22: The Chase 129, 10 nearest 92, Worcestershire 55, England 95 |
| Nearby and nationally (points) | The Chase and England only | The Chase 35.6, 10 nearest 36.0, Worcestershire 42.9, England 40.6 |
| England, Art and Design A level (walk and dashboard) | 40.7 (the title alone) | 40.6 (all titles) |
| The Chase's entries, 2020/21 | missing (labelled "A level") | 12 |
| Teacher dashboard, Post-16 comparisons on an Art and Design title | the exact title only | every school's titles merged |
| SMT Academic, a set school's figure on an Art and Design line | the exact title only | its titles merged |

Parity on the 14 Nov fixtures (every Teacher walk screen for The Chase's GCSE Geography and Chinese, Leighton Park's Post-16 Maths, Russian and Physics; base 38c9cee against the branch): **no figure moved.** 28 of 85 screens changed:

- words: "the 10 nearest schools" became "sixth forms" at Post-16; the rank guard's counts; the empty state names its reason;
- the Results chart's added subjects and its unpublished-year reasons;
- the map's dots and row 0;
- **one correction:** the map's answer counted a school as publishing in the latest year when it had entries in any year. For The Chase's Chinese, "5 of them published … in 2025/26" is now 3.

The group payloads aren't touched (`dashPayload` is unchanged). Under View as, the group home's `vicdata` flag is now true for every member.

## Tests and parity

| Check | Base (the review fixes' final run) | M1 (2579772) | M2 (8b0c684) | M4 (2970b0c) |
|---|---|---|---|---|
| eslint | 0 errors, 3 warnings | 0 errors, the same 3 | the same | 0 errors, the same 3 (M4's run found 2 new warnings in the R-GROUP-WALKS-LOAD runner; fixed in M5) |
| build | pass | pass | pass | pass |
| tsc | clean | clean | clean | clean |
| Unit tests, one file per process | 98 files, 749 pass | 99 files, 755 pass, 0 fail | 100 files, 758 pass, 0 fail | 100 files, 758 pass, 0 fail |
| Catalogue unit | 77 / 77 | 77 / 77 | 77 / 77 | 77 / 77 |
| Rule tests (production reads, read-only) | PASS 193 | PASS 196, FAIL 0, ERROR 0 | PASS 197, FAIL 0, ERROR 0 | PASS 197, FAIL 0, ERROR 0 |
| PGlite, every suite (PostGIS ones with PGlite 0.5.5) | 29 / 29 | 29 / 29 | 29 / 29 | 29 / 29 |

**New rules:** R-SUBJECT-MATCH, R-RANK-MIN, R-WALK-NO-REPEAT, R-GROUP-WALKS-LOAD. Each new test fails on base 38c9cee and passes on the branch (checked in a base worktree). `docs/catalogue/*.md` is regenerated. **No rule was rewritten.**

**Harness:**
- the review fixes' walk harness (`docs/v0.8/audit_scripts/review_fixes_preview`): the app's own WalkPage in headless Chromium 131 on the fixtures, plus The Chase's Post-16 model, built by the branch's own `buildTeacherModel` from `docs/v0.8/feedback_15nov/fixtures/teacher_137625_ks5_input.json` (captured read-only by the walk's own loader);
- a 503 case for the group dash;
- every picture was read as an image.

## Screenshots

In `docs/v0.8/feedback_a_screenshots/`, each beside Guy's (`*_guy_sNN.png`), at 1440 and 390 in Mid, and 1440 in Dark:

- T3 (s15);
- T4/T5 Results chart (s16, s17);
- T5 area (s18);
- T6 map and bars (s19, s20);
- T7 ranking (s21);
- T8 rank over time (s22);
- HO1 the error and Nexus's first screen (s24);
- Adm 3, walk 2's first and momentum screens.

**Not drawn:** the View as search (P1) and the group home's cards (HO3). The harness draws walks only; both are on the live list.

## Guy's commands

The branch `v0.8-feedback-a` is local and not pushed. Its worktree shares the repository with `~/dev/vicdata_public`, so the branch is already there.

**1. Migrations:** none this round. The Companies House number on the group search would need production's `school_groups_lookup` to return `companies_house_number`. That is the ingest repo's function, so it is not in this round; the SQL is below, for when Guy wants it:

```
drop function if exists public.school_groups_lookup(text[]);
create function public.school_groups_lookup(p_urns text[])
returns table (urn text, group_id text, group_type text, display_name text, official_name text, group_status text, source text, confidence text, joined_date date, last_seen date, gias_group_id text, companies_house_number text)
language sql stable security definer set search_path = public as $fn$
  select m.urn, g.group_id, g.type, g.display_name, g.name, g.status, m.source, m.confidence, m.joined_date, m.last_seen, g.gias_group_id, g.companies_house_number
  from (select distinct u from unnest(coalesce(p_urns, '{}'::text[])) u where u is not null) req
  join group_membership m on m.urn = req.u join groups g on g.group_id = m.group_id
  where m.left_date is null and m.confidence in ('confirmed', 'likely')
  order by m.urn, g.type, g.display_name, g.group_id
$fn$;
revoke all on function public.school_groups_lookup(text[]) from public;
grant execute on function public.school_groups_lookup(text[]) to anon;
notify pgrst, 'reload schema';
```

**2. Merge and push:**

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-feedback-a -m "0.8 feedback A: subjects matched across schools; head office walks and their errors; duplicate groups; the stall between walks; rank guards" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own.** If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge:**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish:** none this round. No dashboard config changed.

**6. Set fixed:** none this round. These notes aren't feedback items.

**7. Live check** on vicdata.co.uk:

- **The Chase, Teacher Post-16, Art and Design** (View as… → Teacher, The Chase):
  - Comparisons walk: the map lists The Chase as row 0, and Hanley Castle (Fine Art) 12 entries, Cleeve 30, Tewkesbury 6; hollow dots only where a school has no figure;
  - "Where do we rank?" reads "4th of 7 schools … Art and Design (all titles)";
  - Rank over time reads "Down: 1st of 9 in 2021/22, 4th of 7 in 2024/25";
  - Candidates walk, the last screen: four lines from 2021/22 = 100;
  - Results walk: the Chart draws Film Studies too, with "2023/24: 3 entries, too few to publish", and the Area chart draws the 10 nearest and Worcestershire;
  - the dashboard's Comparisons on Art and Design show the nearby schools' figures.
- **View as… → Head office, search "nexus":**
  - two rows, one per trust, each with its id (16125 and 16040);
  - open Nexus Multi Academy Trust: every walk loads;
  - the home's Our schools cards say "SMT home, read-only" and open each school's SMT (try Abbey School, a special school, on all four SMT pages and note any empty state that reads wrong);
  - Harris (3320) the same.
- **A failing walk:** if a head office walk still fails, the message now gives the route's words and an error code. Note them (and Render's log line `[group/dash] failed:`, if a 502): this is the one open item in A2.
- **Admissions, Leighton Park at 11+:** open walk 1, then walk 2 from its end screen. Walk 2's first screens should draw at once, and "Who is gaining" should follow, briefly saying "Working out your rivals' figures…" if the server is cold.
- **The Chase, SMT Academic** at Post-16: the Art and Design line's set figures now count the set's Fine Art and other titles.
