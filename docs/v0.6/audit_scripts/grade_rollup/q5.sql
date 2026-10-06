with f as (
  select source_id, period, breakdown, value_numeric v, value_text,
    string_to_array(breakdown,'::') p
  from canonical_facts_current
  where source_id in ('dfe_ks4_subject_entries','dfe_ks4_subject_entries_historic','dfe_ks5_subject_results','dfe_ks5_subject_results_historic','dfe_tlevel_results')
), c as (
  select source_id, period, v, value_text,
    case
      when array_length(p,1) < 3 then 'short'
      when p[2]='All subjects' then 'all_subjects'
      when p[array_length(p,1)] in ('Total','Total number entered','Total exam entries') then 'total_label'
      when (p[1],p[2]) in (('International Baccalaureate','Baccalaureate'),('International Baccalaureate Combined Certificate','Baccalaureate'),('Other academic','Baccalaureate'),('IBO Diploma Programme Core','Learning Skills'),('IBO Diploma Programme Core','Study Skills'),('IBO Diploma Programme Core','Self Development'),('Other academic','Learning Skills'),('Other academic','Self Development')) then 'ib_nonsubject'
      when v is null then 'null_value'
      when v <= 0 then 'zero'
      else 'grade' end cls
  from f
)
select source_id, period, cls, count(*) n, sum(v) entries, count(*) filter (where value_text is not null) n_text,
  string_agg(distinct value_text, ',') filter (where v is null) null_texts
from c group by 1,2,3 order by 1,2,3
