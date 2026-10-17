// VicData 0.8 groups r1 (G2): a platform admin's View as for a head office -- one group account, read
// only. 0.8 View as: no longer a cookie of its own. Head office is a View as role in the one View as
// cookie (src/lib/view-as.ts: {r: "head_office", g, n}), started from the same switcher and logged
// the same way (view_as_group). This file keeps the names the group code imports.
// Framework-free: routes import it too.
import { parseViewAsGroup, viewAsGroupSnapshot as snapshot, type ViewAsGroup } from "../view-as";

export type { ViewAsGroup } from "../view-as";

/** The head-office View as in a Cookie header, or null (the server re-checks platform admin). */
export function parseViewAsGroupCookie(cookieHeader: string | null | undefined): ViewAsGroup | null {
  return parseViewAsGroup(cookieHeader);
}

/** This page's head-office View as, or null (the cookie only: the server re-checks platform admin). */
export function viewAsGroupSnapshot(): ViewAsGroup | null {
  return snapshot();
}
