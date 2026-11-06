#!/usr/bin/env bash
# VicData 0.8 feedback deploy gate: the reports' "set fixed" step (it replaces "mark done"). It writes.
#
#   scripts/feedback-set-fixed.sh <commit> <F-number> [<F-number> ...]
#   scripts/feedback-set-fixed.sh "$(git rev-parse --short=12 HEAD)" F-22 F-23 F-26
#
# Sets the items to `fixed` with the commit, and nothing else: never `deployed` (the live build sets that,
# record_app_build) or `done` (a live "Looks good", or the inbox's "Checked live"). Checks first:
#   * this checkout is linked to the app database (supabase/.temp/project-ref = lnhulykjlxmoneappnsp);
#   * the commit is on GitHub's main (merged and pushed);
# and only moves items that are still open and not yet fixed (new, triaged, planned), so running it twice
# changes nothing.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_REF="lnhulykjlxmoneappnsp"
REPO="https://github.com/guyVicData/vicdata_public.git"

if [ "$#" -lt 2 ]; then
  echo "Usage: scripts/feedback-set-fixed.sh <commit> <F-number> [<F-number> ...]" >&2
  exit 2
fi
commit="$1"; shift

ref="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [ "$ref" != "$APP_REF" ]; then
  echo "Refused: this checkout is linked to '${ref:-nothing}', not the app database ($APP_REF)." >&2
  exit 3
fi
if ! [[ "$commit" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "Refused: '$commit' isn't a git sha (7 characters or more)." >&2
  exit 2
fi
full="$(git rev-parse --verify --quiet "${commit}^{commit}" || true)"
if [ -z "$full" ]; then
  echo "Refused: $commit isn't in this checkout." >&2
  exit 3
fi
git fetch --quiet "$REPO" main
if ! git merge-base --is-ancestor "$full" FETCH_HEAD; then
  echo "Refused: $commit isn't on GitHub's main yet. Merge and push first." >&2
  exit 3
fi

numbers=()
for f in "$@"; do
  n="${f#F-}"; n="${n#f-}"
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then
    echo "Refused: '$f' isn't an F-number." >&2
    exit 2
  fi
  numbers+=("$n")
done
list="$(IFS=,; echo "${numbers[*]}")"
short="${full:0:12}"

supabase db query --linked "update public.feedback_items set status = 'fixed', resolved_commit = '$short' where number in ($list) and status in ('new', 'triaged', 'planned')"
supabase db query --linked "select ref, status, resolved_commit, resolved_at::date, deployed_build from feedback_for_triage where number in ($list) order by number"
