<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Dashboards

Seeded dashboard configs (src/catalogue/dashboards). 4 dashboards.

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
