with s as (
  select entity_id, subject, qualification_type q, period,
    bool_or(grade in ('COVID result','Supp')) has_covid_supp,
    bool_or(grade in ('*','**','***','*D','**D','*DD','D','DD','DDD','DDM','DM','DMM','M','MM','MMM','MMP','MP','MPP','P','PP','PPP','HM','HP')) has_short
  from academic_subject_grade_rollup where ks_stage='ks5' and period in (2021,2022) group by 1,2,3,4
)
select period,
  case when q in ('GCE A level','GCE AS level','Advanced Extension Award','Core Maths Qualifications at Level 3','Extended Project (Diploma)','Free standing Maths Qual Level 3') then 'A-level family / EPQ / Core Maths'
       when q ~ '^(BTEC|OCR|VRQ|Other General)' then 'BTEC / OCR / VRQ / other'
       else 'IB / Pre-U / other' end fam,
  count(*) sets, count(*) filter (where has_covid_supp) with_covid_or_supp,
  count(*) filter (where has_short and q !~ '^(GCE|Advanced|Core|Extended|Free)') vocational_with_short_codes
from s group by 1,2 order by 1,2
