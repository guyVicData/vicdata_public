# VicData 0.6, snagging round 2: "Try it as…" on Account, and an Edit switch in the footer

Claude Code build prompt. **Start only after round 1 (`v0.6-snag1`) is merged into `main`.** Make a branch `v0.6-snag2` from `main`, commit once per item (A, B), with tsc, eslint and `next build` clean on each. Push the branch. **Don't merge.**

Ground rules as in 0.6:
- **Pixel-perfect:** use the existing components and tokens, and introduce no new colours.
- **Both themes.**
- **Log judgement calls** under "2026-10-04 — 0.6 snagging round 2" in `docs/OPEN_QUESTIONS.md`.
- **Database changes:** written as migrations, tested locally (PGlite), and left for Guy to apply, with the commands in the report.
- **Stop** for anything that would change who can see or edit existing data.

Both items are for **Guy only** (`is_platform_admin()`), to make testing and demoing simple. Nobody else sees any of it.

---

## A — "Try VicData as…" on `/account`

**Guy's words:** *"Currently I can search for and select a school, which is very helpful. I also need to select a role (Teacher / Admissions / SMT) and then have a link to their member homepage. The first time I go in as that role in a school I get the 4-step walkthroughs. This will be helpful for testing and demoing the site."*

### Find the school search first

The S3b fix 5 retired the old testing school switcher from `/account`, and the Platform screen has a school search with "Look at it as…". Find what Guy is using today and report it.

**Build on the 0.6 look-as mechanism** (`src/lib/look-as.ts`: the URL pair, `confirmLookAs`, `log_platform_action`). Don't add a second, parallel impersonation path. Platform's "Look at it as…" buttons should end up in this same mode.

### The card on `/account` (platform admin only)

A "Try VicData as…" card at the top of `/account`:

1. **School search:** the existing school search component, as on Platform. Search by name or URN, then pick one.
2. **Role chips:** Teacher · SMT · Admissions · School-Admin. Single select, with Teacher as the default. Use the role chip styling from People.
3. **Start fresh:** a checkbox, ticked by default the first time for each school + role. It clears this trial's walkthrough and saved state, so the 4-step walkthroughs run again.
4. **Primary button "Open their home page":** goes to that role's home page for that school (`/teacher`, with role homes), exactly as a member with only that role would land.
5. **Recently tried:** a list underneath of the last 5 school + role pairs. Each has a one-click "Open" and "Start fresh".

### What "trying as" means

**The member's experience:** Guy sees exactly what a new member with that one role at that school sees:
- that role's home page;
- the role switch hidden (one role);
- the 4-step walkthrough on first entry to GCSE and to Post-16;
- the key dashboards, Meetings and Recruitment as that role is offered them.

**It writes, unlike today's read-only look-as:** ticking subjects, preferences, notes, onboarding progress, personal dashboards and meetings all save, so a demo behaves like real use. Every one of those writes belongs to a **trial context** (Guy × school × role), never to:
- Guy's own state;
- the school's shared data (shared saved sets, teams, school dashboards).

You choose the least invasive way to key the trial context and log it. A new column, or a new table keyed by (profile, urn, role), is fine as a migration. It must not change existing rows or existing RLS.

**Invisible to the school.** A trial never appears in:
- the school's People or Teams lists;
- join requests;
- member counts, caps or tier logic;
- sign-in events (G13): record none for a trial.

**Renderer:** a trial always uses the new config renderer, whatever the global flag says, because role homes only exist there.

**Banner:** while trying, show a thin banner at the top of every page, using the existing look-as banner style:

> **Trying VicData as SMT at [School name]** · Change · Start fresh · Exit

- **Change** reopens the card.
- **Exit** returns Guy to his own account and state.

**Logging:** each start and each "Start fresh" calls `log_platform_action('try_as', urn, {role, fresh})`.

**Security:** the trial is honoured only after `is_platform_admin()` confirms it, as look-as is now. A hand-typed URL does nothing for anyone else. Add a PGlite test that a non-admin can't create or read trial-context rows.

### Checks

