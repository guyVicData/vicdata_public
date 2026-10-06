select c.source_id, c.period, count(*) n_current,
  (select count(*) from canonical_facts f where f.source_id=c.source_id and f.period=c.period) n_all
from canonical_facts_current c
where c.source_id in ('dfe_ks4_subject_entries','dfe_ks4_subject_entries_historic','dfe_ks5_subject_results','dfe_ks5_subject_results_historic','dfe_tlevel_results')
group by 1,2 order by 1,2
