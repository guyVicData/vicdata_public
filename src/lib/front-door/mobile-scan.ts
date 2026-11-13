// VicData 0.8 front door, part 2 (G; R-FRONT-DOOR-MOBILE): a static check that every control on the front
// door's surfaces (Parts 1 and 2) has a 44 px hit area at phone width, and no phone markup is wider than the
// shell's 358 px card. Pure: it reads the source text. The headless measurement at 390 x 844 (no horizontal
// scroll, every control's box at least 44 px) is the report's (docs/v0.8/front_door_2_report_v1.md).
//
// A control is an opening <button, <Link, <a, <select, <summary or a text <input. It passes when its className
// gives it 44 px at the base (phone) size -- min-h-[44px], h-11 / h-[44px] (or more), min-h-[64px], or padding
// that makes it at least 44 px tall (py-3 with 14 px text or larger, py-3.5, py-4, py-5) -- or when it is
// listed in MOBILE_EXCEPTIONS with why. Classes behind a breakpoint (sm:, md:, lg:) don't count: they're desktop.

export const FRONT_DOOR_SURFACES = [
  // Part 1: welcome, setup, the strip and the changelog; the homes; the walks.
  "src/components/front-door/first-visit.tsx",
  "src/components/front-door/home.tsx",
  "src/components/front-door/sections.tsx",
  "src/components/groups/GroupHome.tsx",
  "src/components/front-door/WalkPage.tsx",
  "src/components/front-door/role-walks.tsx",
  // Part 2: the guided editor; the School-Admin's pages.
  "src/components/sets/GuidedSetEditor.tsx",
  "src/app/sets/guided/page.tsx",
  "src/components/school-admin/SchoolAccount.tsx",
  "src/app/teacher/school-account/head-office/page.tsx",
  // The school's own group card, on the SMT home and on Head office sharing.
  "src/components/groups/SchoolGroupTile.tsx",
] as const;

/** Controls that pass another way, by file and a snippet of the tag, with why. */
export const MOBILE_EXCEPTIONS: { file: string; has: string; why: string }[] = [
  { file: "src/components/groups/SchoolGroupTile.tsx", has: 'role="switch"', why: "the Admissions share switch sits in a label that is 44 px on a phone (the label's words click it too)" },
  { file: "src/components/front-door/role-walks.tsx", has: '<Link className="underline" href={walk.dashboard}>', why: "an inline link in the sentence a screen shows when it opens the dashboard instead of drawing (Context's map)" },
  { file: "src/components/sets/GuidedSetEditor.tsx", has: 'type="checkbox"', why: "the tick sits in a 44 px label (h-[44px] w-[44px] on a phone)" },
  { file: "src/components/sets/GuidedSetEditor.tsx", has: 'type="range"', why: "the slider is h-[44px] on a phone" },
  { file: "src/components/front-door/WalkPage.tsx", has: 'className="w-full text-left"', why: "a rail button wraps its row (RAIL_ROW: min-h-[44px] on a phone)" },
  { file: "src/components/front-door/WalkPage.tsx", has: "title={`Opens the dashboard at this panel", why: "a rail link wraps its row (RAIL_ROW: min-h-[44px] on a phone)" },
  { file: "src/components/front-door/role-walks.tsx", has: "title={`Opens the dashboard: ${r.label}`}", why: "a rail link wraps its row (RAIL_ROW: min-h-[44px] on a phone)" },
  { file: "src/components/front-door/WalkPage.tsx", has: 'className="underline" href="/teach', why: "an inline link in the error sentence (a load failure), not a control of the screen" },
  { file: "src/components/front-door/WalkPage.tsx", has: 'href="/teacher" className="underline"', why: "an inline link in the no-such-walk sentence (a bad address), not a control of the screen" },
  { file: "src/components/front-door/first-visit.tsx", has: 'className="mt-2 inline-block text-[14px] font-semibold underline', why: "a changelog entry's own link, inside its card (the card is the target's row)" },
];

const BASE_44 = [/(?:^|\s)min-h-\[(4[4-9]|[5-9]\d|\d{3})px\]/, /(?:^|\s)h-(1[1-9]|[2-9]\d)(?:\s|$)/, /(?:^|\s)h-\[(4[4-9]|[5-9]\d|\d{3})px\]/, /(?:^|\s)py-(3\.5|[4-9])(?:\s|$)/, /(?:^|\s)py-5(?:\s|$)/];

