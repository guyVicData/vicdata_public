Read docs/vicdata_phase3_academic_results_qualification_row_ux_fixes_brief_v1.md in full
and execute it. Five real issues from a live click-through of Capital City College (URN
130421) -- the first time anyone has actually watched this page render in this whole
qualification-bucket arc, and it found real gaps code review alone hadn't caught.

1. QualificationRow hides its own "Qualification" label together with KsStageSwitcher
whenever a school has only one real stage (stages.length <= 1), so a Post-16-only college
like Capital City College shows unlabelled TYPE pills with no "Qualification" heading and
no stage indicator at all. Fix so the label and a plain non-interactive "Post-16" (or
whichever real single stage) indicator still show.

2. Ks5TypeSwitcher has no reset control -- once a TYPE pill is clicked there is no way back
to the real default (ks5Bucket === null). Add an "All" pill that returns to null, and check
whether any `?? "alevel"` fallback elsewhere in the same file changes behaviour when "All" is
explicitly clicked versus the untouched initial state -- they may already be fine, confirm
rather than assume.

3. Ks5TypeSwitcher renders all five bucket pills unconditionally, so a school with zero real
entries for a bucket (e.g. Capital City College has no real IB) still shows that bucket as
clickable. ks5HasBucketEntries() already exists and is already used for comparator-group
exclusion elsewhere in this same file -- apply it to filter which pills render for the
target school. Keep "All" always present regardless of this filter.

4. Confirm live, not just by code read, that switching the TYPE pill (including the new
"All") actually changes the target school's own headline entries figure, its own headline
results/points figure, and the trend charts below -- not only the comparator-group figures,
which are a different code path. Also confirm the "Other" bucket's no-points-figure note
still renders correctly with "All" now in the mix.

5. Real bug, root cause already found: in SubjectDeepDiveDrawer.tsx, allSubjectNames (which
drives the empty-state branch and the subject count in its message) comes from
headlineByUrn, which is NOT filtered by the active bucket -- while listedSubjects, the rows
actually shown, IS bucket-filtered via scopedSubjectByUrn. That's why Capital City College's
Arts, Media & Design category, filtered to BTec & OCR, shows "No entries data for the 27
subjects in this category yet" -- 27 is every qualification type combined, completely
unscoped to the filter that emptied the list. Fix the message to reflect the active bucket
honestly (e.g. "No BTec & OCR entries for this category at this school") instead of an
unfiltered count with "yet" wording that implies missing data. Separately: Capital City
College has exactly one real BTEC entry in this category (BTEC National Foundation Diploma
L3, subject "Multimedia", count 1) -- check directly whether rowFor()'s candidates !== null
filter is wrongly dropping that one real row, or correctly excluding it for a genuine reason
(e.g. no matching period/headline pairing). Report which; if it's being wrongly dropped,
that's a second, separate bug to fix.

Check all five live against Capital City College, and #1/#2/#4 against at least one other
school with multiple stages and multiple real buckets too, so the fixes don't just work for
the single-stage case they were found on. Full build report covering all five, including
the real answer on the Multimedia entry. Commit and push once verified.
