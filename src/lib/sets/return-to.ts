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

// ------------------------------------------------------------------------------------------------
// The library's and the set view's way back (Guy, 8 Nov: "on /sets there is no way back except the
// browser's Back"). A set menu's Manage sets passes `returnTo` (the dashboard as it stands); /sets and
// /sets/<id> show "‹ Back to <page>" and keep `returnTo` on their own links (the set view's breadcrumb,
// the library's set links, the editor's way back is the page itself so carries it too). Only a dashboard
// is a way back from here (never /sets itself, a loop); without one, the school's dashboard for the
// person's role, "Back to dashboard".

/** A dashboard to go back to from the library or a set view: safeReturnTo, and under /teacher/. */
export function safeDashboardReturn(raw: string | null | undefined): string | null {
  const ok = safeReturnTo(raw);
  return ok && underPrefix(new URL(ok, BASE).pathname, "/teacher") ? ok : null;
}

const SMT_PAGE: Record<string, string> = { "/teacher/smt": "SMT", "/teacher/smt/academic": "SMT Academic", "/teacher/smt/pupils": "SMT Pupils", "/teacher/smt/context": "SMT Context" };

/** "Back to Pipelines", "Back to Market share", "Back to GCSE results", "Back to SMT Academic"… named
 * from the (checked) address, never from anything else in the URL. */
export function dashboardLabel(returnTo: string): string {
  const url = new URL(returnTo, BASE);
  const p = url.pathname;
  if (underPrefix(p, "/teacher/admissions")) return url.searchParams.get("view") === "market-share" ? "Back to Market share" : "Back to Pipelines";
  if (underPrefix(p, "/teacher/ks4")) return "Back to GCSE results";
  if (underPrefix(p, "/teacher/ks5")) return "Back to Post-16 results";
  if (underPrefix(p, "/teacher/smt")) return `Back to ${SMT_PAGE[p.replace(/\/$/, "")] ?? "SMT"}`;
  return "Back to dashboard";
}

export type SetsRole = "admissions" | "smt" | "teacher";

/** The person's role at the school, for the fallback: Admissions (the lead or the role), else SMT, else Teacher. */
export function setsRole(m: { roles: string[] | null; lead?: boolean | null }): SetsRole {
  const roles = m.roles ?? [];
  if (m.lead || roles.includes("admissions")) return "admissions";
  if (roles.includes("smt")) return "smt";
  return "teacher";
}

/** No usable `returnTo` (someone typed /sets): the school's dashboard for the person's role. */
export function roleDashboard(role: SetsRole, urn: string | null): { href: string; label: string } {
  const path = role === "admissions" ? "/teacher/admissions" : role === "smt" ? "/teacher/smt" : "/teacher";
  return { href: urn ? `${path}?${new URLSearchParams({ school: urn })}` : path, label: "Back to dashboard" };
}

/** The kind of set a dashboard uses, from its address: Pipelines feeders, Market share / GCSE / Post-16 /
 * SMT compared against; and its entry point or phase where the address says it (else any). */
export function pageSetKind(returnTo: string): { kind: "compared_against" | "feeders"; entry: string | null; phase: "ks4" | "ks5" | null } | null {
  const url = new URL(returnTo, BASE);
  const p = url.pathname;
  if (underPrefix(p, "/teacher/admissions")) return { kind: url.searchParams.get("view") === "market-share" ? "compared_against" : "feeders", entry: url.searchParams.get("entry"), phase: null };
  if (underPrefix(p, "/teacher/ks4")) return { kind: "compared_against", entry: null, phase: "ks4" };
  if (underPrefix(p, "/teacher/ks5")) return { kind: "compared_against", entry: null, phase: "ks5" };
  if (underPrefix(p, "/teacher/smt")) return { kind: "compared_against", entry: null, phase: null };
  return null;
}

/** The set chosen or saved here goes back with the person only if it is a stored set of the kind the
 * page uses (and its entry point or phase, where the page's address names one). Otherwise null: the page
 * keeps the set it had. */
export function setForPage(returnTo: string, s: { id: string | null; kind: string; entry: string | null; phase: string | null } | null): string | null {
  if (!s?.id || !UUID.test(s.id)) return null;
  const page = pageSetKind(returnTo);
  if (!page || page.kind !== s.kind) return null;
  if (page.phase && s.phase !== page.phase) return null;
  if (page.entry && s.entry && s.entry !== page.entry) return null;
  return s.id;
}

/** The address the Back control shows (a middle-click or a new tab): the page, with `useSet` when a set
 * goes back with it. The click itself leaves through leaveEditor (one step back when the page before is
 * the dashboard, else replacing this entry; the set handed over the same way the editor's Save does). */
export function wayBackHref(returnTo: string, setId: string | null): string {
  if (!setId) return returnTo;
  const url = new URL(returnTo, BASE);
  url.searchParams.set("useSet", setId);
  return `${url.pathname}${url.search}${url.hash}`;
}
