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
