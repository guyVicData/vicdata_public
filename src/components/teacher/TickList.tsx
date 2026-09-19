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
};

export function TickList({
  items,
  checked,
  onToggle,
  empty,
  maxHeightClass = "max-h-72",
}: {
  items: TickItem[];
  checked: (key: string) => boolean;
  onToggle: (key: string) => void;
  empty?: ReactNode;
  maxHeightClass?: string;
}) {
  return (
    <div className={`${maxHeightClass} overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800`}>
      {items.length === 0 && <p className="px-3 py-3 text-sm text-neutral-500">{empty ?? "Nothing to choose from here."}</p>}
      {items.map((i) => (
        <label
          key={i.key}
          className="flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 dark:border-neutral-900"
        >
          <input type="checkbox" checked={checked(i.key)} disabled={i.disabled} onChange={() => onToggle(i.key)} />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{i.label}</span>
            {i.sublabel && <span className="block truncate text-[11px] text-neutral-500">{i.sublabel}</span>}
          </span>
          {i.trailing !== undefined && <span className="shrink-0 tabular-nums text-neutral-500">{i.trailing}</span>}
        </label>
      ))}
    </div>
  );
}
