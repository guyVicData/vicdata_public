// R-NO-PUBLIC-SCHOOL-LINKS (Guy, 21 Nov, private beta): the public school pages (/schools/**) are hidden
// -- next.config.ts redirects every one to /member, which sends a signed-in member to /teacher and a
// signed-out visitor to / -- and nothing in the app builds a URL to one. A source scan, run by the unit
// test and the rule test: a string or template literal starting "/schools" (a Link href, router.push,
// window.location, a map marker, an email) is allowed only in a file listed below, and each listed file
// must be reachable only from the hidden pages themselves (every importer under src/app/schools, or
// itself reachable only from there), so no signed-in surface can render it.

/** Files that build a /schools/ URL, each reachable only from the hidden public pages. */
export const PUBLIC_PAGE_ONLY: { file: string; why: string }[] = [
  { file: "src/app/schools/[urn]/page.tsx", why: "the public school page itself (redirected), linking to its own Data View" },
  { file: "src/components/dashboard/AcademicSnapshotCard.tsx", why: "a card on the public school page only, linking to that school's Data View" },
  { file: "src/components/ConsortiumCrossLinkNote.tsx", why: "the public school page's note linking a member to its consortium's public page" },
  { file: "src/components/ConsortiumMemberList.tsx", why: "a consortium's public page lists its members, each linking to its public page" },
  { file: "src/components/SchoolMap.tsx", why: "the public school page's map: a marker opens that school's public page" },
];

/** A quoted or templated path that starts with /schools: "/schools", `/schools/${urn}`, '/schools?...'. Not
 * /api/schools..., /teacher/group/schools or a URL in a comment (no quote straight before it). */
export const PUBLIC_SCHOOL_URL = /[`"']\/schools(?=[/?#`"'$])/g;

export type SourceFile = { file: string; text: string };
export type PublicSchoolLink = { file: string; line: number; text: string };

/** Every /schools URL built in the given files. */
export function publicSchoolLinks(files: SourceFile[]): PublicSchoolLink[] {
  const out: PublicSchoolLink[] = [];
  for (const f of files) {
    // Tests are not surfaces; their fixtures may spell the URL out.
    if (/\.test\.tsx?$/.test(f.file)) continue;
    const lines = f.text.split("\n");
    lines.forEach((l, i) => {
      // A comment line is not a link.
      if (/^\s*(\/\/|\/?\*)/.test(l)) return;
      PUBLIC_SCHOOL_URL.lastIndex = 0;
      if (PUBLIC_SCHOOL_URL.test(l)) out.push({ file: f.file, line: i + 1, text: l.trim() });
    });
  }
  return out;
}

const IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

/** The src file a specifier resolves to, or null (a package). */
function resolve(from: string, spec: string, known: Set<string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) {
    const parts = from.split("/").slice(0, -1);
    for (const p of spec.split("/")) {
      if (p === "..") parts.pop();
      else if (p !== ".") parts.push(p);
    }
    base = parts.join("/");
  } else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (known.has(c)) return c;
  return null;
}

/** Files reachable only from src/app/schools: under it, or every (non-test) importer is. */
export function publicPageOnlyFiles(files: SourceFile[]): Set<string> {
  const known = new Set(files.map((f) => f.file));
  const importers = new Map<string, Set<string>>();
  for (const f of files) {
    if (/\.test\.tsx?$/.test(f.file)) continue;
    IMPORT.lastIndex = 0;
    for (const m of f.text.matchAll(IMPORT)) {
      const t = resolve(f.file, m[1], known);
      if (t) (importers.get(t) ?? importers.set(t, new Set()).get(t)!).add(f.file);
    }
  }
  const only = new Set(files.map((f) => f.file).filter((f) => f.startsWith("src/app/schools/")));
  for (let grew = true; grew; ) {
    grew = false;
    for (const [t, from] of importers) {
      if (only.has(t) || !from.size) continue;
      if ([...from].every((x) => only.has(x))) {
        only.add(t);
        grew = true;
      }
    }
  }
  return only;
}

/** The scan's findings: links outside the allow-list, listed files no longer only on the public pages,
 * and listed files that no longer build a link (stale entries). */
export function publicSchoolLinkFindings(files: SourceFile[]) {
  const links = publicSchoolLinks(files);
  const listed = new Set(PUBLIC_PAGE_ONLY.map((x) => x.file));
  const only = publicPageOnlyFiles(files);
  return {
    links,
    unlisted: links.filter((l) => !listed.has(l.file)),
    reachable: PUBLIC_PAGE_ONLY.filter((x) => !only.has(x.file)).map((x) => x.file),
    stale: PUBLIC_PAGE_ONLY.filter((x) => !links.some((l) => l.file === x.file)).map((x) => x.file),
  };
}
