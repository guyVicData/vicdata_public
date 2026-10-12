# VicData — School groups: data plan

Written 12 Oct 2026. This plan sets out where VicData's group data comes from, how it is stored, and the order it is built in, ahead of the school group view. It covers state groups (MATs, federations, sponsors and the rest) and independent groups (Cognita, Dukes, Inspired, GDST and the many smaller ones). Schools will also be able to make their own groups.

## 1. Principles

1. **Every group and every membership records where it came from.** Sources are GIAS, Companies House, the Charity Commission, Club ISS (curated) or the school itself. Each source has its own confidence, and the views label each one honestly.
2. **The official sources come first; curation sits on top.** Club ISS names and tidies groups, and fills gaps the official sources can't see. It never overwrites what GIAS says about a state group.
3. **Membership changes over time.** Schools join and leave trusts, and independent schools are bought and sold. We store dates when the source has them. When it doesn't, we store when we last saw the membership, and **never invent a join date.**
4. **A school's own grouping is private to that school** (app database, school-scoped), like Admissions lists. It never becomes "data about the group" for anyone else.
5. **No pupil-level data.** Groups are organisations, and everything here is public or the school's own choice.

## 2. What we hold now (production, checked 12 Oct)

| | Now |
|---|---|
| Source | Two columns of the main GIAS file: `Trusts (code/name)` and `Federations (code/name)` (`ingest/sources/gias.py`) |
| `groups` | 2,296 labelled `MAT` and 491 `federation` |
| `group_membership` | 12,506 + 1,163 current rows; **`joined_date` and `left_date` are blank everywhere** (that file has no dates) |
| Mislabelled | **1,070 of the 2,296 "MATs" have one school.** These are almost certainly single-academy trusts, which come through the same `Trusts` column. |
| Not ingested | Sponsors (`SchoolSponsorFlag`, `SchoolSponsors`, ruled out of scope on 2026-07-19), umbrella trusts, foundation trusts, and the group details (Companies House number, address, incorporation date) |
| Independents | Nothing. GIAS has no group for an independent school. |
| Used by the app | Nowhere yet |

**Leaving membership:** a school that drops out of a trust in a later GIAS pull keeps its old membership row, because nothing records the departure. This is a known limitation on the `gias` source row. Stage 1 fixes it.

## 3. The group types, and where each comes from

| Type | What it is | Source | Dates |
|---|---|---|---|
| **Multi-academy trust (MAT)** | A trust running several academies; the main state "chain". | GIAS group records | Joined date per academy; trust incorporation date |
| **Single-academy trust (SAT)** | One academy as its own trust: often a converter grammar or a standalone. Not really a group, but it tells a standalone academy apart from a chain school, and shows when it joins a MAT. | GIAS group records | Incorporation date |
| **Federation** | Maintained schools sharing one governing body. | GIAS group records | Joined date |
| **School sponsor** | The body that sponsored a school into academy status: a MAT, a university, a company, a charity, a diocese, or **an independent school** (for example Eton, Wellington or Brighton College). This is where state and independent schools link up. | GIAS group records, plus the sponsor flag on the establishment | Joined date |
| **Umbrella trust** | A looser collaboration, often church schools under a diocesan board. | GIAS group records | Joined date |
| **Foundation trust** | A charitable trust holding maintained foundation schools. Loose. | GIAS group records | Joined date |
| **Independent group: company** | Several independent schools owned through a group company (Cognita, Dukes, Inspired, Globeducate, Alpha Plus, Bellevue and many smaller groups). Each school is often its own subsidiary company. | GIAS proprietor (to check), Companies House (control), Club ISS | Companies House control-start dates |
| **Independent group: charity** | A charitable foundation running several schools (GDST, United Learning's independent schools, Woodard, Harpur, Haberdashers' and others). | Charity Commission, GIAS proprietor, Club ISS | Charity registration; date the school joined (from Club ISS or a link where known) |
| **Independent group: other** | Families of schools under one name or owner, not visible as a company or charity group. | Club ISS | Last checked |
| **Self-declared** (school-made) | A school's own cluster: a local partnership, a set of schools it compares itself with, or a group we don't know about. | The school (app database) | Created and changed |

