"use client";

// VicData 0.8 notes and feedback: a feedback item's Open link (src/lib/view-ref.ts feedbackOpenHref)
// names the panel and the view in it to open (?fbPanel=, ?fbView=). The panel that matches -- a
// RailPanel, or a Teacher column's card -- switches its rail to that view and is scrolled into sight
// and marked for a moment, once per page load. What the address can't restore, the banner shows.
import { useState } from "react";
import { FB_PANEL_PARAM, FB_VIEW_PARAM } from "@/lib/view-ref";

let taken = false;

function read(): { panel: string | null; view: string | null } {
  if (typeof window === "undefined") return { panel: null, view: null };
  const sp = new URLSearchParams(window.location.search);
  return { panel: sp.get(FB_PANEL_PARAM), view: sp.get(FB_VIEW_PARAM) };
}

export function useReopenRequest() {
  const [req] = useState(read);
  return {
    ...req,
    /** True once, for the panel the link names. */
    take(panelId: string): boolean {
      if (taken || !req.panel || req.panel !== panelId) return false;
      taken = true;
      return true;
    },
    /** Scroll the panel into view and mark it briefly. */
    reveal(selector: string) {
      const go = () => {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.setAttribute("data-reopened", "");
        window.setTimeout(() => el.removeAttribute("data-reopened"), 4000);
      };
      window.setTimeout(go, 300);
    },
  };
}
