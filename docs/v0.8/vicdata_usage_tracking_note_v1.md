# VicData — Usage tracking: a note for the roadmap

Written 13 Oct 2026, from Guy: *"the system should track usage — very helpful for schools to see how many of their staff, other schools' staff and parents looked at their data. That will add a lot of value down the line."*

Not scheduled yet. Recorded so that the builds between now and launch **start collecting** — counts can't be recovered for months nobody logged.

## What a school would see

A "Who's looking at us" view (SMT home, and later the group view), by month:

- **Our staff:** how many of our members used VicData, by role (SMT, Teacher, Admissions), and which dashboards and views they opened.
- **Other schools' staff:** how many members at other schools looked at our school (our public page, or us as a rival, a comparison-set member or a feeder), counted by school type and area: "34 staff at 12 schools, mostly secondaries within 10 miles".
- **Parents and the public:** visits to our public school page, from where (search, direct, another school's page), and what they looked at (results, shape, admissions).
- **Trend:** month by month, so a school can see interest rising at admissions time.

## Principles

- **Counts, never names, across schools.** A school sees *how many* staff elsewhere looked at it, by type and area, **never which schools or which people**. Showing "St X's head looked at you" would be a privacy breach and would stop members using the platform. Inside one school, the School-Admin may see usage by role; whether by named person is a decision for later (staff-monitoring sensitivity).
- **Small numbers suppressed:** fewer than 5 viewers in a cell shows "fewer than 5", so a single rival can't be identified.
- **The public page:** no personal data; cookieless, aggregate page-view counting (privacy-friendly analytics), with the privacy notice updated. No tracking across sites.
- **Members:** usage is logged against the membership and role, for product use and the school's own reports; said plainly in the terms and the privacy notice before launch.
- **Our own use:** the same log tells us which views earn their place (product decisions), and is evidence for renewals ("your staff opened VicData 420 times this year").

## What to build first (small, early)

1. **An event log** in the app database: who (membership id and role, or anonymous for public), which school's data, which product and view, when. Write-only from the server, never readable by anon; RLS so a school reads only aggregates about itself.
2. **Public page counts:** a server-side counter per school page per day (no cookies).
3. **Later:** the "Who's looking at us" view, the monthly aggregates, suppression, and the group-level roll-up.

Fits after the SMT and group rounds; the event log (1–2) is small enough to add to any round before launch so data starts accruing for January.
