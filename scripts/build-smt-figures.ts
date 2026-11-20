#!/usr/bin/env -S npx tsx
// Speed plan §4.2 item 1: builds smt_school_figures (migration 20261125100000) -- every school's SMT Academic
// figures per key stage and year, from the same reads SMT Academic makes (qualRows, subjectVa, the GCSE area
// rollup), worked out by the same code (src/lib/smt/school-figures.ts yearFigures, smt-figures-store.ts
// encodeSchool). Run after each ingest that promotes a KS4 or Post-16 subject source, after the GIAS refresh,
// and after an ingest migration that changes subject_label_map or subject_families (as rebuild_rank_figures.py).
// Until it has run, the app makes today's reads (the new data's version has no complete build).
//
// The schools: every open school in the app's schools table that could have the key stage (statutory high
// age 15+ for GCSE, 16+ for Post-16, or none recorded; Welsh schools left out), and every school in SMT's
// national headline population for it (colleges, closed schools with figures). A set school outside these
// isn't built: a page whose set has one makes today's reads.
//
// Where it writes (exactly one):
//   --pglite DIR   a local PGlite holding the migration (testing; never a real database)
//   --out FILE     JSON lines, one stored row per line (testing)
//   --live         the app database, with the service role (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
//                  Writes the build as 'building', every row, then 'complete', then deletes that stage's
//                  older builds (their rows go with them). A re-run of the same version replaces it.
//
// Nightly (Render cron job, docs/v0.8/smt_school_figures_v1.md "The nightly build"): `npm run figures:build`, which
// is `tsx scripts/build-smt-figures.ts --live` with the environment Render already holds. A stage whose stored
// build is complete for the current data version is skipped (a few small reads, a second or two), so a night with
// no new data costs next to nothing; --force builds it anyway.
//
// Usage:
//   npx tsx --env-file=.env --env-file=.env.local scripts/build-smt-figures.ts (--pglite DIR | --out FILE | --live) [--stage ks4|ks5] [--school URN,URN] [--concurrency N] [--force | --check]
//   --school   build only these schools (testing; never marked complete with --live; never skipped)
//   --force    build even when the stored build is complete for the current version
//   --check    say, per stage, whether the stored build is up to date, and write nothing (read-only, even with --live)
import { createWriteStream } from "node:fs";
import { createServerAnonSupabaseClient, createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { lookupAcademicSubjectFamily, type AcademicSubjectFamilyRow } from "../src/lib/vicdata-reference";
import { qualRows, subjectVa, type VaFact } from "../src/lib/smt/academic-data";
import { population } from "../src/lib/smt/population";
import { BUILD_FROM, encodeSchool, figuresVersion, type FiguresRow, type Stage } from "../src/lib/smt/smt-figures-store";
import { openFiguresPglite } from "./lib/smt-figures-pglite";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const PGLITE = opt("--pglite");
const OUT = opt("--out");
const LIVE = flag("--live");
if ([PGLITE, OUT, LIVE ? "live" : undefined].filter(Boolean).length !== 1) {
  console.error("Say where to write: exactly one of --pglite DIR, --out FILE, --live.");
  process.exit(2);
}
const FORCE = flag("--force");
const CHECK = flag("--check");
if (FORCE && CHECK) {
  console.error("--force builds and --check doesn't: pass one.");
  process.exit(2);
}
const STAGES: Stage[] = opt("--stage") ? [opt("--stage") as Stage] : ["ks4", "ks5"];
const ONLY = (opt("--school") ?? "").split(",").filter(Boolean);
const CONCURRENCY = Number(opt("--concurrency") ?? 4);
const BATCH: Record<Stage, number> = { ks4: 10, ks5: 20 }; // the area rollup pages at 1,000 rows; qualRows chunks by 20
const MIN_HIGH_AGE: Record<Stage, number> = { ks4: 15, ks5: 16 };
const MAX_RETRIES = 5;

async function withRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= MAX_RETRIES) throw new Error(`${what}: failed after ${MAX_RETRIES} retries: ${(e as Error).message}`);
      const ms = 2000 * 2 ** attempt;
      console.log(`  retry ${attempt + 1}/${MAX_RETRIES} (${what}) in ${ms}ms: ${(e as Error).message.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
}
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}
const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function schoolsFor(stage: Stage): Promise<string[]> {
  if (ONLY.length) return ONLY;
  const supabase = createServerAnonSupabaseClient();
  const out = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("schools").select("urn, establishment_type_group, statutory_high_age").eq("status", "open").order("urn").range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as { urn: string; establishment_type_group: string | null; statutory_high_age: number | null }[]) {
      if (r.establishment_type_group === "Welsh schools") continue;
      if (r.statutory_high_age === null || r.statutory_high_age >= MIN_HIGH_AGE[stage]) out.add(r.urn);
    }
    if (!data || data.length < 1000) break;
  }
  for (const u of (await population(stage)).keys()) out.add(u);
  return Array.from(out).sort();
}

// ------------------------------------------------------------------------------------------ writers

type Writer = { /** Is a complete build stored for this stage and version? */ complete(stage: Stage, version: string): Promise<boolean>; start(stage: Stage, version: string): Promise<void>; write(stage: Stage, version: string, rows: FiguresRow[]): Promise<void>; finish(stage: Stage, version: string, s: { schools: number; rows: number; bytes: number }, complete: boolean): Promise<void>; close(): Promise<void> };

async function pgliteWriter(dir: string): Promise<Writer> {
  const db = await openFiguresPglite(dir);
  return {
    async complete(stage, version) {
      const r = await db.query(`select 1 from smt_figures_builds where stage = $1 and data_version = $2 and status = 'complete'`, [stage, version]);
      return r.rows.length > 0;
    },
    async start(stage, version) {
      await db.query(`delete from smt_figures_builds where stage = $1 and data_version = $2`, [stage, version]);
      await db.query(`insert into smt_figures_builds (stage, data_version, status) values ($1, $2, 'building')`, [stage, version]);
    },
    async write(stage, version, rows) {
      await db.query(
        `insert into smt_school_figures (stage, data_version, urn, period, figures, subjects, va)
         select $1, $2, r.urn, r.period, r.figures, r.subjects, r.va from json_to_recordset($3::json) as r(urn text, period int, figures jsonb, subjects jsonb, va jsonb)`,
        [stage, version, JSON.stringify(rows)],
      );
    },
    async finish(stage, version, s, complete) {
      await db.query(`update smt_figures_builds set status = $3, schools = $4, row_count = $5, payload_bytes = $6, finished_at = now() where stage = $1 and data_version = $2`, [stage, version, complete ? "complete" : "building", s.schools, s.rows, s.bytes]);
      if (complete) await db.query(`delete from smt_figures_builds where stage = $1 and data_version <> $2`, [stage, version]);
    },
    close: () => db.close(),
  };
}

function fileWriter(path: string): Writer {
  let out: ReturnType<typeof createWriteStream> | null = null; // opened on the first write, so --check leaves no file
  const file = () => (out ??= createWriteStream(path));
  return {
    complete: async () => false,
    async start() {},
    async write(stage, version, rows) {
      for (const r of rows) file().write(JSON.stringify({ stage, data_version: version, ...r }) + "\n");
    },
    async finish() {},
    close: () => new Promise((res) => (out ? out.end(res) : res(undefined))),
  };
}

function liveWriter(): Writer {
  const db = createServiceRoleSupabaseClient();
  const must = <T extends { error: { message: string } | null }>(what: string, r: T) => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r;
  };
  return {
    async complete(stage, version) {
      const r = must("read the stored build", await db.from("smt_figures_builds").select("status").eq("stage", stage).eq("data_version", version).maybeSingle());
      return (r.data as { status?: string } | null)?.status === "complete";
    },
    async start(stage, version) {
      must("clear this version", await db.from("smt_figures_builds").delete().eq("stage", stage).eq("data_version", version));
      must("start the build", await db.from("smt_figures_builds").insert({ stage, data_version: version, status: "building" }));
    },
    async write(stage, version, rows) {
      for (const part of chunks(rows, 500)) {
        await withRetry("write rows", async () => must("write rows", await db.from("smt_school_figures").upsert(part.map((r) => ({ stage, data_version: version, ...r })))));
      }
    },
    async finish(stage, version, s, complete) {
      must("finish the build", await db.from("smt_figures_builds").update({ status: complete ? "complete" : "building", schools: s.schools, row_count: s.rows, payload_bytes: s.bytes, finished_at: new Date().toISOString() }).eq("stage", stage).eq("data_version", version));
      if (complete) must("delete older builds", await db.from("smt_figures_builds").delete().eq("stage", stage).neq("data_version", version));
    },
    async close() {},
  };
}

// ------------------------------------------------------------------------------------------ the build

async function buildStage(stage: Stage, version: string, w: Writer) {
  const t0 = Date.now();
  const urns = await schoolsFor(stage);
  console.log(`${stage}: version ${version}, ${urns.length} schools, from ${BUILD_FROM}`);
  await w.start(stage, version);
  const totals = { schools: 0, rows: 0, bytes: 0, withData: 0 };
  let done = 0;
  const batches = chunks(urns, BATCH[stage]);
  await pool(batches, CONCURRENCY, async (batch) => {
    const [rows, va, fam] = await Promise.all([
      withRetry(`${stage} rows ${batch[0]}..`, () => qualRows(batch, stage, BUILD_FROM)),
      stage === "ks5" ? withRetry(`va ${batch[0]}..`, () => subjectVa(batch)) : Promise.resolve([] as VaFact[]),
      stage === "ks4" ? withRetry(`areas ${batch[0]}..`, () => lookupAcademicSubjectFamily({ entityIds: batch, ksStage: "ks4", periodMin: BUILD_FROM })) : Promise.resolve([] as AcademicSubjectFamilyRow[]),
    ]);
    const out = batch.flatMap((u) => encodeSchool(stage, u, rows, va, fam));
    await w.write(stage, version, out);
    totals.schools += batch.length;
    totals.rows += out.length;
    totals.withData += new Set(out.filter((r) => r.period !== 0).map((r) => r.urn)).size;
    totals.bytes += out.reduce((t, r) => t + JSON.stringify(r).length, 0);
    if (++done % 25 === 0 || done === batches.length) console.log(`  ${stage} ${done}/${batches.length} batches, ${totals.rows} rows, ${(totals.bytes / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - t0) / 1000)} s`);
  });
  // The data mustn't have moved under the build: a version that changed meanwhile is never marked complete.
  const after = await figuresVersion(stage);
  const complete = after === version && !(LIVE && ONLY.length);
  await w.finish(stage, version, totals, complete);
  console.log(`${stage}: ${complete ? "complete" : after !== version ? `NOT complete: the data changed during the build (${after}); run again` : "written, not marked complete (--school)"} -- ${totals.schools} schools (${totals.withData} with figures), ${totals.rows} rows, ${(totals.bytes / 1e6).toFixed(1)} MB of JSON, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

async function main() {
  const w = PGLITE ? await pgliteWriter(PGLITE) : OUT ? fileWriter(OUT) : liveWriter();
  const t0 = Date.now();
  for (const stage of STAGES) {
    const version = await figuresVersion(stage);
    // --school is a test of a few schools: always built, never compared with the stored build.
    const upToDate = !FORCE && !ONLY.length && (await w.complete(stage, version));
    if (upToDate) console.log(`${stage}: up to date -- the stored build is complete for version ${version}; skipped${CHECK ? "" : " (--force builds it anyway)"}`);
    else if (CHECK) console.log(`${stage}: would build -- no complete build stored for version ${version}`);
    else await buildStage(stage, version, w);
  }
  await w.close();
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
