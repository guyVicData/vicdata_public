#!/usr/bin/env bash
# VicData 0.8 feedback deploy gate: the reports' "set fixed" step (it replaces "mark done"). It writes.
#
#   scripts/feedback-set-fixed.sh <commit> <F-number> [<F-number> ...] [--view <view_key> ...]
#   scripts/feedback-set-fixed.sh "$(git rev-parse --short=12 HEAD)" F-22 F-23 F-26
#   scripts/feedback-set-fixed.sh "$(git rev-parse --short=12 HEAD)" F-31 --view vicdata.admissions.pipelines:<panel>:<view>
#
# --view (repeatable; 0.8 Admissions feedback round 2): a view the fix ADDED or CHANGED, other than the item's
# own -- a "Looks good" there (a platform admin's, at the item's school, after the deploy) closes the item too
# (resolved_views, feedback_items_live_check). It applies to every F-number in the call, so run the script once
# per item when their views differ. It adds to the item's resolved_views (never removes), on any item not yet
# done or won't do. Leave it out when the fix is on the item's own view.
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
  echo "Usage: scripts/feedback-set-fixed.sh <commit> <F-number> [<F-number> ...] [--view <view_key> ...]" >&2
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
views=()
while [ "$#" -gt 0 ]; do
  f="$1"; shift
  if [ "$f" = "--view" ]; then
    if [ "$#" -lt 1 ]; then
      echo "Refused: --view needs a view key (dashboard:panel:view)." >&2
      exit 2
    fi
    v="$1"; shift
    # A view key, as feedback_items.view_key has it: dashboard:panel:view (or page:<dashboard>); no quotes or spaces.
    if ! [[ "$v" =~ ^[A-Za-z0-9._+/-]+:[A-Za-z0-9._:+/-]+$ ]]; then
      echo "Refused: '$v' isn't a view key (dashboard:panel:view)." >&2
      exit 2
    fi
    views+=("'$v'")
    continue
  fi
  n="${f#F-}"; n="${n#f-}"
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then
    echo "Refused: '$f' isn't an F-number." >&2
    exit 2
  fi
  numbers+=("$n")
done
if [ "${#numbers[@]}" -eq 0 ]; then
  echo "Refused: no F-number given." >&2
  exit 2
fi
list="$(IFS=,; echo "${numbers[*]}")"
short="${full:0:12}"

if [ "${#views[@]}" -gt 0 ]; then
  vlist="$(IFS=,; echo "${views[*]}")"
  # Before the status, so an item this run moves is fixed with its views already named. The database tidies
  # the list (no repeats, never the item's own view) and stamps it as triage.
  supabase db query --linked "update public.feedback_items set resolved_views = array(select distinct v from unnest(resolved_views || array[$vlist]::text[]) v order by v) where number in ($list) and status not in ('done', 'wont_do')"
fi

supabase db query --linked "update public.feedback_items set status = 'fixed', resolved_commit = '$short' where number in ($list) and status in ('new', 'triaged', 'planned')"
if [ "${#views[@]}" -gt 0 ]; then
  supabase db query --linked "select ref, status, resolved_commit, resolved_at::date, deployed_build, resolved_views from feedback_for_triage where number in ($list) order by number"
else
  supabase db query --linked "select ref, status, resolved_commit, resolved_at::date, deployed_build from feedback_for_triage where number in ($list) order by number"
fi
