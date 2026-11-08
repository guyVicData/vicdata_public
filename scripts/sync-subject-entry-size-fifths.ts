#!/usr/bin/env -S npx tsx
// Precomputes England's fifths of per-school entries in each subject x qualification x year,
// GCSE (ks4) and Post-16 (ks5), into subject_entry_size_fifths (migration 20261122090000) --
// SMT Academic's Entries-mode size badge (R-SMT-ENTRIES-SIZE; src/lib/subject-entry-size.ts).
// Same shape as sync-age-band-distributions.ts: read every school once, keep each school's own
// figure, write the cut points; never computed per request.
//
// Sources, read here only (never on a page view):
//   ks5  academic_subject_qualification_headline_lookup -- the ingest's per-qualification
//        subject rollup, the rows the app shows (subjects already their latest names);
//   ks4  dfe_ks4_subject_entries + _historic total-entry facts (reference_data_lookup_all): no
//        ingest rollup carries GCSE entries by qualification (the KS4 subject headline merges
//        qualifications and counts a Double Award twice; the grade rollup drops subjects that
//        publish only a total). One total per school, qualification and stored subject:
//        "Total exam entries", else "Total number entered", else "Total"; then each subject is
//        its latest name (subject-latest-names.ts), summed where DfE merged two. DfE's own
//        "All subjects" rows are skipped: ALL_SUBJECTS is computed from the subjects.
//
// The schools: every open school in the app's schools table that could have the key stage
// (statutory high age 15+ for ks4, 16+ for ks5, or none recorded; Welsh schools left out),
// asked in small batches. The ingest's lookups follow a clean 1:1 predecessor, so an open
// school also carries the years before a re-brokering; a school closed with no successor is
// not asked (its earlier years are missing from those years' populations).
//
// Years are whatever the data holds -- no year is named here -- so a new release (Post-16
// 2025/26 in mid-November) is a re-run. Rows a run no longer produces (a renamed subject) are
// deleted after the upsert, for the key stages that run covered.
//
// Usage:
//   npx tsx --env-file=.env --env-file=.env.local scripts/sync-subject-entry-size-fifths.ts [--dry-run] [--stage ks4|ks5] [--out file.json] [--school URN,URN]
//   --dry-run  computes everything, prints counts and a few rows, writes nothing
//   --out      (with --dry-run) also writes every computed row to a JSON file
//   --school   (with --dry-run) prints those schools' Post-16/GCSE entries and badges, latest year

