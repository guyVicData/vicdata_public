select s.entry_point, s.name, s.kind, s.audience, s.creator_kind, s.is_default, s.pinned,
       (select count(*) from set_members m where m.set_id = s.id) as schools,
       (select cardinality(l.members) from admissions_lists l where l.id = s.legacy_list_id) as old_count,
       s.rule is not null as has_rule
from sets s order by s.entry_point, s.kind, s.audience;
