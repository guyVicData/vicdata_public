// VicData 0.8 groups r1 (G2): a platform admin's View as for a head office -- one group account, read
// only, never logged. Its own cookie beside View as's school one (src/lib/view-as.ts), because a group
// is not a school: no URN, no role at a school. Honoured only after the caller is confirmed a platform
// admin (the group routes, server side, on every request). Framework-free: routes import it too.
export const VIEW_AS_GROUP_COOKIE = "vicdata_view_as_group";
export type ViewAsGroup = { accountId: string; name: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseViewAsGroupCookie(cookieHeader: string | null | undefined): ViewAsGroup | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== VIEW_AS_GROUP_COOKIE) continue;
    try {
      const s = JSON.parse(decodeURIComponent(part.slice(i + 1).trim())) as { a?: unknown; n?: unknown };
      if (typeof s.a !== "string" || !UUID.test(s.a)) return null;
      return { accountId: s.a.toLowerCase(), name: typeof s.n === "string" && s.n ? s.n.slice(0, 160) : "the group" };
    } catch {
      return null;
    }
  }
  return null;
}

function write(v: ViewAsGroup | null) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = v
      ? `${VIEW_AS_GROUP_COOKIE}=${encodeURIComponent(JSON.stringify({ a: v.accountId, n: v.name }))}; Path=/; SameSite=Lax${secure}`
      : `${VIEW_AS_GROUP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // Not in a browser.
  }
}

/** This browser's head-office View as, or null (the cookie only: the server re-checks platform admin). */
export function viewAsGroupSnapshot(): ViewAsGroup | null {
  if (typeof document === "undefined") return null;
  return parseViewAsGroupCookie(document.cookie);
}

export function startViewAsGroup(v: ViewAsGroup): void {
  write(v);
}

export function exitViewAsGroup(): void {
  write(null);
}
