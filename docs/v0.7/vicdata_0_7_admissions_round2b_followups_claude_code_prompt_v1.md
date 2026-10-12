# VicData 0.7 — Admissions round 2b: the three follow-ups Guy approved

Claude Code build prompt, written 12 Oct 2026. It's a small round after round 2 (`docs/v0.7/admissions_r2_report_v1.md`, §8). Guy approved all three items.

## Ground rules (as round 2)

- **Branch `v0.7-admissions-r2b` from `main`.** Run tsc, eslint, build, unit tests, rule tests, round 1's RLS test (84 checks, plus the new ones) and the rebuilt parity harness (`docs/v0.7/audit_scripts/parity_harness/`).
- **Never put a server key in client code.** Stage files by name. Leave Guy's files alone. Use timeouts and progress logs.
- **The migration is written and tested, not applied.** Apply commands are `&&` chains with the project-ref check (`lnhulykjlxmoneappnsp`) and **no `exit`**. The app must work before and after it's applied.
- **Merge and push if clean.** If a push fails, give Guy the command (he pushes over HTTPS).

## E1 — School-Admin override on lists (approved; RLS change)

- **Migration** (app database): on the write policies of `admissions_lists` and `admissions_entry_points`, add `or public.is_school_admin_or_holder(school_account_id)`, keeping the lead's existing rights.
- **Audit trigger:** add an audit trigger on writes to both tables. When the writer isn't the lead, it records `admissions_lists_override` / `admissions_entry_points_override` in `platform_audit_log`, with who and what changed.
- **UI:**
  - setup and the list editors open for a School-Admin without the flag;
  - "last changed by" reads **"changed by School-Admin [name], [date]"** for an override;
  - People → Admissions history lists override rows.
- **Tests:** extend the RLS test to cover:
  - the School-Admin writing and the audit row being written;
  - the lead unaffected;
  - an Admissions member without the flag still unable to write;
  - SMT still unable to write (SMT shares only);
  - no access across schools.
  
  Report the new pass count.

## E2 — "Subject explorer with these rivals": Teacher reads `?set=` (option 1)

- **Teacher subject dashboard:** when the address carries `set=<urn>,<urn>,…` (at most 30 URNs, each validated as a 6-digit URN, invalid ones ignored), Comparisons opens on that list as a **temporary custom set** called "Admissions rivals". It uses the existing custom-set path: same ranking, figures and views.
  - Nothing is saved.
  - Changing the set in the chooser drops it.
  - Reloading keeps it while the parameter is in the address.
- **Admissions links:** Strengths and weaknesses links pass the rivals, the stage and the subject or area. The wording becomes "Open in the subject explorer with these rivals".
- **Parity, the key check:** with **no** `set` parameter, Teacher is **byte-identical** to `main` across the full harness. Add screenshots with the parameter for The Chase GCSE History and King's Worcester A level Maths.

## E3 — The undercount note on past LA and England pool trends

- Guy will backfill `age_profile_aggregates` for 2019–2024 with round 2's §6 command.
- Make sure the pool-trend panel's note says, for past years: *"Earlier years count only schools still open, so they slightly undercount."* Put it in `ADMISSIONS_NOTES`. It shows only when a past year is drawn.
- If the panel already handles more years, this is wording only.

## Report

Write `docs/v0.7/admissions_r2b_report_v1.md`, with:

- E1's migration and apply command, and the RLS pass count;
- E2's parity result and screenshots;
- E3's wording;
- a short click-through.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.7-admissions-r2b -m "0.7 Admissions 2b: School-Admin override, rivals into subject explorer, undercount note" && npm run build && git push
```