/** The base (phone) classes of a className string: every class not behind a breakpoint or a state. */
export const baseClasses = (cls: string) => cls.split(/\s+/).filter((c) => c && !/^(sm|md|lg|xl|2xl|hover|focus|disabled|dark):/.test(c)).join(" ");

export function tallEnough(cls: string): boolean {
  const base = ` ${baseClasses(cls)} `;
  if (BASE_44.some((r) => r.test(base))) return true;
  // py-3 (24 px) with 14 px text or more (line height 1.5: 21 px) is 45 px.
  const text = /\stext-\[(\d+(?:\.\d+)?)px\]/.exec(base);
  return /\spy-3\s/.test(base) && !!text && Number(text[1]) >= 14;
}

export type MobileFinding = { file: string; line: number; tag: string };

/** Every JSX opening tag of these names, whole (attributes with braces, strings and template literals). */
export function openingTags(text: string, names: readonly string[]): { name: string; tag: string; index: number }[] {
  const out: { name: string; tag: string; index: number }[] = [];
  const re = new RegExp(`<(${names.join("|")})(?=[\\s/>])`, "g");
  for (const m of text.matchAll(re)) {
    let i = m.index! + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
        else if (quote === "`" && c === "$" && text[i + 1] === "{") { depth++; i++; quote = null; }
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push({ name: m[1], tag: text.slice(m.index!, i + 1), index: m.index! });
  }
  return out;
}

/** A tag's className as the phone sees it: `${phone ? "A" : "B"}` reads A, and `${name}` a shared class
 * string the file defines (const name = phone ? "A" : "B", or a template / string literal). */
export function phoneClass(tag: string, text: string): string {
  const raw = /className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{([A-Za-z_]+)\})/.exec(tag);
  if (!raw) return "";
  const consts = new Map<string, string>();
  for (const m of text.matchAll(/const ([A-Za-z_]+) = phone \? "([^"]*)" : "[^"]*";/g)) consts.set(m[1], m[2]);
  for (const m of text.matchAll(/const ([A-Za-z_]+) = `([^`]*)`;/g)) consts.set(m[1], m[2]);
  for (const m of text.matchAll(/const ([A-Za-z_]+) = "([^"]*)";/g)) consts.set(m[1], m[2]);
  let cls = raw[1] ?? raw[2] ?? consts.get(raw[3] ?? "") ?? "";
  for (let k = 0; k < 3; k++) {
    cls = cls.replace(/\$\{phone \? "([^"]*)" : [^}]*\}/g, "$1").replace(/\$\{([A-Za-z_]+)\}/g, (_, n: string) => consts.get(n) ?? "");
  }
  return cls;
}

const CONTROLS = ["button", "Link", "a", "select", "summary", "input"] as const;

/** Every control in the file without a 44 px base height or a listed exception. */
export function scanControls(file: string, text: string): MobileFinding[] {
  const out: MobileFinding[] = [];
  for (const t of openingTags(text, CONTROLS)) {
    if (t.name === "input" && /type="(checkbox|radio|range|hidden)"/.test(t.tag) && !MOBILE_EXCEPTIONS.some((e) => e.file === file && t.tag.includes(e.has))) {
      out.push({ file, line: text.slice(0, t.index).split("\n").length, tag: t.tag.replace(/\s+/g, " ").slice(0, 140) });
      continue;
    }
    if (MOBILE_EXCEPTIONS.some((e) => e.file === file && t.tag.includes(e.has))) continue;
    if (tallEnough(phoneClass(t.tag, text))) continue;
    out.push({ file, line: text.slice(0, t.index).split("\n").length, tag: t.tag.replace(/\s+/g, " ").slice(0, 140) });
  }
  return out;
}

/** Fixed widths over the shell's 358 px card in phone markup (base classes only). */
export function wideFindings(file: string, text: string): MobileFinding[] {
  const out: MobileFinding[] = [];
  for (const m of text.matchAll(/className=\{?[`"]([^`"]*)[`"]/g)) {
    const base = baseClasses(m[1]);
    const w = /(?:^|\s)(?:w|min-w)-\[(\d+)px\]/.exec(base);
    if (w && Number(w[1]) > 358) out.push({ file, line: text.slice(0, m.index).split("\n").length, tag: `${w[0].trim()}` });
  }
  return out;
}
