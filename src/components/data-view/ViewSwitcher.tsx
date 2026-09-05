"use client";

// Member Data View (brief §4): Map | Dashboard | Rankings | +Custom (visible,
// dashed/reserved, disabled -- a real menu slot, not hidden, per brief §3's explicit
// "Custom view... not built, not hidden, not clickable").

import type { ViewKey } from "@/lib/data-view-types";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "map", label: "Map" },
  { key: "dashboard", label: "Dashboard" },
  { key: "rankings", label: "Rankings" },
];

export default function ViewSwitcher({ active, onChange }: { active: ViewKey; onChange: (v: ViewKey) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-200 p-1 text-sm dark:border-neutral-800">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onChange(v.key)}
          className={
            active === v.key
              ? "rounded px-3 py-1 font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }
        >
          {v.label}
        </button>
      ))}
      <span
        className="ml-1 cursor-not-allowed rounded border border-dashed border-neutral-300 px-3 py-1 text-neutral-400 dark:border-neutral-700 dark:text-neutral-600"
        title="Custom view — coming soon"
      >
        + Custom
      </span>
    </div>
  );
}