**GIAS group records** are GIAS's separate group downloads (all group records, and group-to-establishment links), as distinct from the trust and federation columns of the main establishment file.
- GIAS's group pages show the group type, a UID and group ID, the **Companies House number**, the address, an "incorporated on" date, and a **joined date for each academy**. For example, [Swale Academies Trust](https://get-information-schools.service.gov.uk/Groups/Group/Details/4885).
- Stage 1 starts by **checking the exact bulk file names and headers** against those pages, before any schema is fixed.

## 4. Independent groups: finding them

No single free list covers them. LaingBuisson's paid market report covers ownership but isn't redistributable. The trade press (Education Investor) and Wikipedia name the big groups but go out of date. So we combine four sources, from most to least official, and record which one found each school:

1. **The GIAS proprietor.** Each independent school has a registered proprietor, the legal owner. I believe the full GIAS file carries the proprietor's name (`PropsName` or similar), but the current ingest drops it. **To check in stage 1.** Schools that share a proprietor, after normalising the name (case, "Ltd"/"Limited", "The"), form a first set of candidate clusters.
2. **Companies House.**
   - **Finding company numbers:** look up each independent proprietor by name to get its company number. Where GIAS gives a number (it does for trusts), use that.
   - **Rolling up to the parent:** follow "persons with significant control" (PSC) and the officers to find the controlling company. Several Cognita school companies, say, all roll up to one Cognita holding company.
   - **Access:** this uses Companies House's free API, which needs a key Guy registers. It is fetched through the ingest repo and never from the client. Bulk PSC snapshots are also published as an alternative.
   - **Stopping point:** the roll-up stops at the first UK company that controls several schools. Offshore and private-equity owners above that are recorded as `ultimate_owner_note` text, not as a separate group.
3. **The Charity Commission register.** For charitable proprietors (GDST, Woodard, United Church Schools Trust and others), the charity number and the charity's schools, or the linked charities where schools are separate charities. It is free to download in bulk.
4. **Club ISS (curated).** Guy's group lists with URNs. They:
   - set the **display name** ("Cognita", not "Cognita Schools Ltd");
   - merge clusters the official sources split (a group operating through several unconnected companies);
   - add groups no official source shows.
   
   Club ISS is the authority on names and membership for independent groups. Where Club ISS and Companies House disagree, the difference is listed for Guy, never silently resolved.

**Every independent membership carries:**
- `source` (`gias_proprietor`, `companies_house`, `charity_commission`, `club_iss`);
- `confidence` (`confirmed` when two sources agree or Club ISS states it; `likely` from one official source; `candidate` from a name match only);
- `last_checked`.

The views show `confirmed` and `likely`. `candidate` is only for Guy's review screen.

## 5. Schema (production, ingest repo)

Extend the existing tables rather than adding parallel ones.

**`groups`, add:**
- `source`;
- `type`, from a controlled vocabulary: `mat`, `sat`, `federation`, `sponsor`, `umbrella_trust`, `foundation_trust`, `independent_company`, `independent_charity`, `independent_other`. Lower case; migrate the existing `MAT` and `federation` values;
- `gias_uid`;
- `companies_house_number`;
- `charity_number`;
- `display_name`, from Club ISS when present, otherwise the official name;
- `opened_date`, from GIAS "incorporated on" or the company's incorporation date;
- `closed_date`;
- `parent_group_id` (nullable): a subsidiary company under its parent. The view rolls schools up to the top;
- `ultimate_owner_note`;
- `website`.

**`group_membership`, add:**
- `source`;
- `confidence`;
- `first_seen`;
- `last_seen`, set on each ingest that sees the membership. A membership not seen in the latest pull of its source gets `left_date = that pull's date` and `left_date_basis = 'not_seen'`, as distinct from `left_date_basis = 'source'` when the source gives a real date.

**Keys:** a school can belong to several groups of different types at once (a MAT and a sponsor, say). The primary key stays `(urn, group_id, joined_date)`, so a school that leaves and rejoins gets two rows.

**Reading:** add a security-definer lookup granted to anon, in the style of `school_cohort_flow_lookup`, returning a school's current groups and a group's current schools. No client reads the tables directly.

**School-made groups go in the app database, not production:**
- `school_groups`: id, owning school account, name, created by, created at;
- `school_group_members`: URNs;
- **RLS:** Admissions-style. The owning school's School-Admin, or any role the School-Admin allows, writes; school members read; sharing through the existing Assign / share.

Self-declared groups never feed the official tables.

## 6. Stages

