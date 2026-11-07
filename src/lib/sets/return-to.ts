// Where the set editor may send someone back to (its breadcrumb, Save, Archive, Delete). The address
// arrives in the URL, so anyone can craft it: only a path on this site, on a page that opens the
// editor, is accepted. Everything else -- another site (`https://…`, `//…`, `/\…`), a `javascript:`
// or `data:` URL, control characters, the editor itself -- is refused (null), and the caller falls
// back to a page of its own. The value returned is the parsed, normalised path (`..` resolved), never
// the raw input.

/** The pages that open the set editor, so the only places it returns to. A prefix matches the page and
 * anything under it (`/sets` matches `/sets/abc`), never a longer name (`/setsX`). */
export const RETURN_PREFIXES = ["/teacher/admissions", "/teacher/ks4", "/teacher/ks5", "/teacher/smt", "/sets"] as const;

const MAX_LENGTH = 2000;
// Any parse base will do: it only has to be an origin that no input can reach by itself.
const BASE = "https://return-to.invalid";

const underPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function safeReturnTo(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  // Control characters (the URL parser silently drops tabs and newlines, so "/\t/evil.example" would
  // become "//evil.example") and backslashes (browsers read "/\evil.example" as "//evil.example").
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  // A path on this site: one leading slash, not two (a scheme, or "//host", fails here).
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = url.pathname;
  if (!RETURN_PREFIXES.some((p) => underPrefix(path, p))) return null;
  // Never back into the editor (a loop).
  if (underPrefix(path, "/sets/edit")) return null;
  return `${path}${url.search}${url.hash}`;
}
