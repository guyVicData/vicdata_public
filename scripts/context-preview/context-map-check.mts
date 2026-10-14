// VicData 0.8 SMT round 3 (R-SMT-CONTEXT-GEOGRAPHY): Context's map for one school, printed as JSON on
// the last line -- its state, how many LSOAs it counts within 5 miles against school_context_lookup's
// lsoa_count, whether every LSOA has a boundary, and what "Shade by" offers. Run plain (production as
// it is) or with --import ./scripts/context-preview/install-lsoa-boundaries.ts (the boundaries loaded).
// Read-only. Used by scripts/catalogue-rule-tests.ts.
import { smtSchool } from "../../src/lib/smt/school";
import { buildContext } from "../../src/lib/smt/context";
import { buildContextMap } from "../../src/lib/smt/context-map";
import { shadeOptions } from "../../src/components/smt/views/Context";

const urn = process.argv[2] ?? "137625";
const school = (await smtSchool(urn))!;
const c = await buildContext(school, "around", "gcse");
const t = Date.now();
const m = await buildContextMap(school, "gcse", c.map.schools);
const ms = Date.now() - t;
const opts = shadeOptions(c, m).map((o) => o.id);
if (m.state === "fallback") console.log(JSON.stringify({ state: m.state, reason: m.reason, opts, las: c.map.las.length }));
else console.log(JSON.stringify({ state: m.state, here: m.counted.here, lookup: m.counted.lookup, lsoas: m.lsoas.length, everyBoundary: m.lsoas.every((l) => l.geometry.coordinates.length > 0 && l.areaHa > 0), opts, ms, bytes: JSON.stringify(m).length }));
