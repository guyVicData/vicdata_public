<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# VicData catalogue

The four-layer catalogue (docs/v0.6/vicdata_0_6_view_catalogue_and_offer_design_v1.md): rules → measures → renderers → dataviews. The code in `src/catalogue/` is the source of truth; these files are generated from it.

| File | Contents |
| --- | --- |
| [rules.md](rules.md) | 56 rules (22 must lift, 21 lifted; 19 with an automated real-data check in `scripts/catalogue-rule-tests.ts`) |
| [measures.md](measures.md) | 14 measures |
| [renderers.md](renderers.md) | 14 renderers |
| [dataviews.md](dataviews.md) | 40 dataviews (38 live) |
| [dashboards.md](dashboards.md) | 4 seeded dashboards |

Regenerate: `npx -y tsx scripts/catalogue-export.ts`. Unit tests: `npx -y tsx --test scripts/catalogue-unit-tests.ts`. Rule tests against real data: `npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`.
