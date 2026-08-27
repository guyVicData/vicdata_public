// UNUSED as of 2026-08-27 -- flagged, not deleted. Built 2026-08-25 as a pluggable
// "key stat" seam so a future topic could supply its own hover-popup content without
// SchoolMap.tsx's drawing code changing. Superseded by that round's own popup/card
// content redesign (point d): the popup structure is now a fixed, explicit field
// list (name, total roll, then member-tier age bands + gender split) built directly
// in SchoolMap.tsx's own buildPopupHtml -- a single formattable "stat" no longer
// covers what the popup shows. Confirmed via grep before this note was added:
// nothing calls ROLL_HOVER_STAT or imports HoverStat any more. Left in place rather
// than removed in case a future topic wants a similar pluggable-content seam for
// ITS OWN popup fields -- delete for real only once that's been decided against, not
// by default.
export type HoverStat = {
  format: (value: number) => string;
};

export const ROLL_HOVER_STAT: HoverStat = {
  format: (value) => `${value.toLocaleString()} pupils`,
};