1. At Croydon College (130432), try as Teacher with Start fresh. The home page shows, and GCSE runs the 4-step walkthrough. Tick a subject, exit, and re-enter: the subject is still ticked and there's no walkthrough.
2. Same school as SMT: a different home page, and its own walkthrough state.
3. Start fresh: the walkthrough runs again.
4. The school's People list doesn't show Guy, and no sign-in event is written.
5. Guy's own `/teacher` is unchanged throughout.

Take screenshots of the card, the banner and an SMT home page in a trial.

---

## B — An Edit switch in the footer

**Guy's words:** *"A small Edit button (for me only, on VicData pages) in the footer next to Sources & methodology, so I can show or hide the edit menu bar at the top."*

**The switch:**
- A small **Edit** toggle in `src/components/Footer.tsx`, after "Sources & methodology", in the same text style. It's an on/off switch, not a link.
- Visible only to platform admins, and only on pages that show a VicData-owned dashboard:
  - `/teacher/[phase]`;
  - `/dashboards/[id]` where the owner is VicData.
- On other pages it isn't rendered.

**When it's on:**
- The page shows the editor's **edit bar** at the top for this dashboard, and the dashboard becomes editable in place. Use the same editor component and bar as `/dashboards/[id]/edit` (Editor board), opened on the same dashboard, with the current school and subject as the live preview.
- If editing in place on the Teacher page is too tangled, the switch may instead route to `/dashboards/[slug]/edit?return=<this page>`, with Exit coming back to the page. Log which you chose.

**When it's off:**
- The page has no super-admin chrome at all: no Edit link in the top bar, no edit bar. It looks exactly as a member sees it, ready for demos.

**Behaviour:**
- **Default:** off.
- **Remembered:** the setting is kept in the browser (localStorage, wrapped in try/catch), for Guy only.
- **During a trial** (item A), it starts off, and **Guy can switch it on from inside the trial.** This matters most: Guy's workflow is to review as a Teacher, SMT or Admissions member and fix things as he goes. So:
  - **The banner** gets an **Edit** item too: *Trying VicData as SMT at [school] · Edit · Change · Start fresh · Exit*. It does the same thing as the footer switch.
  - **Edits are made as Guy, never as the trial.** Drafts and publishes are written with his platform-admin identity to the VicData dashboard, which reaches every school once published. The trial's school and role are used only for the **live preview**, so he edits against exactly what that member sees: their school, their subject, and the views their role is offered.
  - **The banner says so while Edit is on:** *Editing the VicData dashboard for all schools · previewing as SMT at [school]*.
  - **Switching Edit off** returns to the same page in the trial: the same scroll position, the same open rows and the same focused subject. The trial's own state (ticked subjects, walkthrough progress) is untouched by editing.
  - **Drafts vs published:** while Edit is on, the page previews the draft. With Edit off, the trial shows the **published** version, as the member would. After Publish, the trial shows the change straight away (round 1's item 00). Add a small "Preview draft" toggle in the banner, so Guy can see an unpublished draft as the member would see it, without publishing. It shows for him only and never changes what members see.
  - **Only VicData-owned dashboards** can be edited from a trial. A trial's own personal dashboards and meetings are edited through their normal UI, as that member.
- **Draft state:** turning it off while a draft has unsaved changes follows the editor's existing Exit behaviour. Drafts autosave, so nothing is lost.

**Checks:**
- A non-admin never sees the switch. Check by role and by trial.
- **Inside a trial at Croydon College as Teacher:**
  1. Switch Edit on and rename a Column 1 panel.
  2. **Preview draft** shows it.
  3. With Edit off and nothing published, it's not shown.
  4. Publish, and the trial shows it.
  5. The trial's ticked subject and walkthrough progress are unchanged throughout.
  6. The draft and version rows have `created_by` set to Guy's profile, not a trial identity.
- Flag-off parity for members is unchanged.
- Take screenshots of the footer with the switch off and on, and of the Teacher page with the bar showing.

---

## Finish

Write `docs/v0.6/snag2_report_v1.md`, with:
- what you found about the existing school search;
- how the trial context is keyed, and the migration with its apply commands;
- screenshots;
- logged judgement calls;
- a click-through for Guy on live after the merge;
- the merge commands:

```
git checkout main && git pull && git merge --no-ff v0.6-snag2 -m "0.6 snagging round 2" && npm run build && git push
```

Render deploys from `main`.
