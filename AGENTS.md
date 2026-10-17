<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Looking at VicData as a school or head office (scripts and harnesses)

The scripted, read-only way in is the **peek**: add `?lookAs=…&as=…&peek=1` to a page's address while signed in as a **platform admin**. The page's own API calls carry it (the `x-vicdata-peek` header, `src/lib/view-as.ts`), and the server decides the caller from it through the one caller helper (`src/lib/view-as-server.ts`, `resolveCaller`): honoured only after it confirms a platform admin, always read-only, never logged as usage. For anyone else it does nothing. It never sets the View as cookie, so it can't leak into another tab.

| Product | Example |
|---|---|
| Teacher (GCSE) | `/teacher/ks4?lookAs=110110&as=teacher&peek=1` |
| Teacher (Post-16) | `/teacher/ks5?lookAs=110110&as=teacher&peek=1` |
| SMT | `/teacher/smt?lookAs=110110&as=smt&peek=1` (also `/teacher/smt/academic`, `/pupils`, `/context`) |
| Admissions | `/teacher/admissions?lookAs=110110&as=admissions&peek=1` |
| School-Admin | `/teacher?lookAs=110110&as=school_admin&peek=1` |
| Head office | `/teacher/group?lookAs={group account id}&as=head_office&peek=1`; a member school's SMT as that head office: `/teacher/smt?headOffice={urn}&lookAs={group account id}&as=head_office&peek=1` |

`as` is one of `teacher`, `smt`, `admissions`, `school_admin`, `head_office`. A role the page isn't for gets what that role would get (a Teacher peek at SMT is refused). Group account ids are on Platform → Group accounts.

People use **View as** instead: the account menu's "View as…" (platform admins only), which sets one cookie (`vicdata_view_as`) for a school and role, or a head office, until Back to me.
