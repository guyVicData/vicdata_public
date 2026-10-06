select period, qual, count(*) from (
  select period, split_part(breakdown,'::',1) qual, entity_id, split_part(breakdown,'::',2) s, split_part(breakdown,'::',4) g
  from canonical_facts_current where source_id in ('dfe_ks5_subject_results','dfe_ks5_subject_results_historic') and value_numeric > 0
    and split_part(breakdown,'::',2) <> 'All subjects' and split_part(breakdown,'::',4) not in ('Total','Total exam entries')
  group by 1,2,3,4,5 having count(*) > 1) x group by 1,2 order by 1,3 desc
