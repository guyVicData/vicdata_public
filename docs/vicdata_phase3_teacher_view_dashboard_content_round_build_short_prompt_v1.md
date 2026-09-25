Read docs/vicdata_phase3_teacher_view_dashboard_content_round_build_brief_v1.md and
docs/vicdata_phase3_teacher_view_dashboard_content_round_build_claude_code_prompt_v1.md in
full, then execute the prompt's eight parts in the order it gives, in one pass: (1) main
qualification badge icon, Export-as-icon, the "Av. Points" tag, and the three GCSE
Comparisons data bugs; (2) kill "All" -- single subject always focused; (3) Column 1's
category-taxonomy comparison plus the England-average extension at GCSE; (4) Context dropping
its "area" option; (5) Comparisons showing the real school name, highlighted, scrolled into
view; (6) the accordion open/shut panel mechanism replacing "+Add"/"x"; (7) the heading
restructuring across all three columns; (8) moving the Trend-line toggle and the growth/decline
message into each panel's footer row. Confirm every real location named in the docs before
writing anything -- several parts reuse machinery Context already built (contextMembers/
groupValueFor's "area" grouping) rather than needing new logic. One build report covering all
eight parts, flagging any open decisions (Part 6's accordion markup especially). Commit per
part, vicdata_public only.