Each stage is one Claude Code round, with the usual rules:
- migrations are written and tested, never applied by Claude Code; Guy applies them, and commands are `&&` chains with the project-ref check and no `exit`;
- a read-only dry run with counts comes first;
- every stage ends with a report and logged calls.

**Stage 1: GIAS group records, done properly.** Cheap and official, and it fixes what we have.
- **Inspect first:** the bulk group downloads' names and headers, and the main file's sponsor and proprietor columns (`PropsName` or whatever it is called).
- **Ingest:**
  - every group type, with UID, Companies House number, address, incorporation date and status;
  - every link, with its joined date;
  - the sponsor links.
- **Fix the existing data:**
  - the 1,070 single-school "MATs" become `sat` where GIAS says so;
  - the existing memberships are reconciled to the dated links;
  - `last_seen` and the `not_seen` leaving rule come in.
- **Proprietor names:** if they're in the file, store them on `school_entities` as `proprietor_name`, with no grouping yet.
- **Report:**
  - counts by type;
  - the largest MATs, with school counts checked against GIAS's group pages;
  - schools in more than one group;
  - independents that sponsor academies.

**Stage 2: Club ISS groups.**
- **Guy exports** the Club ISS groups as CSV (group, URN, plus type and website if held), or points us to where the data lives.
- **Match** URNs to `school_entities`. List closed or unknown URNs and URNs that have merged (via `school_lineage`); none are dropped silently.
- **Load** as `independent_*` groups with `source = club_iss`, `confidence = confirmed`.
- **Report:** groups, schools, unmatched URNs, and schools Club ISS puts in two groups.

**Stage 3: Proprietors and Companies House.**
- **Proprietor clusters:** shared, normalised proprietor names become candidate clusters.
- **Companies House:**
  - look up each independent proprietor (name to company number, with a confidence score);
  - fetch PSC and officers, roll up to the parent, and cache the raw responses;
  - **rate-limit, with timeouts and progress logs.**
- **Compare with Club ISS,** in three lists:
  - **agreed** (becomes `confirmed`);
  - **Companies House only:** new groups or new member schools, to `likely` after Guy reviews;
  - **Club ISS only.**
- **Guy's review:** a simple review page in the admin area, or a CSV, to accept or reject candidates. Accepted ones go into Club ISS as well, so that stays the curated master.

**Stage 4: The Charity Commission.**
- Match charitable proprietors to the register.
- Pick up charity groups (GDST, Woodard, UCST and others) and their schools.
- Same review flow as stage 3.

**Stage 5: Self-declared groups (app).**
- The tables and RLS from §5.
- A "Make a group" flow: name it, then add schools by search, map or list, in the comparison-set chooser's style.
- It becomes a comparison set everywhere a custom set works: Teacher, Admissions rivals, and the group view.

**Later: the refresh.**
- GIAS daily or weekly through the source watcher;
- Companies House monthly;
- the Charity Commission monthly;
- Club ISS whenever Guy updates it.

Each refresh updates `last_seen`, and leavings are dated.

## 7. What the group view can then show

- **For a group:**
  - its schools on a map;
  - size by phase (XS–XL);
  - combined roll and trend;
  - results (headline, subject, Post-16 value added where published);
  - each school's rank within the group and nationally;
  - who joined and left, and when.
- **For a school:** its groups (a MAT and its sponsor, say, or its independent group), and how it sits within each.
- **Across groups:**
  - group against group (by size, results or growth);
  - for independents, the groups' share of a region's independent places.

**Honesty labels:** each figure says where the group came from ("GIAS", "Companies House", "Club ISS", "your school's group"). "Left" carries "date not published; last seen [date]" when the date is inferred.

## 8. Questions for Guy

1. **Club ISS export:** can you send the groups as CSV (group name, URN, plus type and website if you have them)? Or say where they live and I'll pull them out.
2. **Companies House API key:** you'd register it (free). It goes in the ingest repo's `.env` only.
3. **Sponsors:** show "sponsored by Eton College" on the state academy's page and on Eton's page? It's public in GIAS, and interesting for your sector.
4. **Parent groups:** should the group view show the operating group ("Cognita UK") or the ultimate owner? I suggest the operating group, with the owner as a note.
5. **Self-declared groups:** should a school be able to share its group with another school in the group (a partnership that all members see), or keep it private only? I suggest private first, shared later.
