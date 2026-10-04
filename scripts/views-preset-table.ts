// VicData 0.6.1 S2: the preset table in docs/v0.6/views_preset_table.md, generated from
// src/catalogue/viewspec.ts (presetTableMarkdown).
//
//   npx -y tsx scripts/views-preset-table.ts           print the table
//   npx -y tsx scripts/views-preset-table.ts --write   rewrite the doc's generated block
//
// src/lib/viewspec.test.ts fails when the doc's block is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { PRESET_TABLE_END, PRESET_TABLE_START, presetTableMarkdown } from "../src/catalogue/viewspec-doc";

const DOC = new URL("../docs/v0.6/views_preset_table.md", import.meta.url);
const table = presetTableMarkdown();
if (process.argv.includes("--write")) {
  const doc = readFileSync(DOC, "utf8");
  const a = doc.indexOf(PRESET_TABLE_START);
  const b = doc.indexOf(PRESET_TABLE_END);
  if (a < 0 || b < a) throw new Error("the doc has no preset-table block");
  writeFileSync(DOC, doc.slice(0, a) + table + doc.slice(b + PRESET_TABLE_END.length));
  console.log("rewrote the preset table in docs/v0.6/views_preset_table.md");
} else {
  console.log(table);
}
