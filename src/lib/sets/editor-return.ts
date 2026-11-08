// The browser half of the set editor's way back (the rules are in return-to.ts, tested there).
//   leaveEditor   Back, Cancel, Save, Archive and Delete all leave through this: one step back when the
//                 previous page in this tab is the origin, else replace the editor's history entry.
//   savedSetFromEditor   the origin's side: the id Save handed over (or `useSet` in the address).
//   useEditorReturnReload   an origin restored from the back-forward cache after a Save reloads, so it
//                 draws the saved set (a reload adds no history).
import { useEffect } from "react";
import { hasHandover, planLeave, takeHandover, withSchool, writeHandover } from "./return-to";

const UUID = /^[0-9a-f-]{36}$/i;
const here = () => `${window.location.pathname}${window.location.search}`;

export function leaveEditor(returnTo: string, fallback: boolean, savedId?: string | null): void {
  const plan = planLeave({ returnTo, fallback, referrer: document.referrer, origin: window.location.origin, historyLength: window.history.length, savedId });
  if (plan.how === "replace") {
    window.location.replace(plan.href);
    return;
  }
  if (savedId) {
    try {
      writeHandover(window.sessionStorage, returnTo, savedId);
    } catch {
      // Storage blocked: the origin keeps the set it had.
    }
  }
  window.history.back();
  // Nothing to go back to after all (a tab that opened straight onto the editor but kept a referrer):
  // replace instead. Cancelled if the page goes, so a restored editor never fires it later.
  const late = planLeave({ returnTo, fallback: true, referrer: "", origin: window.location.origin, historyLength: 1, savedId });
  const t = window.setTimeout(() => late.how === "replace" && window.location.replace(late.href), 700);
  window.addEventListener("pagehide", () => window.clearTimeout(t), { once: true });
}

// Taken once per page load, then remembered, so every reader on the page (and React's double-run in
// development) agrees, and a refresh -- a new page load, the handover gone -- finds nothing.
let taken: string | null | undefined;

/** The set the editor saved for this page: `useSet` in the address, else the handover. Once per load. */
export function savedSetFromEditor(): string | null {
  if (typeof window === "undefined") return null;
  if (taken !== undefined) return taken;
  const fromUrl = new URLSearchParams(window.location.search).get("useSet");
  let id: string | null = fromUrl && UUID.test(fromUrl) ? fromUrl : null;
  try {
    const handed = takeHandover(window.sessionStorage, here());
    id = id ?? handed;
  } catch {
    // Storage blocked.
  }
  taken = id;
  return id;
}

/** For tests: forget what this page load took. */
export function resetSavedSetForTests(): void {
  taken = undefined;
}

export function useEditorReturnReload(): void {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      try {
        if (hasHandover(window.sessionStorage, here())) window.location.reload();
      } catch {
        // Storage blocked.
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
}

/** An entry point's own address, as the editor's `returnTo`: this page, with its school named. */
export function returnToHere(urn: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return withSchool(`${window.location.pathname}${window.location.search}${window.location.hash}`, urn);
}

/** A set menu's Manage sets: the library for this school, with this page as it stands (its set choice
 * and filters included) as the way back. On the server (no page yet) the plain address. */
export function manageHrefHere(base: string, urn: string | null | undefined): string {
  if (typeof window === "undefined") return base;
  const url = new URL(base, window.location.origin);
  if (urn && !url.searchParams.has("urn")) url.searchParams.set("urn", urn);
  url.searchParams.set("returnTo", urn ? returnToHere(urn, here()) : here());
  return `${url.pathname}${url.search}`;
}
