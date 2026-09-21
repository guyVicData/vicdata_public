Small follow-up to the round-5 gaps-and-ship work (`docs/vicdata_phase3_teacher_view_dashboard_card_mechanism_round5_gaps_and_ship_brief_v1.md`) — resolves the one open question it logged in `docs/OPEN_QUESTIONS.md`.

## Decision

Guy: hide independent special schools from Teacher view Rankings comparisons, the same way state special schools are already excluded.

## Why

Fixing the independent-schools phase-field bug (independents were matched on `phase = "Not applicable"` and so never appeared in any comparison; the fix joined by age range instead) surfaced this gap: state special schools are already filtered out of these comparator sets, but the same filter never applied to independent special schools, because independents weren't reachable by the old filter at all. Now that they are, the exclusion needs to cover both sectors consistently.

## What to build

Find wherever the existing state-special-school exclusion lives in the Rankings comparator logic (Nearest 10, same-sector, local rivals, similar-sized) and extend it to also exclude independent special schools, rather than adding a second, separate filter. Same treatment either way — excluded from being shown as a comparator and from being counted as a neighbour, not just hidden from the label.

## Verification

Confirm a real independent special school (find one in the data) no longer appears in any Rankings comparator set for a nearby mainstream school, the same way a state special school already doesn't. Confirm ordinary independent schools (Collège Français Bilingue, Channing, Highgate, etc.) are unaffected and still appear.

## Scope

This one filter only. Don't touch anything else from the round-5 work. Build, test, then commit and push under the same authorisation as the round-5 gaps-and-ship round — no separate review-before-push step needed.
