Small, scoped follow-up to the top-nav round (d3b5db3) -- not the sitewide nav rework, which
Guy's deferred to a later project phase once the members' views are settled, and not a Sets
link either: Sets is going to live inside the dashboard itself (the common school-select/
save-a-set interface), so it doesn't need a nav entry at this stage. This is just the one
concrete gap the top-nav round left behind, confirmed by reading the real code:

src/app/teacher/[phase]/page.tsx, the `if (error || !phase)` branch (~line 363), renders a
bare <main> with just the error text and a "Back" link to /teacher -- nothing else. That's the
ONLY thing on screen, because src/components/NavBar.tsx hides itself unconditionally on
/teacher/(ks2|ks4|ks5) by route regex regardless of whether this page is erroring, and the new
TeacherNav (src/components/teacher/TeacherNav.tsx) only renders further down, past this same
error check, once there's valid phase data. So on this one screen there is currently no
Account and no Login link at all.

This is a real, reachable state, not a hypothetical: the page's own setError calls include
"Sign in to see this dashboard." (no session), "Unknown phase.", "Teacher view is available to
verified school staff." (no membership), and "Could not load this school's data. Try again."
(fetch failure). The first of those means a signed-out visitor hitting this route directly
gets a screen with literally no way to sign in -- just "Back" to /teacher, which likely just
repeats the same dead end for them.

Fix only this one branch. Give it a minimal fallback so nobody is stranded: if there's no
session, show a way to sign in (a Login link is enough, no need to rebuild any nav chrome for
this); either way, keep the existing "Back" link. Reuse whatever auth-state signal the page's
own effect already computes if there is one convenient to reach at this point in the render,
rather than adding a second, duplicate auth check -- but a small direct check is fine if that's
cleaner than threading extra state through. Don't touch NavBar.tsx's hiding logic, don't touch
TeacherNav, don't add anything for the other three setError cases (they're all reachable via
Back regardless of session state, so they're fine as they are). Don't add a Sets link anywhere
-- see above.

Verify: hit this route signed out and confirm there's now a visible way to sign in from the
error screen itself, not just "Back". Confirm the other three error strings still render
exactly as before (message + Back, nothing added). Confirm no other file changed.

Commit and push, vicdata_public only. This is small enough that a one-line note in the commit
message covering what was fixed and why is enough -- no separate build report needed.
