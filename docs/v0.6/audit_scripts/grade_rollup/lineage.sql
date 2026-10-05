with cp as (
  select sl.urn, min(sl.link_urn) pred from school_lineage sl where sl.link_type='Predecessor'
  group by sl.urn having count(distinct sl.link_urn)=1
), r as (
  select entity_id, ks_stage, bool_or(period>=2023) has_modern, bool_or(period<=2022) has_hist
  from academic_subject_grade_rollup group by 1,2
)
select r.ks_stage,
  count(*) filter (where has_modern) schools_with_modern,
  count(*) filter (where has_modern and not has_hist) modern_no_hist,
  count(*) filter (where has_modern and not has_hist and exists (select 1 from r r2 where r2.entity_id=cp.pred and r2.ks_stage=r.ks_stage and r2.has_hist)) gain_hist_via_pred
from r left join cp on cp.urn=r.entity_id
group by 1
