// VicData 0.8 front door (R-THEME-MID-SCOPE, R-PANEL-LADDER): source scans shared by the unit test and the
// rule runner. No database.
import { MID_PAGES } from "./scope";

export type SourceFile = { file: string; text: string };

/** Files that read the person's Mid choice but aren't listed in MID_PAGES; and listed files that no longer do. */
export function midScopeFindings(files: SourceFile[]) {
  const readers = files.filter((f) => /\buseThemePref\s*\(/.test(f.text)).map((f) => f.file);
  return {
    readers,
    unlisted: readers.filter((f) => !MID_PAGES.includes(f)),
    stale: MID_PAGES.filter((f) => !files.some((x) => x.file === f)),
  };
}

/**
 * 0.8 front door 2b (M3): the dashboards follow Mid; the sets and admin pages don't. Each dashboard root
 * draws its theme from useDashboardTheme(), marks its root (midRootProps), provides the part to its
 * components (MidDashProvider) and puts its header in a MidBand; the ShellPage products put their control
 * bar in the band too. A sets or admin root never does any of that and draws useTeacherTheme() (Dark
 * under Mid).
 */
export const MID_DASH_ROOTS = [
  "src/components/dashboard-config/TeacherDashboard.tsx",
  "src/components/smt/SmtDashboard.tsx",
  "src/components/admissions/AdmissionsDashboard.tsx",
  "src/components/groups/dash/GroupDashboard.tsx",
  "src/components/groups/library/GroupLibrary.tsx",
  "src/components/groups/library/GroupLibraryPage.tsx",
];
export const MID_SHELL_PAGES = ["src/components/smt/SmtDashboard.tsx", "src/components/admissions/AdmissionsDashboard.tsx", "src/components/groups/dash/GroupDashboard.tsx"];
export const DARK_UNDER_MID = [
  "src/app/sets/guided/page.tsx",
  "src/app/sets/edit/page.tsx",
  "src/components/sets/SetsShell.tsx",
  "src/components/sets/GroupSetsLibrary.tsx",
  "src/components/sets/GroupSetEditor.tsx",
  "src/components/library/LibraryScreen.tsx",
  "src/components/school-admin/SchoolAccount.tsx",
  "src/components/admin/PeopleScreen.tsx",
  "src/components/admin/TeamsScreen.tsx",
  "src/components/admin/PlatformScreen.tsx",
  "src/components/groups/GroupAccess.tsx",
];
export function midDashFindings(files: SourceFile[]): string[] {
  const get = (f: string) => files.find((x) => x.file === f)?.text ?? "";
  const problems: string[] = [];
  for (const f of MID_DASH_ROOTS) {
    const t = get(f);
    if (!t) problems.push(`${f} missing`);
    for (const need of ["useDashboardTheme()", "midRootProps(", "<MidDashProvider", "<MidBand"]) if (t && !t.includes(need)) problems.push(`${f}: no ${need}`);
  }
  for (const f of MID_SHELL_PAGES) if (!/<MidBand bleed=\{!phone\}[\s\S]*?<ControlBar[\s\S]*?<\/MidBand>/.test(get(f))) problems.push(`${f}: the control bar isn't in the band`);
  for (const f of DARK_UNDER_MID) {
    const t = get(f);
    if (!t) problems.push(`${f} missing`);
    else if (!t.includes("useTeacherTheme()") || /useDashboardTheme|midRootProps|MidDashProvider|data-mid-dash/.test(t)) problems.push(`${f}: not Dark under Mid`);
  }
  const md = get("src/components/shell/MidDash.tsx");
  if (!md.includes("if (!part) return <>{children}</>;") || !md.includes('return mid ? { "data-pref": "mid", "data-mid-dash": part } : {};') || !md.includes("if (!mid) return <>{children}</>;")) problems.push("MidDash adds markup outside Mid");
  return problems;
}

/** The shell marks every dashboard for the ladder and draws the shut bar with the shut tokens. */
export function ladderShellFindings(files: SourceFile[]) {
  const get = (f: string) => files.find((x) => x.file === f)?.text ?? "";
  const problems: string[] = [];
  if (!/data-dash-ladder/.test(get("src/components/shell/DashboardGrid.tsx"))) problems.push("DashboardGrid unmarked");
  if (!/data-dash-ladder/.test(get("src/components/shell/Rows.tsx"))) problems.push("ShellPage unmarked");
  const card = get("src/components/shell/CardBox.tsx");
  if (!/data-shut-panel/.test(card) || !/--shut-bg/.test(card) || !/--shut-shadow/.test(card)) problems.push("CardBox's shut bar off the shut tokens");
  if (!/--well-border/.test(card)) problems.push("CardBox's well off the well border");
  return problems;
}
