select source_id, period, array_length(string_to_array(breakdown,'::'),1) nseg,
  split_part(breakdown,'::',array_length(string_to_array(breakdown,'::'),1)) lbl, count(*), sum(value_numeric)
from canonical_facts_current
where source_id in ('dfe_ks4_subject_entries','dfe_ks4_subject_entries_historic','dfe_ks5_subject_results','dfe_ks5_subject_results_historic','dfe_tlevel_results')
group by 1,2,3,4 order by 1,2,3,4
