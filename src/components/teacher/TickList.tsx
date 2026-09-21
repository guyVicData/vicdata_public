"use client";

// Teacher view, Phase 10: the one tick-list pattern (design brief v2 §14).
//
// §14's first principle is "radical visual consistency -- pixel-identical position, icon,
// and colour language everywhere a pattern appears. Confirmed as vital." And §7 describes
// the view builder's list as "the same gesture as the subject picker".
//
// Three lists in this build use that gesture: picking subjects you teach, picking views to
// pin to a card, and picking slides for a meeting deck. They were three separate blocks of
// markup that looked alike, which is exactly how "pixel-identical" quietly stops being
// true -- one gets a padding tweak and nothing catches it. There is now one component, so
// consistency is structural rather than maintained by hand.
import type { ReactNode } from "react";

export type TickItem = {
  key: string;
  label: ReactNode;
  sublabel?: ReactNode;
  // The right-hand figure. Deliberately part of the pattern rather than a caller's extra:
  // §14's "comparisons and context, everywhere" means a pickable thing should say how big
  // it is at the moment you pick it, not after.
  trailing?: ReactNode;
  disabled?: boolean;
  // The colour a checked row takes. Optional: a caller with a meaningful per-item colour
  // (the view builder colours each view by its subject's qualification group) passes it;
  // everyone else gets the list's `accent`.
  color?: string;
};

export function TickList({
  items,
  checked,
  onToggle,
  empty,
  maxHeightClass = "max-h-72",
  // Default checked-row colour: the phase accent where the list sits inside a themed
  // Teacher view page, otherwise the site's ordinary link blue.
  accent = "var(--accent, #2563eb)",
}: {
  items: TickItem[];
  checked: (key: string) => boolean;
  onToggle: (key: string) => void;
  empty?: ReactNode;
  maxHeightClass?: string;
  accent?: string;
}) {
  return (
    // contain: inline-size -- rows truncate their labels (white-space: nowrap), and without
    // containment that full-length label becomes the list's minimum width. Inside the
    // app's flex-column <body> a centred <main> sizes to its content, so opening a list
    // with a long view name on a phone widened the whole page past the screen (measured:
    // 472px on a 420px viewport). Containment keeps the list at whatever width it is given.
    <div className={`${maxHeightClass} overflow-y-auto rounded-md border border-neutral-200 [contain:inline-size] dark:border-neutral-800`}>
      {items.length === 0 && <p className="px-3 py-3 text-sm text-neutral-500">{empty ?? "Nothing to choose from here."}</p>}
      {items.map((i) => {
        // A checked row carries real visual weight -- a 3px coloured left edge and a faint
        // tint of the same colour -- matching the onboarding picker's checked rows, rather
        // than a ticked box on an otherwise identical grey row. Unchecked rows keep a
        // transparent edge so ticking never shifts the text.
        const on = checked(i.key);
        const c = i.color ?? accent;
        return (
        <label
          key={i.key}
          className="flex cursor-pointer items-center gap-3 border-b border-l-[3px] border-b-neutral-100 px-3 py-2 text-sm transition-colors last:border-b-0 dark:border-b-neutral-900"
          style={{
            borderLeftColor: on ? c : "transparent",
            background: on ? `color-mix(in srgb, ${c} 10%, transparent)` : undefined,
          }}
        >
          <input type="checkbox" checked={on} disabled={i.disabled} onChange={() => onToggle(i.key)} style={{ accentColor: c }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{i.label}</span>
            {i.sublabel && <span className="block truncate text-[11px] text-neutral-500">{i.sublabel}</span>}
          </span>
          {i.trailing !== undefined && <span className="shrink-0 tabular-nums text-neutral-500">{i.trailing}</span>}
        </label>
        );
      })}
    </div>
  );
}
