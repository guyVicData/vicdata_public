Small, scoped follow-up to the top-nav round (d3b5db3) -- closes out the last open item from
that round's build report (§N3). N2 (label toggle saved to every onboarded phase) needs no
change; Guy's confirmed that's the right behaviour as built.

The gap is mine, not a wrong call on your part: the brief described TeacherNav's contents as
a left-to-right list (wordmark, Home, divider, switcher, label toggle, divider, Account, theme)
without saying how the row should actually distribute that space, so TeacherNav.tsx built it
as one flowing row, `className="flex flex-wrap items-center gap-3.5 print:hidden"` -- the
wordmark sits right next to Home with just a gap, everything left-packed.

The wireframe (Redesign.dc.html) actually has this as `justify-content: space-between` between
two groups: the VicData wordmark alone on the left, and everything else -- Home, divider,
phase switcher + label toggle, divider, Account + theme toggle -- as ONE cluster pinned to the
right edge. Match that: wrap the Home-through-theme-toggle content in its own flex container
(keep the existing internal gap-3.5/gap-2.5 structure and both Dividers exactly as they are),
make that wrapper the nav's second child alongside the VicData Link, and add `justify-between`
(or equivalent) to the outer `<nav>` so the two children sit at opposite edges rather than
bunched together. Purely a wrapping/class change -- no component, prop, or logic changes, and
nothing in PhaseSwitcher, AccountMenu, or ThemeToggle should need to move.

Verify: on a wide viewport, VicData sits alone at the far left and the Home/switcher/Account/
theme cluster sits together at the far right, with the gap between them growing to fill the
row rather than everything sitting shoulder-to-shoulder near the left edge. Confirm the wrap
behaviour (flex-wrap) at narrower widths still looks reasonable -- it doesn't need to be
perfect at phone width, that's NavPhone's own separate design, just don't let anything overlap
or clip on a normal laptop-width browser window. Confirm no other file changed.

Commit and push, vicdata_public only. Small enough that a one-line commit message is fine, no
build report needed.
