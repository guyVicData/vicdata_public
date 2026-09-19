# Special schools + zero-candidate filtering — build report

Covers the two follow-on filtering rules from `vicdata_phase3_role_based_views_hod_design_brief_v1.md` §3/§13: zero-candidate school exclusion, and the special-schools sector-visibility default.

## Note on how this round was dispatched

The Claude Code prompt for this round referenced §3 of the role-based-views/HoD design brief, but that brief had only ever been written to the Project — it was never actually pushed to either repo's `docs/` folder. Claude Code correctly caught this (confirmed both repos 0 commits behind origin, confirmed nothing in either `docs/` or `docs/archive/` mentions role-based views, HoD design, or Head of Department) and proceeded on the two tasks anyway, since both were fully specified directly in the prompt it was given. It also independently re-derived the brief's own special-schools coverage figures from the real database as a cross-check — 1,498 open special schools, KS4 1,046, KS2 360, KS5 3 — and they matched exactly, confirming it was working from the same real data the brief itself was built on. The brief has now been pushed to both repos' `docs/` folders so this reference gap won't recur.

## Task 1 — zero-candidate exclusion

The brief's own working hypothesis (hospital schools as the source of zero-candidate rows) was checked directly, not assumed — and it was wrong, which mattered. Hospital schools, PRUs, and alternative provision have **zero** `academic_headline_snapshot` rows at all, across all 329 schools of those four establishment types — so they could never have been the mechanism producing a zero-candidate row in the first place.

The real population: 53 real KS4 zero-candidate rows, plus 70 more KS4 rows with a *missing* (not zero) candidate count — both looked similar on the surface but needed different handling:

| Kind | n | Has `attainment8_average`? |
|---|---|---|
| Measure absent | 70 | All 70 do |
| Real zero | 53 | None do |

The 70 "measure absent" rows are newly-opened free schools and academies that have a key-stage row but haven't reached Year 11 yet — they correctly carry no candidate count *and* no headline measure, and would have been wrongly caught by a naive "zero or null candidates" rule. None of the 53 genuine zero-candidate rows belong to a hospital school. KS5 has no real zero-candidate rows at all (0 of 2,979). KS2 was deliberately left untouched — legitimate KS2 measures are sometimes genuinely zero, and a blanket zero-based rule there would have been a real, serious regression.

**The actual rule implemented**: "has a real candidate count, or a real headline measure" — not "has a nonzero candidate count." Implemented once, in `stagesPresent()`, which is the single chokepoint already shared by the comparator-widen route, the dashboard card, and the data view — so the fix applies everywhere a school list gets built, not just in one surface.

Verified on real schools: Ark Soane and [a second real zero-candidate school] (candidates = 0) now correctly resolve to no stages and drop out of every list. Haverstock (146 candidates) and Capital City are unchanged. A real special school with just 7 KS4 candidates is correctly unchanged too — proving the rule catches true zero-candidate rows without over-triggering on small-but-real cohorts. Two more real schools with no `pupil_count` field but real Attainment 8 scores (35.0 and 51.x) were checked and correctly kept, confirming the "or a real headline measure" half of the rule is pulling real weight, not redundant.

## Task 2 — special-schools sector-visibility default: already built, no work needed

This was already implemented and live before this round — confirmed directly against the real migrations rather than trusted from the brief's own description: `20260930120000_nearest_schools_special_and_th...` and `20261001120000_comparator_candidates_special...` already carry a real `is_special` check, including the three "leak types" named in the brief (Academy special converter, Academy special, Free schools special) and the alternative-provision exclusion.

Verified live, not just read in the migration:

| Viewing school | Special schools among 30 candidates |
|---|---|
| Harmood (special) | 29 ✓ |
| Haverstock (mainstream) | 0 ✓ |

The opt-in override holds too — `search_schools` stays unrestricted, so a mainstream user can still add a special school to their comparator set by hand; the sector-visibility default doesn't remove that capability.

Deliberately not rebuilt or "improved" — it already matches the brief's spec as written.

## A dating note worth keeping in mind

The repo's own history (migrations, review reports) runs to 2026-10-03, ahead of this session's own date of 2026-09-18/19. Not a problem — it just means Task 2 shipped in a session later than the one that originally wrote the brief, which is presumably why the brief's own open-items list still described it as outstanding. Worth remembering when reading "open items" sections generally: they can lag real shipped state if a later session did the work without looping back to update the brief that first raised it.

## Status

Both tasks now resolved. `vicdata_phase3_role_based_views_hod_design_brief_v1.md` §13 has been updated to mark this item done, with a pointer to this build report.
