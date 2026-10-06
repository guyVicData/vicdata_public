select ks_stage, period, sum(entries) entries, count(distinct entity_id) schools, count(*) n from academic_subject_grade_rollup group by 1,2 order by 1,2;
select indexname, indexdef from pg_indexes where tablename in ('academic_subject_grade_rollup','canonical_facts');
select pg_size_pretty(pg_total_relation_size('academic_subject_grade_rollup')), (select reltuples from pg_class where relname='academic_subject_grade_rollup')
