<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Dashboards

Seeded dashboard configs (src/catalogue/dashboards). 10 dashboards.

## GCSE Candidates (`vicdata.ks4.candidates`)

Owner vicdata · dashboard · layout 3 (auto-close) · group GCSE #0

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | Candidates | academic.candidates · ks4 | subject | subjects | teacher.c1.candidates |
| c2 | Context | academic.candidates · ks4 | subject | subjects | teacher.c2.context |
| c3 | Comparisons | academic.candidates · ks4 | subject | schools | teacher.c3.comparisons |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| current | Current | latest | yes |
| trends | Trends | over_time | no |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.ks4.candidates.c1.current | c1 | current | — | DV-C1-CAND-CUR-TILES | DV-C1-CAND-CUR-TILES |
| vicdata.ks4.candidates.c2.current | c2 | current | — | DV-C2-CUR-DONUT, DV-C2-CUR-BARS, DV-C2-CUR-LIST, DV-C2-CUR-TABLE | DV-C2-CUR-BARS |
| vicdata.ks4.candidates.c3.current | c3 | current | overridden: whole-school headline (ranking sets) (DV-C3-CUR-TILES shows the school's headline rank in a ranking set, not the focused subject.) | DV-C3-CUR-TILES, DV-C3-CUR-MAP, DV-C3-CUR-BAR, DV-C3-CUR-RANKING | DV-C3-CUR-MAP |
| vicdata.ks4.candidates.c1.trends | c1 | trends | overridden: LA, region, England (Combinations doc F2: Column 1's Trends shows its subject against LA, region and England (Area chart, Change table).) | DV-C1-CAND-TR-INDEXED, DV-C1-CAND-TR-ACTUAL, DV-C1-CAND-TR-TABLE, DV-C1-CAND-TR-GEO-CHART, DV-C1-CAND-TR-GEO-TABLE | DV-C1-CAND-TR-INDEXED |
| vicdata.ks4.candidates.c2.trends | c2 | trends | — | DV-C2-TR-INDEXED, DV-C2-TR-ACTUAL, DV-C2-TR-TABLE, DV-C2-TR-CHANGELIST, DV-C2-TR-CHANGETABLE | DV-C2-TR-INDEXED |
| vicdata.ks4.candidates.c3.trends | c3 | trends | — | DV-C3-TR-CHART, DV-C3-TR-TABLE, DV-C3-TR-MAP, DV-C3-TR-CHANGELIST, DV-C3-TR-CHANGETABLE, DV-C3-TR-CHANGEMAP | DV-C3-TR-CHART |

## GCSE Results (`vicdata.ks4.results`)

Owner vicdata · dashboard · layout 3 (auto-close) · group GCSE #1

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | Results | academic.results · ks4 · pill | subject | subjects, averages | teacher.c1.results |
| c2 | Context | academic.results · ks4 · pill | subject | subjects | teacher.c2.context |
| c3 | Comparisons | academic.results · ks4 · pill | subject | schools | teacher.c3.comparisons |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| current | Current | latest | yes |
| trends | Trends | over_time | no |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.ks4.results.c1.current | c1 | current | — | DV-C1-RES-CUR-TILES, DV-C1-RES-CUR-GRADES, DV-C1-RES-CUR-BAR, DV-C1-RES-CUR-TABLE, DV-C1-CNT-CUR-DIST | DV-C1-RES-CUR-TILES |
| vicdata.ks4.results.c2.current | c2 | current | — | DV-C2-CUR-DONUT, DV-C2-CUR-BARS, DV-C2-CUR-LIST, DV-C2-CUR-TABLE | DV-C2-CUR-BARS |
| vicdata.ks4.results.c3.current | c3 | current | overridden: whole-school headline (ranking sets) (DV-C3-CUR-TILES shows the school's headline rank in a ranking set, not the focused subject.) | DV-C3-CUR-TILES, DV-C3-CUR-MAP, DV-C3-CUR-BAR, DV-C3-CUR-RANKING | DV-C3-CUR-MAP |
| vicdata.ks4.results.c1.trends | c1 | trends | overridden: LA, region, England; comparator schools (Combinations doc F2 plus audit M4: Results Trends also carries the comparator-school Map, and Grade counts' Spread and Change table, which compare with nothing (they follow the Results pill into this panel).) | DV-C1-RES-TR-CHART, DV-C1-RES-TR-TABLE, DV-C1-RES-TR-MAP, DV-C1-RES-TR-GEO-CHART, DV-C1-RES-TR-GEO-TABLE, DV-C1-CNT-TR-SPREAD, DV-C1-CNT-TR-CHANGETABLE | DV-C1-RES-TR-CHART |
| vicdata.ks4.results.c2.trends | c2 | trends | — | DV-C2-TR-CHART, DV-C2-TR-TABLE, DV-C2-TR-CHANGELIST, DV-C2-TR-CHANGETABLE | DV-C2-TR-CHART |
| vicdata.ks4.results.c3.trends | c3 | trends | — | DV-C3-TR-CHART, DV-C3-TR-TABLE, DV-C3-TR-MAP, DV-C3-TR-CHANGELIST, DV-C3-TR-CHANGETABLE, DV-C3-TR-CHANGEMAP | DV-C3-TR-CHART |

## Post-16 Candidates (`vicdata.ks5.candidates`)

Owner vicdata · dashboard · layout 3 (auto-close) · group Post-16 #0

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | Candidates | academic.candidates · ks5 | subject | subjects | teacher.c1.candidates |
| c2 | Context | academic.candidates · ks5 | subject | subjects | teacher.c2.context |
| c3 | Comparisons | academic.candidates · ks5 | subject | schools | teacher.c3.comparisons |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| current | Current | latest | yes |
| trends | Trends | over_time | no |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.ks5.candidates.c1.current | c1 | current | — | DV-C1-CAND-CUR-TILES | DV-C1-CAND-CUR-TILES |
| vicdata.ks5.candidates.c2.current | c2 | current | — | DV-C2-CUR-DONUT, DV-C2-CUR-BARS, DV-C2-CUR-LIST, DV-C2-CUR-TABLE | DV-C2-CUR-BARS |
| vicdata.ks5.candidates.c3.current | c3 | current | overridden: whole-school headline (ranking sets) (DV-C3-CUR-TILES shows the school's headline rank in a ranking set, not the focused subject.) | DV-C3-CUR-TILES, DV-C3-CUR-MAP, DV-C3-CUR-BAR, DV-C3-CUR-RANKING | DV-C3-CUR-MAP |
| vicdata.ks5.candidates.c1.trends | c1 | trends | overridden: LA, region, England (Combinations doc F2: Column 1's Trends shows its subject against LA, region and England (Area chart, Change table).) | DV-C1-CAND-TR-INDEXED, DV-C1-CAND-TR-ACTUAL, DV-C1-CAND-TR-TABLE, DV-C1-CAND-TR-GEO-CHART, DV-C1-CAND-TR-GEO-TABLE | DV-C1-CAND-TR-INDEXED |
| vicdata.ks5.candidates.c2.trends | c2 | trends | — | DV-C2-TR-INDEXED, DV-C2-TR-ACTUAL, DV-C2-TR-TABLE, DV-C2-TR-CHANGELIST, DV-C2-TR-CHANGETABLE | DV-C2-TR-INDEXED |
| vicdata.ks5.candidates.c3.trends | c3 | trends | — | DV-C3-TR-CHART, DV-C3-TR-TABLE, DV-C3-TR-MAP, DV-C3-TR-CHANGELIST, DV-C3-TR-CHANGETABLE, DV-C3-TR-CHANGEMAP | DV-C3-TR-CHART |

## Post-16 Results (`vicdata.ks5.results`)

Owner vicdata · dashboard · layout 3 (auto-close) · group Post-16 #1

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | Results | academic.results · ks5 · pill | subject | subjects, averages | teacher.c1.results |
| c2 | Context | academic.results · ks5 · pill | subject | subjects | teacher.c2.context |
| c3 | Comparisons | academic.results · ks5 · pill | subject | schools | teacher.c3.comparisons |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| current | Current | latest | yes |
| trends | Trends | over_time | no |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.ks5.results.c1.current | c1 | current | — | DV-C1-RES-CUR-TILES, DV-C1-RES-CUR-GRADES, DV-C1-RES-CUR-BAR, DV-C1-RES-CUR-TABLE, DV-C1-CNT-CUR-DIST | DV-C1-RES-CUR-TILES |
| vicdata.ks5.results.c2.current | c2 | current | — | DV-C2-CUR-DONUT, DV-C2-CUR-BARS, DV-C2-CUR-LIST, DV-C2-CUR-TABLE | DV-C2-CUR-BARS |
| vicdata.ks5.results.c3.current | c3 | current | overridden: whole-school headline (ranking sets) (DV-C3-CUR-TILES shows the school's headline rank in a ranking set, not the focused subject.) | DV-C3-CUR-TILES, DV-C3-CUR-MAP, DV-C3-CUR-BAR, DV-C3-CUR-RANKING | DV-C3-CUR-MAP |
| vicdata.ks5.results.c1.trends | c1 | trends | overridden: LA, region, England; comparator schools (Combinations doc F2 plus audit M4: Results Trends also carries the comparator-school Map, and Grade counts' Spread and Change table, which compare with nothing (they follow the Results pill into this panel).) | DV-C1-RES-TR-CHART, DV-C1-RES-TR-TABLE, DV-C1-RES-TR-MAP, DV-C1-RES-TR-GEO-CHART, DV-C1-RES-TR-GEO-TABLE, DV-C1-CNT-TR-SPREAD, DV-C1-CNT-TR-CHANGETABLE | DV-C1-RES-TR-CHART |
| vicdata.ks5.results.c2.trends | c2 | trends | — | DV-C2-TR-CHART, DV-C2-TR-TABLE, DV-C2-TR-CHANGELIST, DV-C2-TR-CHANGETABLE | DV-C2-TR-CHART |
| vicdata.ks5.results.c3.trends | c3 | trends | — | DV-C3-TR-CHART, DV-C3-TR-TABLE, DV-C3-TR-MAP, DV-C3-TR-CHANGELIST, DV-C3-TR-CHANGETABLE, DV-C3-TR-CHANGEMAP | DV-C3-TR-CHART |

## Admissions Pipelines (`vicdata.admissions.pipelines`)

Owner vicdata · dashboard · layout 3 (independent) · group Admissions #0

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | Entry point | admissions.pupils · ks4 | entry_point | none | admissions.pipelines |
| c2 | Pipeline | admissions.pipeline · ks4 | entry_point | schools | admissions.pipelines |
| c3 | Forward | admissions.pipeline · ks4 | entry_point | schools | admissions.pipelines |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| now | Now | latest | yes |
| trends | Trends | over_time | yes |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.admissions.pipelines.c1.now | c1 | now | — | DV-ADM-P-NOW | DV-ADM-P-NOW |
| vicdata.admissions.pipelines.c2.now | c2 | now | — | DV-ADM-P-PIPELINE, DV-ADM-P-FUNNEL, DV-ADM-P-MAP, DV-ADM-P-TABLE, DV-ADM-P-SHAPE | DV-ADM-P-PIPELINE |
| vicdata.admissions.pipelines.c1.trends | c1 | trends | — | DV-ADM-P-ENTRY-LINE, DV-ADM-P-ENTRY-BARS, DV-ADM-P-ENTRY-TABLE | DV-ADM-P-ENTRY-LINE |
| vicdata.admissions.pipelines.c2.trends | c2 | trends | — | DV-ADM-P-POOL-INDEXED, DV-ADM-P-POOL-TABLE, DV-ADM-P-AREA-POP | DV-ADM-P-POOL-INDEXED |
| vicdata.admissions.pipelines.c3.trends | c3 | trends | — | DV-ADM-P-HOLD-LINE, DV-ADM-P-HOLD-TABLE | DV-ADM-P-HOLD-LINE |

## Admissions Market share (`vicdata.admissions.market-share`)

Owner vicdata · dashboard · layout 3 (independent) · group Admissions #1

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | Entry point | admissions.market · ks4 | entry_point | none | admissions.market |
| c2 | Rivals | admissions.market · ks4 | entry_point | schools | admissions.market |
| c3 | Trends | admissions.market · ks4 | entry_point | schools | admissions.market |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| now | Now | latest | yes |
| trends | Trends | over_time | yes |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.admissions.market-share.c1.now | c1 | now | — | DV-ADM-M-NOW | DV-ADM-M-NOW |
| vicdata.admissions.market-share.c2.now | c2 | now | — | DV-ADM-M-DONUT, DV-ADM-M-BARS, DV-ADM-M-MAP, DV-ADM-M-TABLE, DV-ADM-M-MOMENTUM, DV-ADM-M-STRENGTHS, DV-ADM-M-SHAPE | DV-ADM-M-BARS |
| vicdata.admissions.market-share.c1.trends | c1 | trends | — | DV-ADM-M-VS-LINE, DV-ADM-M-VS-BARS | DV-ADM-M-VS-LINE |
| vicdata.admissions.market-share.c2.trends | c2 | trends | — | DV-ADM-M-ACAD-RANK, DV-ADM-M-ACAD-NUM, DV-ADM-M-ACAD-CHANGE | DV-ADM-M-ACAD-RANK |
| vicdata.admissions.market-share.c3.trends | c3 | trends | — | DV-ADM-M-SHARE-LINE, DV-ADM-M-SHARE-NUM, DV-ADM-M-SHARE-RANKS, DV-ADM-M-SHARE-CHANGE, DV-ADM-M-ROLL-LINE | DV-ADM-M-SHARE-LINE |

## SMT Overview (`vicdata.smt.overview`)

Owner vicdata · dashboard · layout 3 (independent) · group SMT #0

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | The school now | smt.school · ks4 | level | none | smt.overview |
| c2 | Scorecard | smt.results · ks4 | level | schools | smt.overview |
| c3 | From Admissions | smt.school · ks4 | level | schools | smt.overview |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| now | Now | latest | yes |
| trends | Trends | over_time | yes |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.smt.overview.c1.now | c1 | now | — | DV-SMT-O-NOW | DV-SMT-O-NOW |
| vicdata.smt.overview.c2.now | c2 | now | — | DV-SMT-O-SCORECARD, DV-SMT-O-MAP, DV-SMT-O-FLAGS | DV-SMT-O-SCORECARD |
| vicdata.smt.overview.c1.trends | c1 | trends | — | DV-SMT-O-ROLL-LINE, DV-SMT-O-ROLL-TABLE | DV-SMT-O-ROLL-LINE |
| vicdata.smt.overview.c2.trends | c2 | trends | — | DV-SMT-O-RESULTS-LINE, DV-SMT-O-RESULTS-TABLE | DV-SMT-O-RESULTS-LINE |
| vicdata.smt.overview.c3.trends | c3 | trends | — | DV-SMT-O-MARKET-LINE, DV-SMT-O-MARKET-TABLE | DV-SMT-O-MARKET-LINE |

## SMT Academic (`vicdata.smt.academic`)

Owner vicdata · dashboard · layout 3 (independent) · group SMT #1

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | The level now | smt.results · ks4 | level | none | smt.academic |
| c2 | Subjects | smt.subjects · ks4 | level | schools | smt.academic |
| c3 | Entries | smt.subjects · ks4 | level | schools | smt.academic |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| now | Now | latest | yes |
| trends | Trends | over_time | yes |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.smt.academic.c1.now | c1 | now | — | DV-SMT-A-NOW | DV-SMT-A-NOW |
| vicdata.smt.academic.c2.now | c2 | now | — | DV-SMT-A-AREAS, DV-SMT-A-SUBJECTS, DV-SMT-A-VA, DV-SMT-A-GRADES | DV-SMT-A-AREAS |
| vicdata.smt.academic.c1.trends | c1 | trends | — | DV-SMT-A-TREND-LINE, DV-SMT-A-TREND-TABLE | DV-SMT-A-TREND-LINE |
| vicdata.smt.academic.c2.trends | c2 | trends | — | DV-SMT-A-BANDS | DV-SMT-A-BANDS |
| vicdata.smt.academic.c3.trends | c3 | trends | — | DV-SMT-A-MIX, DV-SMT-A-MIX-TABLE | DV-SMT-A-MIX |

## SMT Pupils (`vicdata.smt.pupils`)

Owner vicdata · dashboard · layout 3 (independent) · group SMT #2

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | Your pupils now | smt.school · ks4 | level | none | smt.pupils |
| c2 | Shape and size | smt.school · ks4 | level | schools | smt.pupils |
| c3 | Area | smt.school · ks4 | level | schools | smt.pupils |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| now | Now | latest | yes |
| trends | Trends | over_time | yes |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.smt.pupils.c1.now | c1 | now | — | DV-SMT-P-NOW | DV-SMT-P-NOW |
| vicdata.smt.pupils.c2.now | c2 | now | — | DV-SMT-P-SHAPE, DV-SMT-P-ENTRIES, DV-SMT-P-LEAVING, DV-SMT-P-MARKET | DV-SMT-P-SHAPE |
| vicdata.smt.pupils.c1.trends | c1 | trends | — | DV-SMT-P-PHASES, DV-SMT-P-PHASES-TABLE | DV-SMT-P-PHASES |
| vicdata.smt.pupils.c2.trends | c2 | trends | — | DV-SMT-P-POOL | DV-SMT-P-POOL |
| vicdata.smt.pupils.c3.trends | c3 | trends | — | DV-SMT-P-AREA | DV-SMT-P-AREA |

## SMT Context (`vicdata.smt.context`)

Owner vicdata · dashboard · layout 3 (independent) · group SMT #3

### Columns

| Column | Title | Data | Focus | Compare | Host |
| --- | --- | --- | --- | --- | --- |
| c1 | The area now | smt.area · ks4 | level | none | smt.context |
| c2 | Map | smt.area · ks4 | level | schools | smt.context |
| c3 | Area | smt.area · ks4 | level | schools | smt.context |

### Rows

| Row | Name | Time | Open by default |
| --- | --- | --- | --- |
| now | Now | latest | yes |
| trends | Trends | over_time | yes |

### Panels

| Panel | Column | Row | Override | Dataviews (rail order) | Default |
| --- | --- | --- | --- | --- | --- |
| vicdata.smt.context.c1.now | c1 | now | — | DV-SMT-C-NOW | DV-SMT-C-NOW |
| vicdata.smt.context.c2.now | c2 | now | — | DV-SMT-C-MAP, DV-SMT-C-BYAGE, DV-SMT-C-BIRTHS, DV-SMT-C-NEARBY | DV-SMT-C-MAP |
| vicdata.smt.context.c1.trends | c1 | trends | — | DV-SMT-C-BIRTHS-INDEXED, DV-SMT-C-BIRTHS-TABLE | DV-SMT-C-BIRTHS-INDEXED |
| vicdata.smt.context.c2.trends | c2 | trends | — | DV-SMT-C-PROJECTION | DV-SMT-C-PROJECTION |
| vicdata.smt.context.c3.trends | c3 | trends | — | DV-SMT-C-AGES | DV-SMT-C-AGES |
