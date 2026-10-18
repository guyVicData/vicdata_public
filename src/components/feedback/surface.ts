"use client";

// VicData 0.8 notes and feedback: building a page's ViewSurface the same way on every product. The
// school (or group) and the role come from what the page is drawn for: a peek (read-only, so no notes
// are kept), View as (notes under the View as state key, as every per-user row), or the member's own.
import { getActiveViewAs, readPeek, viewAsGroupSnapshot } from "@/lib/view-as";
import { groupNoteScope, type ViewProduct, type ViewSurface } from "@/lib/view-ref";

type Dash = { id: string; name: string; versionId?: string | null };
type State = ViewSurface["state"];

function peekOf(): { urn: string; role: string } | null {
  if (typeof window === "undefined") return null;
  return readPeek(new URLSearchParams(window.location.search));
}

/** A school's page: Teacher, SMT, Admissions, a custom dashboard. */
export function schoolSurface(o: { product: ViewProduct; dashboard: Dash; urn: string; name: string; role: string; state: State }): ViewSurface {
  const peek = peekOf();
  const va = getActiveViewAs();
  const viewAs = !!va && va.urn === o.urn;
  const peeking = !!peek && peek.urn === o.urn;
  return {
    product: o.product,
    dashboard: { id: o.dashboard.id, name: o.dashboard.name, versionId: o.dashboard.versionId ?? null },
    scope: { kind: "school", urn: o.urn, name: o.name },
    role: peeking ? peek!.role : viewAs ? va!.role : o.role,
    viewAs,
    peek: peeking,
    // fetchNotes / saveNote turn the URN into the View as state key themselves (stateUrn).
    noteScope: peeking ? null : o.urn,
    state: o.state,
  };
}

/** A head office's page: a group's dashboards. `ref` is what a peek or View as names it by (the group
 * account id, or "group:{group id}" for a group without an account). */
export function groupSurface(o: { dashboard: Dash; groupId: string; ref: string; name: string; role?: string; state: State; product?: ViewProduct }): ViewSurface {
  const sp = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const peeking = sp?.get("peek") === "1" && sp.get("as") === "head_office";
  const viewAs = !peeking && !!viewAsGroupSnapshot();
  return {
    // The group home is "home" (section 6); the group's dashboards are "group".
    product: o.product ?? "group",
    dashboard: { id: o.dashboard.id, name: o.dashboard.name, versionId: o.dashboard.versionId ?? null },
    scope: { kind: "group", id: o.groupId, name: o.name, ref: o.ref },
    role: o.role ?? "head_office",
    viewAs,
    peek: peeking,
    noteScope: peeking ? null : groupNoteScope(o.groupId, viewAs),
    state: o.state,
  };
}

/** A page's filters and pills as the state a feedback item records: plain values, objects as JSON. */
export function flatState(o: Record<string, unknown> | null | undefined, prefix = ""): State {
  const out: State = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) out[key] = null;
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = v;
    else out[key] = JSON.stringify(v).slice(0, 400);
  }
  return out;
}
