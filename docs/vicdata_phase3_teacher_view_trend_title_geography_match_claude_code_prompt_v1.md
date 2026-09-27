# Teacher view: Trend caption becomes a title, Geography gets the same title (Claude Code prompt v1)

Three decisions from Guy's review of the qualification-match/Indexed-Actual round.

## 1. The Indexed/Actual explanation is a title, not a caption

Right now `TrendScaleCaption` reads as a small, muted caption under the panel's heading.
Guy's call: promote it to a title -- the weight and prominence a heading gets, not a
caption's. Practically: match whatever text style the panel's own "Entries in {category}"
heading already uses (or the nearest thing to it that reads as a title rather than a
footnote), for both the Indexed and Actual wording. This applies everywhere
`TrendScaleCaption` is used -- Column 1 Candidates and Context, both via `SubjectPanels`.

Keep the legend's existing "100 = first year shown" entry exactly as it is -- Guy wants
both, even though the new title says the same thing in fuller words. Don't trim it.

## 2. Both columns in one round: confirmed, no change

Landing §3 in both Column 1 and Context in the same round is the right call -- nothing to
revert or stage separately.

## 3. Match the title in Geography's % Change chart

`GeographyComparison`'s % Change chart (LA/region/England lines) indexes entries through
`MultiTrend` the same way Trend does, but currently has neither a title nor an Actual
view. Guy's call: give it the same title Trend now has (same wording pattern, same
title-not-caption styling), so a teacher reads the same explanation wherever an
indexed-to-100 chart appears.

Scoped to the title only this round -- Guy didn't ask for an Actual toggle on Geography,
so don't add one unless it falls out of the shared plumbing for free and you think it's
worth flagging rather than building; say so in the report either way rather than deciding
silently.

## Build report

Confirm the title's new styling reads clearly beside the panel heading at laptop and
phone width (the caption's old three-line wrap on a phone is the thing to watch -- a title
needs to survive that too, or wrap sensibly). Confirm Geography's new title renders
correctly against real LA/region/England data, and state your call on the Actual-toggle
question rather than leaving it unaddressed.
