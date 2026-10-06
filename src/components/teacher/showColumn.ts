// VicData 0.6.3 S1: bring a dashboard column into view -- the chip on Columns 2 and 3's titles
// ("Grade 9 · from your highlight") links back to Column 1. On a phone the columns are tabs
// (ConfigDashboard listens for this event and switches tab); on a laptop the column (and, when
// given, an element inside it) is scrolled into view.
export const SHOW_COLUMN_EVENT = "vicdata:show-column";

export function showColumn(index: number, inside?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHOW_COLUMN_EVENT, { detail: { index } }));
  // After the tab switch has rendered.
  requestAnimationFrame(() => {
    const columns = document.querySelectorAll<HTMLElement>("main:not([hidden]) [data-column-id]");
    const column = columns[index];
    const target = (inside ? column?.querySelector<HTMLElement>(inside) : null) ?? column;
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
