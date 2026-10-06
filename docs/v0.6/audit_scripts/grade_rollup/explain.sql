explain (analyze, buffers) select * from academic_subject_grade_rollup where entity_id='137625' and ks_stage='ks4' and subject='History';
explain (analyze, buffers) select * from academic_subject_grade_rollup where entity_id='137625' and ks_stage='ks4';
explain (analyze, buffers) select * from academic_subject_grade_rollup where entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}') and ks_stage='ks4' and subject='History';
explain (analyze, buffers) select * from academic_subject_grade_rollup where entity_id = any('{117037,117038,117041,117034,147783,117002,117003,117012,145493,134463,117020}') and ks_stage='ks5' and subject='Mathematics';
explain (analyze, buffers) select * from academic_subject_grade_rollup where ks_stage='ks4' and subject='History' and period=2024;
explain (analyze, buffers) select * from academic_subject_grade_rollup where ks_stage='ks4' and subject='History';
explain (analyze, buffers) select * from canonical_facts_current where source_id in ('dfe_ks4_subject_entries','dfe_ks4_subject_entries_historic') and entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}')
