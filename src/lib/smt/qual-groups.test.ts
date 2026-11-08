// 0.8 SMT Academic by qualification: the bands (R-SMT-VA-BANDS) at each edge, the groups and the address
// (R-SMT-QUAL-GROUPS, R-SMT-ACADEMIC-MODES). npx -y tsx --test src/lib/smt/qual-groups.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { academicQuery, dfeBandOf, groupChips, groupOfQualification, p8Band, parseAcademic, rangeBand, shortQualification, type AcademicOffer } from "./qual-groups";

test("R-SMT-VA-BANDS: three labels from the 95% range, at each edge", () => {
  assert.equal(rangeBand(0.01, 0.5), "Clearly above");
  assert.equal(rangeBand(0, 0.5), "In line"); // touching 0 isn't clear of it
  assert.equal(rangeBand(-0.5, 0), "In line");
  assert.equal(rangeBand(-0.5, -0.01), "Clearly below");
  assert.equal(rangeBand(-0.3, 0.3), "In line");
  assert.equal(rangeBand(null, 0.3), null);
});

test("R-SMT-VA-BANDS: Progress 8's five bands, as DfE defines them", () => {
  assert.equal(p8Band(0.51, 0.01, 1), "Well above average");
  assert.equal(p8Band(0.5, 0.01, 1), "Above average"); // +0.5 itself isn't beyond it
  assert.equal(p8Band(0.6, 0, 1.2), "Average"); // the range touches 0
  assert.equal(p8Band(0.3, -0.1, 0.6), "Average");
  assert.equal(p8Band(-0.5, -1, -0.01), "Below average");
  assert.equal(p8Band(-0.51, -1, -0.01), "Well below average");
  assert.equal(p8Band(null, -1, 1), null);
});

test("DfE's own banding text is read as one of its five, or nothing", () => {
  assert.equal(dfeBandOf("Above average"), "Above average");
  assert.equal(dfeBandOf(" well below average "), "Well below average");
  assert.equal(dfeBandOf("Not published"), null);
  assert.equal(dfeBandOf(3), null);
});

test("R-SMT-QUAL-GROUPS: qualifications fall in their groups; All only with two or more", () => {
  assert.equal(groupOfQualification("GCE A level"), "alevel");
  assert.equal(groupOfQualification("GCE AS level (All)"), "as");
  assert.equal(groupOfQualification("Extended Project (Diploma)"), "epq");
  assert.equal(groupOfQualification("Core Maths Qualifications at Level 3"), "coremaths");
  assert.equal(groupOfQualification("IBO Higher level component"), "ib");
  assert.equal(groupOfQualification("BTEC National Extended Certificate L3 - Band F - P-D*"), "applied");
  assert.equal(groupOfQualification("OCR Cambridge Technical Extended Certificate at Level 3"), "applied");
  assert.equal(groupOfQualification("VRQ Level 3"), "applied");
  assert.equal(groupOfQualification("T Level"), "tlevel");
  assert.equal(groupOfQualification("Pre-U Principal Subject"), null);
  assert.deepEqual(groupChips(["ib"]), ["ib"]);
  assert.deepEqual(groupChips(["epq", "alevel", "applied"]), ["all", "alevel", "applied", "epq"]);
  assert.equal(shortQualification("BTEC National Extended Certificate L3 - Band F - P-D*"), "BTEC Ext. Certificate");
  assert.equal(shortQualification("OCR Cambridge Technical Introductory Diploma at Level 3"), "OCR Intro. Diploma");
  assert.equal(shortQualification("BTEC National Diploma L3 - Band J - PP-D*D*"), "BTEC Diploma");
});

test("R-SMT-ACADEMIC-MODES: the address, checked against what the school offers", () => {
  const offer: AcademicOffer = { phases: { gcse: true, post16: true }, main: "gcse", groups: ["alevel", "applied", "epq"], applied: ["ag", "tl"], areas: { gcse: ["sciences_maths"] } };
  // An old ?level=whole falls back to the main level.
  assert.deepEqual(parseAcademic(new URLSearchParams("level=whole"), offer), { phase: "gcse", mode: "results", group: "alevel", applied: "ag", area: null });
  assert.equal(parseAcademic(new URLSearchParams("level=post16&mode=va&group=ib"), offer).group, "alevel"); // a group it doesn't offer
  assert.equal(parseAcademic(new URLSearchParams("level=post16&group=all"), offer).group, "all");
  assert.equal(parseAcademic(new URLSearchParams("level=gcse&mode=va&area=sciences_maths"), offer).area, null); // no areas in GCSE value added
  assert.equal(parseAcademic(new URLSearchParams("level=gcse&mode=entries&area=sciences_maths"), offer).area, "sciences_maths");
  const st = parseAcademic(new URLSearchParams("level=post16&mode=entries&group=applied&applied=tl"), offer);
  assert.deepEqual(academicQuery(st), { level: "post16", mode: "entries", group: "applied", applied: "tl" });
  // A school without Post-16 never lands on it.
  const gcseOnly: AcademicOffer = { ...offer, phases: { gcse: true, post16: false }, groups: [] };
  assert.equal(parseAcademic(new URLSearchParams("level=post16"), gcseOnly).phase, "gcse");
});
