"use client";

// VicData 0.8 SMT feedback round 2, section 6 (R-FEEDBACK-PAGE): feedback on a whole page -- its menus, nav,
// comparison-set bar, level chips and pills, layout, banner, the home page -- in the same feedback system.
//   * FooterPageFeedback: "Feedback on this page", in the site footer next to Edit, for those the feedback
//     setting lets in (admins for now), on any page that has said what it is. Its colour follows the view
//     rules: yellow with the viewer's open page feedback, green once marked "Looks good", else monochrome.
//   * PageSurface: what a page without views (the role homes, the group home, the Data View) says it is, and
//     the one feedback window for it. A dashboard's ViewSurfaceProvider says it for its own page.
import { useEffect } from "react";
import { feedbackColour, pageKey, scopeKey, type ViewSurface } from "@/lib/view-ref";
import { loadFeedback, marksFor, openPageFeedback, setPageSurface, useFeedbackState } from "./store";
import { FeedbackIcon } from "./FeedbackButton";
import { FeedbackWindow } from "./FeedbackWindow";
import { FeedbackOpenBanner } from "./FeedbackOpenBanner";
import { useFirstHost } from "./ViewSurface";

// The footer sits outside #teacher-root, where the --fb-* tokens live: the same two colours, light and dark.
const COLOUR = { open: "text-[#b7860b] dark:text-[#f5c542]", good: "text-[#1f8a4c] dark:text-[#4ade80]", none: "" } as const;
const TITLE = { open: "You have open feedback on this page", good: "You marked this page Looks good", none: "Give feedback on this page as a whole: menus, the bar, pills, layout" } as const;

export function FooterPageFeedback() {
  const { allowed, items, page, target } = useFeedbackState();
  if (!allowed || !page) return null;
  const key = pageKey(page.dashboard.id);
  const colour = feedbackColour(marksFor(items, key), scopeKey(page.scope));
  return (
    <button
      type="button"
      onClick={() => openPageFeedback(page)}
      aria-expanded={target?.viewKey === key}
      title={TITLE[colour]}
      data-page-feedback={colour}
      data-fb-key={key}
      className={`ml-4 inline-flex items-center gap-1 align-middle leading-none hover:text-neutral-900 dark:hover:text-neutral-100 print:hidden ${COLOUR[colour]}`}
    >
      {FeedbackIcon}
      Feedback on this page
    </button>
  );
}

/** Says which page this is (it changes only when the surface does). */
export function useRegisterPage(surface: ViewSurface | null, enabled = true) {
  const json = surface ? JSON.stringify(surface) : null;
  useEffect(() => {
    if (!enabled || !json) return;
    setPageSurface(JSON.parse(json) as ViewSurface);
    return () => setPageSurface(null);
  }, [json, enabled]);
}

/** A page without views: its surface, the feedback read and the one window. */
export function PageSurface({ surface }: { surface: ViewSurface }) {
  useEffect(() => {
    void loadFeedback();
  }, []);
  useRegisterPage(surface);
  const host = useFirstHost();
  return host ? (
    <>
      <FeedbackWindow />
      <FeedbackOpenBanner surface={surface} />
    </>
  ) : null;
}
