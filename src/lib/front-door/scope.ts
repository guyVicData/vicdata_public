// VicData 0.8 front door (C18, R-THEME-MID-SCOPE): the only files that read the person's Mid choice
// (useThemePref). Everything else draws Dark under Mid through useTeacherTheme. A new home or walk file
// that needs Mid is added here, on purpose.
export const MID_PAGES: string[] = [
  "src/components/shell/TeacherChrome.tsx",
  // The homes (B8): the frame, the role sections, head office's home.
  "src/components/front-door/home.tsx",
  "src/components/front-door/sections.tsx",
  "src/components/groups/GroupHome.tsx",
  // The first visit (A5-A7): welcome, setup, the changelog page.
  "src/components/front-door/first-visit.tsx",
];
