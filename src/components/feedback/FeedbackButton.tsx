"use client";

// VicData 0.8 notes and feedback (decision 4): a view's feedback icon -- a speech bubble with "!" -- in
// the panel's footer after the (i) and the note. Shown only to someone the audience setting lets give
// feedback (platform admins now). During build and pre-launch it changes colour (Guy, 18 Oct): yellow
// with open feedback from this person on this view (on any school), green once they have marked it
// "Looks good" here and nothing is open, monochrome otherwise. It opens the feedback window, outside
// the panel, tied to this view.
import type { RefObject } from "react";
import { feedbackColour, scopeKey, type ViewRef, type ViewSurface } from "@/lib/view-ref";
import { marksFor, openFeedback, useFeedbackState } from "./store";

const COLOUR = { open: "text-[var(--fb-open)]", good: "text-[var(--fb-good)]", none: "text-[var(--muted)]" } as const;
const TITLE = { open: "Feedback: you have open feedback on this view", good: "Feedback: you marked this view Looks good", none: "Give feedback on this view" } as const;

export const FeedbackIcon = (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 4.5h13v8.5H9l-3.5 3v-3h-2z" />
    <path d="M10 6.8v3" strokeWidth="1.9" />
    <circle cx="10" cy="11.6" r="0.35" fill="currentColor" strokeWidth="1.3" />
  </svg>
);

export function FeedbackButton({ surface, view, viewKey, anchor }: { surface: ViewSurface; view: ViewRef; viewKey: string; anchor?: RefObject<HTMLElement | null> }) {
  const { allowed, items, target } = useFeedbackState();
  if (!allowed) return null;
  const colour = feedbackColour(marksFor(items, viewKey), scopeKey(surface.scope));
  const open = target?.viewKey === viewKey;
  return (
    <button
      type="button"
      onClick={() => openFeedback({ surface, view, viewKey, anchor: anchor?.current ?? null })}
      aria-label={TITLE[colour]}
      aria-expanded={open}
      title={TITLE[colour]}
      data-feedback-button={colour}
      data-fb-key={viewKey}
      className={`flex h-[17px] w-[17px] items-center justify-center rounded-[5px] ${COLOUR[colour]} ${open ? "bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]" : ""} hover:text-[var(--fg)]`}
    >
      {FeedbackIcon}
    </button>
  );
}
