// VicData 0.8 nav consistency (Guy, 21 Nov; R-NAV-ONE): one navigation, the shell's TeacherNav, on every page.
// Every page route (and every bare signed-out route) is in this table, so a new page has to say how it gets the nav:
//   own   the page draws TeacherNav itself (in every state), with its own phase, labels and theme;
//   host  the root layout's NavBar draws the same TeacherNav above the page (no phase, the person's theme);
//   bare  the signed-out frame only (front door part 3: the landing page, sign-in, the password pages and the
//         auth hand-offs): no nav and no footer. BareRoutes.tsx's BARE_PATHS is the same list (the test holds
//         the two equal);
//   walk  a walkthrough: its own header band is the whole top of the page, as designed (walk_*.png), with the
//         close button home and Send feedback in it; no nav above it.
// The public school pages aren't listed: next.config.ts redirects them before they render (the private beta;
// R-NO-PUBLIC-SCHOOL-LINKS), so they never draw a nav. The test leaves out exactly what that redirect catches.
// The table is plain data (no React), so the rule test and NavBar read the same thing.
export type NavMode = "own" | "host" | "walk" | "bare";

export const NAV_ROUTES: Record<string, NavMode> = {
  "/": "bare",
  "/auth/callback": "bare",
  "/auth/confirm": "bare",
  "/account": "host",
  "/dashboards": "own",
  "/dashboards/[id]": "own",
  "/dashboards/[id]/edit": "host",
  "/dashboards/new": "host",
  "/join": "host",
  "/join/[urn]": "host",
  "/forgot-password": "bare",
  "/login": "bare",
  "/member": "host",
  "/platform": "host",
  "/platform/catalogue": "host",
  "/platform/chooser-lab": "host",
  "/platform/feedback": "host",
  "/reset-password": "bare",
  "/sets": "host",
  "/sets/[id]": "host",
  "/sets/comparator/new": "host",
  "/sets/edit": "host",
  "/sets/feeder/new": "host",
  "/sets/guided": "host",
  "/sources": "host",
  "/teacher": "own",
  "/teacher/[phase]": "own",
  "/teacher/admissions": "own",
  "/teacher/admissions/team": "own",
  "/teacher/group": "own",
  "/teacher/group/academic": "own",
  "/teacher/group/access": "own",
  "/teacher/group/groups": "own",
  "/teacher/group/groups/[id]": "own",
  "/teacher/group/join": "host",
  "/teacher/group/overview": "own",
  "/teacher/group/pupils": "own",
  "/teacher/group/schools": "own",
  "/teacher/meetings": "own",
  "/teacher/meetings/[id]": "host",
  "/teacher/people": "host",
  "/teacher/recruitment": "own",
  "/teacher/school-account": "host",
  "/teacher/school-account/head-office": "host",
  "/teacher/school-account/membership": "host",
  "/teacher/school-account/sign-ins": "host",
  "/teacher/setup": "own",
  "/teacher/smt": "own",
  "/teacher/smt/academic": "own",
  "/teacher/smt/context": "own",
  "/teacher/smt/pupils": "own",
  "/teacher/teams": "host",
  "/teacher/walk/[walkId]": "walk",
  "/teacher/welcome": "own",
  "/teacher/whats-new": "own",
};

const PATTERNS = Object.entries(NAV_ROUTES)
  .map(([route, mode]) => ({ mode, re: new RegExp(`^${route.replace(/\[[^\]]+\]/g, "[^/]+")}/?$`), dynamic: route.includes("[") }))
  // A literal route wins over a dynamic one at the same place (/teacher/smt over /teacher/[phase]).
  .sort((a, b) => Number(a.dynamic) - Number(b.dynamic));

/** How this address gets the nav. An unknown address (a 404) gets the host's. */
export function navModeFor(pathname: string | null): NavMode {
  if (!pathname) return "host";
  return PATTERNS.find((p) => p.re.test(pathname))?.mode ?? "host";
}
