with f as (
  select entity_id, period,
    case when source_id like 'dfe_ks4%' then 'ks4' else 'ks5' end ks_stage,
    string_to_array(breakdown,'::') p, value_numeric v
  from canonical_facts_current
  where source_id in ('dfe_ks4_subject_entries','dfe_ks4_subject_entries_historic','dfe_ks5_subject_results','dfe_ks5_subject_results_historic','dfe_tlevel_results')
), fk as (
  select entity_id, ks_stage, p[2] subject, p[1] qualification_type, p[array_length(p,1)] grade, period, sum(v) entries, count(*) n_size_rows
  from f
  where array_length(p,1) >= 3 and p[2] <> 'All subjects'
    and p[array_length(p,1)] not in ('Total','Total number entered','Total exam entries')
    and (p[1],p[2]) not in (('International Baccalaureate','Baccalaureate'),('International Baccalaureate Combined Certificate','Baccalaureate'),('Other academic','Baccalaureate'),('IBO Diploma Programme Core','Learning Skills'),('IBO Diploma Programme Core','Study Skills'),('IBO Diploma Programme Core','Self Development'),('Other academic','Learning Skills'),('Other academic','Self Development'))
    and coalesce(v,0) > 0
  group by 1,2,3,4,5,6
), j as (
  select coalesce(fk.ks_stage, r.ks_stage) ks_stage, coalesce(fk.period, r.period) period,
    fk.entries fe, r.entries re, fk.n_size_rows
  from fk full outer join academic_subject_grade_rollup r
    using (entity_id, ks_stage, subject, qualification_type, grade, period)
)
select ks_stage, period, count(*) keys,
  count(*) filter (where fe = re) equal,
  count(*) filter (where fe is null) rollup_only,
  count(*) filter (where re is null) facts_only,
  count(*) filter (where fe <> re) differ,
  count(*) filter (where n_size_rows > 1) keys_summed_over_sizes,
  sum(fe) facts_entries, sum(re) rollup_entries
from j group by 1,2 order by 1,2
