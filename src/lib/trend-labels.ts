// Round 3 (Academic Map edit 2), A4: ONE shared source of truth for growth/decline
// wording, read by both Rolls' own GraphsView.tsx (which previously hardcoded its own
// inline adjective form -- "Growing"/"Declining"/"Broadly stable") and Academic's new
// Map popups/Rankings tiles (which need a NOUN form -- "Growth"/"Decline"/"No change",
// per Guy's own worked examples: "Decline -25pp", "Decline -15%"). Two real forms in
// one module, not two separately-maintained string sets that can silently drift.
//
// Keyed on trendBadge()'s own real `direction` values (data-view-cards.ts) -- "up"/
// "down"/"flat" -- so every existing caller of trendBadge already has the right key
// with no extra mapping step.
export type TrendDirection = "up" | "down" | "flat";

export const TREND_LABELS: Record<TrendDirection, { noun: string; adjective: string }> = {
  up: { noun: "Growth", adjective: "Growing" },
  down: { noun: "Decline", adjective: "Declining" },
  flat: { noun: "No change", adjective: "Broadly stable" },
};
