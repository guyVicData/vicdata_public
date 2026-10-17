# View as screenshots (0.8)

Screenshots for `docs/v0.8/view_as_report_v1.md`, taken 17 Oct 2026 from branch `v0.8-view-as`.

## How they were made

You can't browse the live app locally (Basic Auth and Supabase sign-in), so the branch's own components
were bundled with esbuild and rendered in headless Chrome at 1440 wide (CDP, a fresh profile for each
shot). The CSS is the branch's own `next build` output (`.next/static/chunks/*.css`). Supabase is a
read-only fake (`window.__DB` tables, `window.__RPC` answers), and the `/api/*` routes answer from
fixtures. No database was read or written for these shots: the fixtures are copies of ones captured
read-only in earlier rounds (SMT and group parity 16 Oct, Admissions year parity 17 Oct).

The harnesses are the existing previews with small changes: `docs/v0.8/audit_scripts/smt_preview`,
`docs/v0.8/audit_scripts/groups_r2_preview` (the r3 dashboard variant) and
`docs/v0.7/audit_scripts/admissions_preview`. The changed files are in
`docs/v0.8/audit_scripts/view_as_preview/` (they end in .txt, so nothing builds). The changes:

- each harness draws the page and then `Footer`, as `app/layout.tsx` does;
- a stub for `/api/view-as/caller` (`{urn, name, accountId, catchmentKm: null, roles, access: "viewAs", readOnly: true}`);
- the `vicdata_view_as` cookie is set before the bundle runs: `{u, r, n}` for a school, `{r: "head_office", g, n}` for a group;
- `is_platform_admin` is true for the admin and View as shots and false for the member shots;
- `platform_group_accounts_overview` returns Harris Federation and Dukes Education, and `trial_contexts` returns two recent View as rows;
- `usePathname` reads `window.__PATH`, so each page gets its own route;
- `?renderer=config` turns on the config renderer for the member shots, the same switch as `NEXT_PUBLIC_DASHBOARD_RENDERER=config`;
- `shot.mjs` takes the full page with `captureBeyondViewport` instead of making the window taller. With a taller window, `#teacher-root`'s `min-h-screen` grew too and pushed the footer out of the picture.

| File | Shows | Data |
|---|---|---|
| `01_view_as_smt_leighton_park_overview_dark.png` | View as SMT at Leighton Park (110110), SMT Overview. Banner: "Viewing as SMT · Leighton Park School · Edit · Preview draft · Change · Back to me". Footer: "Sources & methodology  Edit". | Real fixture for 110110 (SMT parity capture) |
| `01b_view_as_smt_leighton_park_overview_light.png` | The same page in the light theme | Same |
| `02_view_as_admissions_the_chase_pipelines_dark.png` | View as Admissions, Pipelines: the banner with Edit and Preview draft, and Edit in the footer | Real fixture, but for **The Chase (137625)**, not Leighton Park. No Admissions fixture for 110110 exists, and capturing one would mean new database reads. |
| `03a_view_as_head_office_harris_group_home_dark.png` | View as head office of Harris Federation, the group home. Banner: "Viewing as Head office · Harris Federation · View as: read-only · Change · Back to me". The nav pill reads "Head office · Harris Federation". | Groups r2/r3 fixture (Harris) |
| `03b_view_as_head_office_dukes_group_overview_dark.png` | View as head office of Dukes Education, the group Overview dashboard, with the same banner | Groups fixture (Dukes). Its own label, "Fixture data: the ingest's dry run, not yet promoted", is part of the fixture. |
| `04_view_as_teacher_on_smt_wrong_role_dark.png` | View as Teacher at Leighton Park on the SMT Overview route: "You're viewing Leighton Park School as Teacher. SMT dashboards are for SMT and the School-Admin." and "Switch to SMT". The nav pill reads "Teacher · Leighton Park School". | Real 110110 fixture (nothing on this page uses it) |
| `05_member_teacher_admissions_nav_role_switch_dark.png` | A non-admin member who holds Teacher and Admissions at Leighton Park, on the /teacher home: the nav's role switch (Teacher / Admissions) | Stubbed membership row (`roles: ["teacher","admissions"]`, school 110110) |
| `06a_member_smt_only_nav_and_footer_dark.png` | A non-admin SMT-only member, SMT Overview: no banner, no role switch, and a footer with only "Sources & methodology" (no Edit) | Real 110110 fixture, with a stubbed SMT membership |
| `06b_member_smt_only_account_menu_dark.png` | The same member with the account menu open: only "Your Account" and "Log Out", with no "View as…" and no "Platform" | Same |
| `07a_admin_account_menu_view_as_dark.png` | A platform admin who isn't in View as, with the account menu open: "Your Account · Platform · View as… · Log Out". Behind it, the SMT route's "To see a school's SMT dashboards, use View as in your account menu." | Stubbed (admin with a Teacher membership) |
| `07b_admin_view_as_panel_head_office_dark.png` | The View as panel opened by scripted clicks (Account, then View as…, then the Head office chip). It shows the role chips Teacher, SMT, Admissions, School-Admin and Head office, with Head office on. Under them are Harris Federation and Dukes Education, "Open its head-office home" (disabled until a group is picked) and "Recently viewed as". | Stubbed group list and recent rows |

## Seen while shooting (for the report)

- The wrong-role screen (04) has **no View as banner**. `SmtDashboard` draws `ViewAsWrongRole` in its
  not-ready branch, and that branch has no `ViewAsBanner`, so "Change" and "Back to me" aren't on the
  page. The only ways off it are "Switch to SMT" and the account menu. This may be on purpose, but it
  is worth a look.
- In the head office View as, the group home's heading is "Head office" with "Harris Federation · head
  office" under it (03a). Neither group page shows Edit, which matches the banner's design: head office
  gets "View as: read-only".

## A check by eye for Guy (not shot)

- View as Admissions **at Leighton Park**: there's no 110110 Admissions fixture, so shot 02 uses The
  Chase. On the live site, check the banner and the footer's Edit on `/teacher/admissions` while
  viewing Leighton Park as Admissions.
- Everything above, live, behind the real auth: whether Edit appears depends on the real
  `is_platform_admin` and on the dashboard registering. The harness stubs both.
- Clicking "Switch to SMT", "Change", "Back to me" and "Open its head-office home". Each one writes a
  cookie or a trial row and reloads the page, so none of them were clicked here.
- Phone widths. Only 1440 was shot.
