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

// ------------------------------------------------------------------------------------------------
// The way back (0.8 sets: return navigation). Every page that opens the editor passes `returnTo`, its
// own address. The editor names the destination ("Back to Leighton Park · Pipelines 11+"), and Back,
// Cancel and Save all leave the same way: one step back in history when the previous page IS the
// origin (so nothing is added and browser back agrees), otherwise replacing the editor's entry. Save
// going back hands the saved set's id to the origin through sessionStorage (the handover below).

export type SetsProduct = "admissions" | "smt" | "teacher";

export type ReturnContext = {
  kind: "compared_against" | "feeders";
  entry: string;
  phase: "ks4" | "ks5" | null;
  product: SetsProduct;
  urn: string;
  schoolName: string;
  /** The name of the set whose view the editor was opened from, when the origin is a set view. */
  originSetName?: string | null;
};

const isDashboard = (path: string) => path.startsWith("/teacher/");

/** The origin with its school named, so it opens on the same school even if another tab has switched
 * (dashboards read `?school=`, the sets pages `?urn=`). An address that already names one keeps it. */
export function withSchool(returnTo: string, urn: string): string {
  const url = new URL(returnTo, BASE);
  const param = isDashboard(url.pathname) ? "school" : "urn";
  if (!url.searchParams.has(param)) url.searchParams.set(param, urn);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** No usable origin (a direct link, a pasted address): the dashboard the set is for. */
export function fallbackReturn(c: Pick<ReturnContext, "kind" | "entry" | "phase" | "product" | "urn">): string {
  const q = new URLSearchParams();
  if (c.phase) {
    q.set("school", c.urn);
    return `${c.product === "smt" ? "/teacher/smt" : `/teacher/${c.phase}`}?${q}`;
  }
  q.set("view", c.kind === "feeders" ? "pipelines" : "market-share");
  q.set("entry", c.entry);
  q.set("school", c.urn);
  return `/teacher/admissions?${q}`;
}

const PHASE_WORD = { ks4: "GCSE", ks5: "Post-16" } as const;

/** "Back to …", named from the (checked) address itself, so it can't be spoofed and survives a refresh. */
export function returnLabel(returnTo: string, c: ReturnContext): string {
  const url = new URL(returnTo, BASE);
  const p = url.pathname;
  const q = url.searchParams;
  if (underPrefix(p, "/teacher/admissions")) {
    const view = (q.get("view") ?? (c.kind === "feeders" ? "pipelines" : "market-share")) === "market-share" ? "Market share" : "Pipelines";
    return `Back to ${c.schoolName} · ${view} ${q.get("entry") || c.entry}`;
  }
  if (underPrefix(p, "/teacher/ks4") || underPrefix(p, "/teacher/ks5")) return `Back to ${c.schoolName} · ${PHASE_WORD[p.startsWith("/teacher/ks5") ? "ks5" : "ks4"]}`;
  if (underPrefix(p, "/teacher/smt")) return c.phase ? `Back to SMT · ${PHASE_WORD[c.phase]}` : "Back to SMT";
  if (p === "/sets") return "Back to Sets";
  if (p === "/sets/default") return `Back to ${q.get("name") || "the set"}`;
  return `Back to ${c.originSetName || "the set"}`;
}

/** The same page, give or take the parameters the trip adds or the page tidies away. */
export function sameTarget(a: string, b: string): boolean {
  const norm = (s: string) => {
    const url = new URL(s, BASE);
    const q = [...url.searchParams].filter(([k]) => k !== "useSet" && k !== "school").sort(([x, xv], [y, yv]) => (x === y ? xv.localeCompare(yv) : x.localeCompare(y)));
    return `${url.pathname}?${new URLSearchParams(q)}`;
  };
  try {
    return norm(a) === norm(b);
  } catch {
    return false;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LeavePlan = { how: "back" } | { how: "replace"; href: string };

/** How to leave the editor. `back` only when the page before it in this tab is the origin; otherwise
 * replace the editor's own history entry, so it is never left behind you. After saving a set as a new
 * one from another set's view, that view is the old set's: go to the new set's view instead. */
export function planLeave(o: { returnTo: string; fallback: boolean; referrer: string; origin: string; historyLength: number; savedId?: string | null }): LeavePlan {
  const target = new URL(o.returnTo, BASE);
  if (o.savedId && target.pathname.startsWith("/sets/")) {
    const viewed = target.pathname.slice("/sets/".length);
    if (viewed !== o.savedId) {
      const q = new URLSearchParams();
      const urn = target.searchParams.get("urn");
      if (urn) q.set("urn", urn);
      return { how: "replace", href: `/sets/${o.savedId}${q.size ? `?${q}` : ""}` };
    }
  }
  let previousIsOrigin = false;
  if (!o.fallback && o.historyLength > 1 && o.referrer) {
    try {
      const r = new URL(o.referrer);
      previousIsOrigin = r.origin === o.origin && sameTarget(`${r.pathname}${r.search}`, o.returnTo);
    } catch {
      previousIsOrigin = false;
    }
  }
  if (previousIsOrigin) return { how: "back" };
  if (!o.savedId) return { how: "replace", href: o.returnTo };
  target.searchParams.set("useSet", o.savedId);
  return { how: "replace", href: `${target.pathname}${target.search}${target.hash}` };
}

// The handover: Save going back can't put `useSet` in the address it returns to, so it leaves the id
// here for that page. sessionStorage is this tab's own (another tab never sees it); the entry names the
// page it is for, expires, and is taken once.
export const HANDOVER_KEY = "vicdata.sets.handover";
export const HANDOVER_TTL_MS = 10 * 60 * 1000;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function writeHandover(store: StorageLike, returnTo: string, id: string, now = Date.now()): void {
  if (!UUID.test(id)) return;
  try {
    store.setItem(HANDOVER_KEY, JSON.stringify({ returnTo, id, at: now }));
  } catch {
    // Storage blocked: the origin just keeps the set it had.
  }
}

function readHandover(store: StorageLike, now: number): { returnTo: string; id: string; at: number } | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(HANDOVER_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const h = JSON.parse(raw) as { returnTo?: unknown; id?: unknown; at?: unknown };
    const fresh = typeof h.at === "number" && now - h.at <= HANDOVER_TTL_MS && h.at <= now + 60_000;
    if (typeof h.returnTo === "string" && typeof h.id === "string" && UUID.test(h.id) && fresh) return { returnTo: h.returnTo, id: h.id, at: h.at as number };
  } catch {
    // fall through: unreadable
  }
  try {
    store.removeItem(HANDOVER_KEY); // stale or unreadable: gone
  } catch {
    // ignore
  }
  return null;
}

/** Is there a handover waiting for this page (without taking it)? */
export function hasHandover(store: StorageLike, here: string, now = Date.now()): boolean {
  const h = readHandover(store, now);
  return !!h && sameTarget(h.returnTo, here);
}

/** Take the handover for this page: its id, once. One for another page is left alone. */
export function takeHandover(store: StorageLike, here: string, now = Date.now()): string | null {
  const h = readHandover(store, now);
  if (!h || !sameTarget(h.returnTo, here)) return null;
  try {
    store.removeItem(HANDOVER_KEY);
  } catch {
    // ignore
  }
  return h.id;
}
