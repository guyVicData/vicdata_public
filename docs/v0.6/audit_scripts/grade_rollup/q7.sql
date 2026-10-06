select period, split_part(breakdown,'::',1) q, split_part(breakdown,'::',4) g, count(*), sum(value_numeric), count(*) filter (where value_numeric>0) nz
from canonical_facts_current
where source_id='dfe_ks5_subject_results_historic' and split_part(breakdown,'::',4) in ('COVID result','Supp','*','D','M','P','**','DD','HM','Pass')
group by 1,2,3 order by 1,3,2