import { writeFileSync } from "node:fs";
import { createServerAnonSupabaseClient, createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { callReferenceRpc, lookupAcademicSubjectQualificationHeadline } from "../src/lib/vicdata-reference";
import { latestSubjectName } from "../src/lib/subject-latest-names";
import { ALL_SUBJECTS, entrySizeBadge, fifthsOf, MIN_SCHOOLS_TO_SIZE, type EntrySizeStage } from "../src/lib/subject-entry-size";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = flag("--dry-run");
const STAGES: EntrySizeStage[] = opt("--stage") ? [opt("--stage") as EntrySizeStage] : ["ks4", "ks5"];
const OUT = opt("--out");
const SHOW_SCHOOLS = (opt("--school") ?? "").split(",").filter(Boolean);

const CHUNK: Record<EntrySizeStage, number> = { ks4: 10, ks5: 20 };
const CONCURRENCY = 6;
const MAX_RETRIES = 5;
const KS4_SOURCES = ["dfe_ks4_subject_entries", "dfe_ks4_subject_entries_historic"];
const KS4_TOTAL_LABELS = ["Total exam entries", "Total number entered", "Total"]; // most preferred first
const MIN_HIGH_AGE: Record<EntrySizeStage, number> = { ks4: 15, ks5: 16 };

// stage -> "period\tqualification\tsubject" -> urn -> entries
type Counts = Map<string, Map<string, number>>;

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

async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function add(counts: Counts, period: number, qualification: string, subject: string, urn: string, n: number) {
  const key = `${period}\t${qualification}\t${subject}`;
  const m = counts.get(key) ?? counts.set(key, new Map()).get(key)!;
  m.set(urn, (m.get(urn) ?? 0) + n);
}

async function loadSchools(): Promise<Record<EntrySizeStage, string[]>> {
  // The schools table is readable with the anon key (schools_select_anyone).
  const supabase = createServerAnonSupabaseClient();
  const out: Record<EntrySizeStage, string[]> = { ks4: [], ks5: [] };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("schools")
      .select("urn, establishment_type_group, statutory_high_age")
      .eq("status", "open")
      .order("urn")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as { urn: string; establishment_type_group: string | null; statutory_high_age: number | null }[]) {
      if (r.establishment_type_group === "Welsh schools") continue;
      for (const s of ["ks4", "ks5"] as const) if (r.statutory_high_age === null || r.statutory_high_age >= MIN_HIGH_AGE[s]) out[s].push(r.urn);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function readKs5(urns: string[], counts: Counts) {
  const batches = chunks(urns, CHUNK.ks5);
  let done = 0;
  let rows = 0;
  await pool(batches, CONCURRENCY, async (batch) => {
    const got = await withRetry(`ks5 rollup, ${batch[0]}..`, () => lookupAcademicSubjectQualificationHeadline({ entityIds: batch, ksStage: "ks5" }));
    // Merged names arrive as two rows under one latest name: summed per school by add().
    for (const r of got) {
      const n = Number(r.entries_total);
      if (!(n > 0) || r.subject === ALL_SUBJECTS) continue;
      add(counts, r.period, r.qualification_type, r.subject, r.entity_id, n);
      add(counts, r.period, r.qualification_type, ALL_SUBJECTS, r.entity_id, n);
    }
    rows += got.length;
    if (++done % 50 === 0 || done === batches.length) console.log(`  ks5 batches ${done}/${batches.length}, ${rows} rows`);
  });
}

type Fact = { entity_id: string; period: number; breakdown: string; value_numeric: number | string | null };

async function readKs4(urns: string[], counts: Counts) {
  const batches = chunks(urns, CHUNK.ks4);
  let done = 0;
  let rows = 0;
  await pool(batches, CONCURRENCY, async (batch) => {
    // (urn, period, qualification, stored subject) -> [label rank, entries]
    const totals = new Map<string, [number, number]>();
    for (const source of KS4_SOURCES) {
      const facts = (await withRetry(`${source}, ${batch[0]}..`, () =>
        callReferenceRpc("reference_data_lookup_all", { p_source_id: source, p_entity_ids: batch, p_period_min: null, p_period_max: null, p_breakdowns: null }),
      )) as Fact[];
      rows += facts.length;
      for (const f of facts) {
        const parts = f.breakdown.split("::");
        if (parts.length !== 3) continue;
        const [qualification, subject, label] = parts;
        const rank = KS4_TOTAL_LABELS.indexOf(label);
        if (rank < 0 || subject === ALL_SUBJECTS) continue;
        const n = Number(f.value_numeric);
        if (!Number.isFinite(n)) continue;
        const key = `${f.entity_id}\t${f.period}\t${qualification}\t${subject}`;
        const had = totals.get(key);
        if (!had || rank < had[0]) totals.set(key, [rank, n]);
      }
    }
    for (const [key, [, n]] of totals) {
      if (!(n > 0)) continue;
      const [urn, period, qualification, stored] = key.split("\t");
      const subject = latestSubjectName(stored, qualification);
      add(counts, Number(period), qualification, subject, urn, n);
      add(counts, Number(period), qualification, ALL_SUBJECTS, urn, n);
    }
    if (++done % 50 === 0 || done === batches.length) console.log(`  ks4 batches ${done}/${batches.length}, ${rows} facts`);
  });
}

type OutRow = { ks_stage: EntrySizeStage; qualification: string; subject: string; period: number; schools: number; p20: number; p40: number; p60: number; p80: number; computed_at: string };

function toRows(stage: EntrySizeStage, counts: Counts, computedAt: string): OutRow[] {
  const rows: OutRow[] = [];
  for (const [key, bySchool] of counts) {
    const [period, qualification, subject] = key.split("\t");
    const f = fifthsOf(bySchool.values());
    if (!f) continue;
    rows.push({ ks_stage: stage, qualification, subject, period: Number(period), ...f, computed_at: computedAt });
  }
  return rows.sort((a, b) => a.period - b.period || a.qualification.localeCompare(b.qualification) || a.subject.localeCompare(b.subject));
}

async function main() {
  const computedAt = new Date().toISOString();
  console.log(`${DRY_RUN ? "DRY RUN (writes nothing): " : ""}stages ${STAGES.join(", ")}`);
  const schools = await loadSchools();
  const all: OutRow[] = [];
  const countsByStage = new Map<EntrySizeStage, Counts>();
  for (const stage of STAGES) {
    const counts: Counts = new Map();
    console.log(`${stage}: asking ${schools[stage].length} open schools...`);
    const t = Date.now();
    await (stage === "ks5" ? readKs5 : readKs4)(schools[stage], counts);
    const rows = toRows(stage, counts, computedAt);
    countsByStage.set(stage, counts);
    all.push(...rows);
    console.log(`${stage}: ${rows.length} rows in ${Math.round((Date.now() - t) / 1000)}s`);
    for (const p of Array.from(new Set(rows.map((r) => r.period))).sort()) {
      const yr = rows.filter((r) => r.period === p);
      const entering = new Set(Array.from(counts).filter(([k]) => k.startsWith(`${p}\t`)).flatMap(([, m]) => Array.from(m.keys())));
      console.log(`  ${p}: ${yr.length} rows, ${new Set(yr.map((r) => r.qualification)).size} qualifications, ${yr.filter((r) => r.schools >= MIN_SCHOOLS_TO_SIZE).length} with >= ${MIN_SCHOOLS_TO_SIZE} schools, ${entering.size} schools entering anything`);
    }
  }

  if (DRY_RUN) {
    console.log("\nA few rows:");
    for (const r of all.filter((_, i) => i % Math.max(1, Math.floor(all.length / 8)) === 0).slice(0, 8)) console.log(" ", JSON.stringify({ ...r, computed_at: undefined }));
    if (OUT) {
      writeFileSync(OUT, JSON.stringify(all.map((r) => ({ ...r, computed_at: undefined }))));
      console.log(`\nwrote ${all.length} rows to ${OUT}`);
    }
    for (const urn of SHOW_SCHOOLS) {
      for (const [stage, counts] of countsByStage) {
        const mine = Array.from(counts).filter(([, m]) => m.has(urn));
        const latest = Math.max(...mine.map(([k]) => Number(k.split("\t")[0])));
        if (!Number.isFinite(latest)) continue;
        console.log(`\n${urn} ${stage} ${latest}:`);
        for (const [k, m] of mine.filter(([k]) => Number(k.split("\t")[0]) === latest)) {
          const [period, qualification, subject] = k.split("\t");
          const f = all.find((r) => r.ks_stage === stage && r.period === Number(period) && r.qualification === qualification && r.subject === subject);
          console.log(`  ${qualification} | ${subject}: ${m.get(urn)} entries, ${f?.schools ?? 0} schools -> ${entrySizeBadge(m.get(urn), f) ?? "no badge"}`);
        }
      }
    }
    console.log("\ndry run: nothing written.");
    return;
  }

  const supabase = createServiceRoleSupabaseClient();
  console.log(`writing ${all.length} rows...`);
  for (const batch of chunks(all, 500)) {
    const { error } = await supabase.from("subject_entry_size_fifths").upsert(batch, { onConflict: "ks_stage,qualification,subject,period" });
    if (error) throw error;
  }
  for (const stage of STAGES) {
    const { error, count } = await supabase.from("subject_entry_size_fifths").delete({ count: "exact" }).eq("ks_stage", stage).lt("computed_at", computedAt);
    if (error) throw error;
    console.log(`${stage}: ${count ?? 0} rows no longer produced, deleted`);
  }
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
