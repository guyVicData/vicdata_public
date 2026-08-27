#!/usr/bin/env node
// Syncs the `schools` table (this project's search-optimized copy) from vicdata's
// (Phase 1 ingest repo) live school_entities_export RPC. Never a direct shared table --
// this hits vicdata's public REST API with its anon key, same as vicdash's
// reference_data.py does for other Phase 1 sources.
//
// Usage: node --env-file=.env scripts/sync-schools.js
//
// Pagination follows the same discipline vicdash's reference_data.py already
// established: PostgREST caps every response at 1000 rows regardless of what's asked
// for, so this keeps requesting pages until a short page confirms the end.

const PAGE_SIZE = 1000;
const MAX_PAGES = 200; // 200 * 1000 = 200k, a defensive bound well above the ~52.5k real row count

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

async function fetchSourcePage(apiUrl, anonKey, offset) {
  const res = await fetch(`${apiUrl}/rest/v1/rpc/school_entities_export`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_limit: PAGE_SIZE, p_offset: offset }),
  });
  if (!res.ok) {
    throw new Error(`school_entities_export fetch failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// 2026-08-28 investigation ("Kings Worcester" search failure): GIAS's Town field is
// sometimes wrongly populated with a bare county name instead of a real town (413
// schools nationally, all "shire"-suffixed -- Worcestershire, Denbighshire, etc.).
// Only 7 of those are genuinely search-affected (their current_name is also ambiguous
// enough that town is needed to disambiguate), but the fix is applied to the whole
// detected pattern rather than an allowlist of 7 URNs, since the same fallback is safe
// wherever the pattern actually fires. Address3 usually carries the real town; where
// Address3 ALSO just repeats the county name (St Hugh's School, URN 123299), Locality
// carries it instead. Deliberately narrow: this only ever touches town when town itself
// matches the county-name pattern -- every other school's town is passed through
// untouched, exactly as it always was, since Address3/Locality aren't reliably clean
// town names for the general population.
function isBareCountyName(value) {
  return typeof value === "string" && /shire$/i.test(value.trim());
}

function resolveTown(sourceRow) {
  const town = sourceRow.town;
  if (!isBareCountyName(town)) return town;
  if (sourceRow.address3 && !isBareCountyName(sourceRow.address3)) return sourceRow.address3;
  if (sourceRow.locality && !isBareCountyName(sourceRow.locality)) return sourceRow.locality;
  return town;
}

function toSchoolRow(sourceRow) {
  return {
    urn: sourceRow.urn,
    current_name: sourceRow.current_name,
    status: sourceRow.status,
    la_name: sourceRow.la_name,
    la_code: sourceRow.la_code,
    establishment_type_group: sourceRow.establishment_type_group,
    establishment_type: sourceRow.establishment_type,
    town: resolveTown(sourceRow),
    postcode: sourceRow.postcode,
    phase: sourceRow.phase,
    boarders_code: sourceRow.boarders_code,
    boarders_name: sourceRow.boarders_name,
    boarding_establishment: sourceRow.boarding_establishment,
    statutory_low_age: sourceRow.statutory_low_age,
    statutory_high_age: sourceRow.statutory_high_age,
    easting: sourceRow.easting,
    northing: sourceRow.northing,
    msoa_code: sourceRow.msoa_code,
    lsoa_code: sourceRow.lsoa_code,
    website: sourceRow.website,
    number_of_pupils: sourceRow.number_of_pupils,
    gender: sourceRow.gender,
    source_updated_at: sourceRow.updated_at,
    synced_at: new Date().toISOString(),
  };
}

async function upsertBatch(supabaseUrl, serviceRoleKey, rows) {
  const res = await fetch(`${supabaseUrl}/rest/v1/schools`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`upsert failed: HTTP ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const vicdataApiUrl = requireEnv("VICDATA_API_URL");
  const vicdataAnonKey = requireEnv("VICDATA_ANON_KEY");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  let offset = 0;
  let totalSynced = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const sourceRows = await fetchSourcePage(vicdataApiUrl, vicdataAnonKey, offset);
    if (sourceRows.length === 0) break;

    const rows = sourceRows.map(toSchoolRow);
    await upsertBatch(supabaseUrl, serviceRoleKey, rows);
    totalSynced += rows.length;
    console.log(`synced ${totalSynced} schools (offset ${offset})`);

    if (sourceRows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`done. total synced: ${totalSynced}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
