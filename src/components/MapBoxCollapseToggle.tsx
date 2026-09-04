"use client";

// Shared minimise/expand toggle button for the map overlay boxes (Filters, Colour
// by, Size) -- 2026-10-02, item 4. One shared component so the button's own style
// and position stay identical across all three rather than three independently
// hand-rolled toggles drifting apart over time. A small chevron, top-right of the
// box's own title row: pointing down when expanded (the box's content is "open
// below"), rotated to point right when collapsed (the box's content is "off to the
// side, click to open it") -- collapsed state shows just the title + this arrow,
// per Guy's own spec.
export default function MapBoxCollapseToggle({
  collapsed,
  onToggle,
  label,
}: {
  collapsed: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      aria-expanded={!collapsed}
      className="-m-1 shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" />
      </svg>
    </button>
  );
}
