// VicData 0.8 feedback deploy gate: every round's report gives "Guy's commands" in one order
// (docs/FEEDBACK.md, "Guy's commands"). Round 1 of the Admissions feedback listed the Render deploy but
// nothing made it come before the republish and the closing, so neither ran in that order.
//
//   1. Migrations  2. Merge and push  3. Render deploys main on its own (by hand if none starts in 5 minutes)
//   4. Wait for /api/version
//   5. Republish   6. Set fixed       7. Live check
//
// Each step is a bold numbered line (`**1. Migrations** ...`); a step a round doesn't need stays, saying
// "none this round". The rule test (R-REPORT-COMMANDS-ORDER) checks every report written since the template
// (and any not yet committed: the next one).

export const COMMAND_STEPS: { n: number; name: string; test: RegExp }[] = [
  { n: 1, name: "Migrations", test: /migration/i },
  { n: 2, name: "Merge and push", test: /merge[\s\S]*push/i },
  { n: 3, name: "Render deploys main on its own", test: /render[\s\S]*deploy/i },
  { n: 4, name: "Wait until /api/version shows the merge", test: /\/api\/version/ },
  { n: 5, name: "Republish", test: /republish/i },
  { n: 6, name: "Set fixed", test: /set fixed/i },
  { n: 7, name: "Live check", test: /live check/i },
];

/** The "Guy's commands" section of a report, or null if it has none. */
export function commandsSection(md: string): string | null {
  const m = /^##\s+Guy['’]s commands\b.*$/im.exec(md);
  if (!m) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = /^##\s/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** Problems with a report's commands against the template; empty when it follows it. */
export function checkCommands(md: string): string[] {
  const section = commandsSection(md);
  if (section === null) return ["no \"## Guy's commands\" section"];
  const steps = Array.from(section.matchAll(/^\*\*(\d+)\.\s*([^*]+)\*\*/gm)).map((m) => ({ n: Number(m[1]), title: m[2].trim() }));
  const problems: string[] = [];
  if (steps.length !== COMMAND_STEPS.length) problems.push(`${steps.length} numbered steps, not ${COMMAND_STEPS.length}`);
  COMMAND_STEPS.forEach((want, i) => {
    const got = steps[i];
    if (!got) problems.push(`step ${want.n} (${want.name}) is missing`);
    else if (got.n !== want.n || !want.test.test(got.title)) problems.push(`step ${i + 1} reads "${got.n}. ${got.title}", not "${want.n}. ${want.name}"`);
  });
  return problems;
}
