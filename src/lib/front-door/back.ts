// Guy, 20 Nov (navigation, every role from head office to teacher): "always go back to the starting point -- up
// one level". A link that takes someone a level deeper carries ?back=<where they came from>; every walk and every
// dashboard reads it and offers one plain "Back to …" (a walk's close, its first Back and its last window; a
// dashboard's back bar). With no ?back, a page goes back to its natural parent. Client-safe, pure.
//
//   head office:  group home  ->  group walk / group dashboard / a member school's SMT  ->  back to the group
//   a school:     home (its SMT, Admissions, GCSE or Post-16 section)  ->  a walk or a dashboard  ->  back to that section
//   SMT:          SMT home  ->  Our subjects  ->  a Teacher walk or the Teacher dashboard  ->  back to the SMT home
//   a dashboard opened from inside a walk (Show me) goes back where the walk began, not into the walk.

export const BACK_PARAM = "back";

const MAX = 600;

/** A back address on this site, under /teacher or /sets (a path, no scheme or host), or null. */
export function safeBack(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw || raw.length > MAX) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(raw) || !raw.startsWith("/") || raw.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(raw, "https://back.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://back.invalid") return null;
  const p = url.pathname;
  if (!(p === "/teacher" || p.startsWith("/teacher/") || p === "/sets" || p.startsWith("/sets/"))) return null;
  // Never back into the set editor (a loop), and never a back that itself carries a back (no chains).
  if (p.startsWith("/sets/edit") || p.startsWith("/sets/guided") || url.searchParams.has(BACK_PARAM)) return null;
  return `${p}${url.search}${url.hash}`;
}

/** The words on the way back, from where it goes. */
export function backLabel(back: string): string {
  const [path, hash = ""] = back.split("#");
  const p = path.split("?")[0];
  if (p.startsWith("/teacher/group")) return "Back to the group";
  if (p.startsWith("/teacher/smt")) return "Back to the SMT dashboards";
  if (p.startsWith("/teacher/admissions")) return "Back to the Admissions dashboards";
  if (p === "/teacher/ks4") return "Back to the GCSE dashboard";
  if (p === "/teacher/ks5") return "Back to the Post-16 dashboard";
  if (p.startsWith("/sets")) return "Back to the sets";
  if (p === "/teacher") {
    if (hash === "smt") return "Back to the SMT home";
    if (hash === "admissions") return "Back to the Admissions home";
    if (hash === "gcse" || hash === "post-16") return `Back to your ${hash === "gcse" ? "GCSE" : "Post-16"} home`;
  }
  return "Back to your home";
}

/** `href` with ?back=<back> added (kept as it is when there's no safe back). */
export function withBack(href: string, back: string | null | undefined): string {
  const b = safeBack(back);
  if (!b) return href;
  const [path, hash] = href.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${BACK_PARAM}=${encodeURIComponent(b)}${hash ? `#${hash}` : ""}`;
}

/** The home section each role's links come back to (HomeSection gives each section this id). */
export const HOME_SECTION = { smt: "/teacher#smt", admissions: "/teacher#admissions", gcse: "/teacher#gcse", post16: "/teacher#post-16", group: "/teacher/group" } as const;

/** Where to go back to: the address's own ?back when it is safe, else the page's natural parent. */
export function backFrom(search: string | URLSearchParams | null | undefined, fallback: string): { href: string; label: string; given: boolean } {
  const sp = typeof search === "string" ? new URLSearchParams(search) : search ?? new URLSearchParams();
  const b = safeBack(sp.get(BACK_PARAM));
  const href = b ?? fallback;
  return { href, label: backLabel(href), given: !!b };
}
