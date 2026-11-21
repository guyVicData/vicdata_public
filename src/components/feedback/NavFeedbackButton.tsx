"use client";

// VicData 0.8 nav consistency, part 2 (Guy, 21 Nov; R-NAV-FEEDBACK): "Send feedback" in the one nav, for the beta
// testers. It is the existing page feedback (R-FEEDBACK-PAGE), nothing new: the same icon as every view's and the
// footer's (FeedbackIcon), the same store, window, API and storage, the same audience setting.
//   * Who sees it: whoever the audience setting lets give feedback (feedback_allowed(): "admins" today, then
//     "beta" -- the named testers -- then "all"). Shown to anyone else, Send could only fail with "Feedback isn't
//     open to you yet", so it isn't drawn for them.
//   * What it opens: the window on the whole page. A page that already says what it is (a dashboard's
//     ViewSurfaceProvider, a home's PageSurface) is used as it is -- exactly what the footer's "Feedback on this
//     page" opens. Any other page (Sets, Account, Platform, People, an editor...) is described here from its
//     address and the school it is for: navSurface below.
//   * Where the window comes from: a page with a surface already draws the one window; on any other page this
//     button draws it (only while no surface does).
// Amber, traffic-light amber, so testers find it: the amber fill with dark ink on it (11:1), and in Light a darker
// amber edge so the button still stands off a white bar (R-NAV-FEEDBACK's contrast pairs).
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { loadFeedback, openPageFeedback, useFeedbackState } from "./store";
import { FeedbackIcon } from "./FeedbackButton";
import { FeedbackWindow } from "./FeedbackWindow";
import { useHostCount } from "./ViewSurface";
import { getActiveViewAs, readPeek } from "@/lib/view-as";
import { pageKey, type ViewProduct, type ViewSurface } from "@/lib/view-ref";
import { loadAdminSchool } from "@/components/admin/AdminChrome";

export const NAV_FEEDBACK_LABEL = "Send feedback";
/** Traffic-light amber, and the ink and edges on it (the contrast test reads these). */
export const NAV_FEEDBACK_COLOURS = { fill: "#ffbf00", ink: "#1f1300", edgeLight: "#a16207", edgeDark: "#ffbf00" } as const;

// The product a page item records (the column's own list, so nothing new is stored): by where the page is.
export function navProduct(path: string): ViewProduct {
  if (/^\/teacher\/smt(\/|$)/.test(path)) return "smt";
  if (/^\/teacher\/admissions(\/|$)/.test(path)) return "admissions";
  if (/^\/teacher\/group(\/|$)/.test(path)) return "group";
  if (/^\/teacher\/meetings(\/|$)/.test(path)) return "meeting";
  if (/^\/teacher\/(ks2|ks4|ks5|recruitment)(\/|$)/.test(path)) return "teacher";
  if (/^\/dashboards(\/|$)/.test(path)) return "custom";
  if (/^\/schools\/[^/]+\/data/.test(path)) return "dataview";
  return "home";
}

/** The page's name in the window and the inbox: its address in words ("Sets · guided", "Account"). */
export function navPageName(path: string): string {
  const parts = path.split("/").filter(Boolean).filter((p) => p !== "teacher");
  if (!parts.length) return "Home";
  const words = parts.map((p) => (/^[0-9a-f-]{20,}$|^\d+$/i.test(p) ? "one" : p.replace(/-/g, " ")));
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" · ");
}

/** A page that hasn't said what it is: the whole page, at the school it is for (a peek's, View as, else the
 * person's own). null when there is no school to tie it to (the item must name one). */
export function navSurface(o: { path: string; urn: string; name: string; role: string; viewAs: boolean; peek: boolean }): ViewSurface {
  return {
    product: navProduct(o.path),
    // `nav:` marks an item sent from the nav's button on a page without a surface of its own.
    dashboard: { id: `nav:${o.path}`, name: navPageName(o.path), versionId: null },
    scope: { kind: "school", urn: o.urn, name: o.name },
    role: o.role,
    viewAs: o.viewAs,
    peek: o.peek,
    noteScope: null,
    state: { page: o.path },
  };
}

async function fallbackSurface(path: string): Promise<ViewSurface | null> {
  const peek = readPeek(new URLSearchParams(window.location.search));
  if (peek) return navSurface({ path, urn: peek.urn, name: peek.urn, role: peek.role, viewAs: false, peek: true });
  const school = await loadAdminSchool();
  if (school.status !== "ready") return null;
  const va = getActiveViewAs();
  return navSurface({ path, urn: school.school.schoolUrn, name: school.school.schoolName, role: va ? va.role : "member", viewAs: !!va, peek: false });
}

// The nav can be drawn twice on a page (a dashboard's phone and desktop navs, one hidden): the first button drawn
// draws the window, never both.
let navHosts: number[] = [];
let nextNavHost = 1;
const navListeners = new Set<() => void>();
function useFirstNavHost(): boolean {
  const [id] = useState(() => nextNavHost++);
  useEffect(() => {
    navHosts = [...navHosts, id];
    navListeners.forEach((l) => l());
    return () => {
      navHosts = navHosts.filter((h) => h !== id);
      navListeners.forEach((l) => l());
    };
  }, [id]);
  return useSyncExternalStore(
    (l) => {
      navListeners.add(l);
      return () => navListeners.delete(l);
    },
    () => navHosts[0] === id,
    () => false,
  );
}

export function NavFeedbackButton({ className = "" }: { className?: string }) {
  const { allowed, page, target } = useFeedbackState();
  const path = usePathname() ?? "/";
  const hosts = useHostCount();
  const firstNav = useFirstNavHost();
  const [own, setOwn] = useState<ViewSurface | null>(null);
  useEffect(() => {
    void loadFeedback();
  }, []);
  // Only needed when the page has no surface: read once the store says this person may send feedback.
  useEffect(() => {
    if (!allowed || page) return;
    let live = true;
    void fallbackSurface(path).then((s) => live && setOwn(s));
    return () => {
      live = false;
    };
  }, [allowed, page, path]);
  const surface = page ?? own;
  if (!allowed || !surface) return null;
  const open = !!target?.page && target.viewKey === pageKey(surface.dashboard.id);
  return (
    <>
      <button
        type="button"
        data-nav-feedback=""
        onClick={() => openPageFeedback(surface)}
        aria-label={NAV_FEEDBACK_LABEL}
        aria-expanded={open}
        title={`${NAV_FEEDBACK_LABEL} on this page`}
        // 44 px to touch on a phone, the nav's 34 px row from sm up; the amber pill is drawn inside it.
        className={`group flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full outline-none sm:h-[34px] sm:min-w-[34px] ${className}`}
      >
        <span
          data-nav-feedback-pill=""
          className="flex h-[34px] min-w-[34px] items-center justify-center gap-1.5 rounded-full border border-[var(--nav-fb-edge)] bg-[var(--nav-fb-fill)] px-2 text-[12px] font-bold text-[var(--nav-fb-ink)] group-hover:brightness-105 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--fg)] sm:px-3 [&>svg]:h-4 [&>svg]:w-4"
        >
          {FeedbackIcon}
          <span className="hidden sm:inline">{NAV_FEEDBACK_LABEL}</span>
        </span>
      </button>
      {/* The one feedback window, when no surface on the page draws it. */}
      {hosts === 0 && firstNav && <FeedbackWindow />}
    </>
  );
}
