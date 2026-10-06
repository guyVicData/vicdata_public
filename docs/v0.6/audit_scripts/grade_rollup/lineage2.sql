with cp as (
  select sl.urn, min(sl.link_urn) pred from school_lineage sl where sl.link_type='Predecessor'
  group by sl.urn having count(distinct sl.link_urn)=1
), r as (
  select entity_id, ks_stage, bool_or(period>=2023) has_modern, bool_or(period<=2022) has_hist
  from academic_subject_grade_rollup group by 1,2
)
select p.ks_stage, count(*) urns_with_no_own_rows_whose_pred_has_modern
from cp join r p on p.entity_id=cp.pred and p.has_modern
where not exists (select 1 from r o where o.entity_id=cp.urn and o.ks_stage=p.ks_stage)
group by 1
