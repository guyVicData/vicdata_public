select period, qualification_type,
  round(100*sum(entries) filter (where grade in ('*','A*'))/sum(entries) filter (where grade in ('*','A*','A','B','C','D','E','U','Fail')),1) astar_pct,
  round(100*sum(entries) filter (where grade in ('7','8','9'))/nullif(sum(entries) filter (where grade in ('1','2','3','4','5','6','7','8','9','U')),0),1) g7_pct,
  round(100*sum(entries) filter (where grade in ('4','5','6','7','8','9'))/nullif(sum(entries) filter (where grade in ('1','2','3','4','5','6','7','8','9','U')),0),1) g4_pct
from academic_subject_grade_rollup where qualification_type in ('GCE A level','GCSE (9-1) Full Course') group by 1,2 order by 2,1
