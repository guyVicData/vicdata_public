#!/usr/bin/env -S npx tsx
// Precomputes consortium sixth-form-centre membership into consortium_members --
// group-page build. Fetches GIAS's public "Establishment links" bulk CSV DIRECTLY
// (same public, no-login, date-stamped URL ingest/sources/gias_links.py in the
// vicdata ingest repo already uses) rather than reading that repo's own
// school_lineage table -- confirmed live last round that table's RLS grants SELECT
// to `authenticated` only, not `anon`, and vicdata_public has no service-role
// credential for that separate Supabase project. Not worth working around (a second
// credential, a cross-project RPC) when the source CSV is itself directly
// fetchable -- same file, same real data, one HTTP GET.
//
// Real LinkType semantics, confirmed against the live file before writing this
// (2026-09-25): the 14 known consortium URNs' membership appears TWICE in the raw
// file -- once as the group's own row (URN=group, LinkURN=member,
// LinkType='Sixth Form Centre School') and once as each member's own reverse row
// (URN=member, LinkURN=group, LinkType='Sixth Form Centre Link') -- genuinely
// bidirectional duplicates of the same real relationship, not two different facts.
// Both directions are read here and deduped on (group_urn, member_urn) -- belt and
// braces against the rare case where bidirectionality doesn't hold for some row,
// cheaper than assuming it always does.
//
// Usage: npx tsx --env-file=.env scripts/sync-consortium-links.ts

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";

const DOWNLOAD_URL_TEMPLATE =
  "https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/links_edubasealldata{date}.csv";

const LINK_TYPES = new Set(["Sixth Form Centre School", "Sixth Form Centre Link"]);
const SUCCESSOR_LINK_TYPE = "Successor";

// The 14 confirmed open "Sixth form centres" URNs (Prompt's own list, matching the
// real DB query from last round's characterization).
const CONSORTIUM_GROUP_URNS = [
  "132838", // LaSWAP
  "134820", // PGW Partnership of Greenacre and Walderslade
  "135416", // Harris Federation Post 16
  "135469", // Harrow Collegiate
  "132942", // Sydenham and Forest Hill
  "133043", // Chichester High Schools Sixth Form
  "134821", // Beverley Joint Sixth
  "140604", // Central Learning Partnership
  "132916", // Didcot Sixth Form College
  "150214", // JMF6 Abingdon
  "135589", // North Bristol Post 16 Centre
  "136509", // RR6
  "132951", // Sleaford Joint Sixth Form
  "132913", // St Aidans and St John Fisher
];

type RawLinkRow = { urn: string; linkUrn: string; linkType: string };

function parseCsv(text: string): RawLinkRow[] {
  // Same file shape gias_links.py already documents: URN,LinkURN,LinkName,LinkType,
  // LinkEstablishedDate, cp1252-encoded, double-quoted fields. A small hand-rolled
  // parser (not a CSV library dependency) -- every field here is either a bare
  // digit-string URN or a double-quoted string with no embedded commas/quotes in
  // practice for this specific file (confirmed against the real download), so a
  // regex split is sufficient and matches this project's existing "no CSV library"
  // convention for its own sync scripts.
  const lines = text.split(/\r?\n/);
  const rows: RawLinkRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = line.match(/(".*?"|[^,]+)(?=,|$)/g);
    if (!fields || fields.length < 4) continue;
    const unquote = (s: string) => s.replace(/^"|"$/g, "");
    rows.push({
      urn: unquote(fields[0]).trim(),
      linkUrn: unquote(fields[1]).trim(),
      linkType: unquote(fields[3]).trim(),
    });
  }
  return rows;
}

async function main() {
  const supabase = createServiceRoleSupabaseClient();
  const groupUrnSet = new Set(CONSORTIUM_GROUP_URNS);

  const today = new Date();
  const dateStamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const url = DOWNLOAD_URL_TEMPLATE.replace("{date}", dateStamp);
  console.log(`fetching ${url}...`);
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`GIAS links download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // GIAS's own links file is cp1252-encoded (same as gias_links.py's own decode) --
  // node has no built-in cp1252 decoder, but this file's only non-ASCII bytes are in
  // LinkName (a column dropped entirely below, never read), so a plain latin1 decode
  // is safe here without pulling in an iconv dependency for a column we don't use.
  const text = buf.toString("latin1");
  const rows = parseCsv(text);
  console.log(`  ${rows.length} total rows parsed`);

  // Successor chain: closedUrn -> its own declared successor (URN=closedUrn,
  // LinkType='Successor' -> LinkURN=new urn). Built from the WHOLE file, not just
  // our filtered subset -- a superseded member URN's successor row lives under its
  // OWN urn, unrelated to the Sixth-Form-Centre rows.
  const successorOf = new Map<string, string>();
  for (const r of rows) {
    if (r.linkType === SUCCESSOR_LINK_TYPE) successorOf.set(r.urn, r.linkUrn);
  }

  // Raw (group, member) pairs, both directions, deduped.
  const rawPairs = new Set<string>();
  for (const r of rows) {
    if (!LINK_TYPES.has(r.linkType)) continue;
    if (r.linkType === "Sixth Form Centre School" && groupUrnSet.has(r.urn)) {
      rawPairs.add(`${r.urn}|${r.linkUrn}`);
    } else if (r.linkType === "Sixth Form Centre Link" && groupUrnSet.has(r.linkUrn)) {
      rawPairs.add(`${r.linkUrn}|${r.urn}`);
    }
  }
  console.log(`  ${rawPairs.size} distinct raw (group, member) pairs across the ${CONSORTIUM_GROUP_URNS.length} known groups`);

  // Resolve every URN mentioned (members + their possible successors) against real
  // open/closed status in one batch query.
  const candidateUrns = new Set<string>();
  for (const pair of rawPairs) {
    const [, memberUrn] = pair.split("|");
    candidateUrns.add(memberUrn);
    let chase = memberUrn;
    for (let hop = 0; hop < 5 && successorOf.has(chase); hop++) {
      chase = successorOf.get(chase)!;
      candidateUrns.add(chase);
    }
  }
  const { data: statusRows, error } = await supabase
    .from("schools")
    .select("urn, current_name, status")
    .in("urn", Array.from(candidateUrns));
  if (error) throw error;
  const statusByUrn = new Map((statusRows as { urn: string; current_name: string; status: string }[]).map((r) => [r.urn, r]));

  // Resolve each raw pair's member URN to a currently-OPEN school, following the
  // real Successor chain (bounded to 5 hops, defensive -- every real case checked
  // this round resolved in exactly 1 hop) when the raw member URN is closed. Members
  // that don't resolve to anything real/open are skipped and logged, never written
  // as a dead link.
  const resolvedByGroup = new Map<string, Map<string, { memberUrn: string; name: string }>>();
  const skipped: string[] = [];
  const substituted: string[] = [];

  for (const pair of rawPairs) {
    const [groupUrn, rawMemberUrn] = pair.split("|");
    let memberUrn = rawMemberUrn;
    let resolvedVia: string | null = null;
    for (let hop = 0; hop < 5; hop++) {
      const rec = statusByUrn.get(memberUrn);
      if (rec && rec.status !== "closed") break; // open, done
      const next = successorOf.get(memberUrn);
      if (!next) { memberUrn = ""; break; } // no further chain, unresolved
      resolvedVia = resolvedVia ?? rawMemberUrn;
      memberUrn = next;
    }
    if (!memberUrn) {
      skipped.push(`${groupUrn} -> ${rawMemberUrn} (${statusByUrn.get(rawMemberUrn)?.current_name ?? "unknown"}): closed, no resolvable successor`);
      continue;
    }
    const finalRec = statusByUrn.get(memberUrn);
    if (!finalRec || finalRec.status === "closed") {
      skipped.push(`${groupUrn} -> ${rawMemberUrn}: resolved chain ended on a non-open/unknown URN (${memberUrn})`);
      continue;
    }
    if (resolvedVia) {
      substituted.push(`${groupUrn}: ${resolvedVia} (closed) -> ${memberUrn} (${finalRec.current_name}, open)`);
    }
    if (!resolvedByGroup.has(groupUrn)) resolvedByGroup.set(groupUrn, new Map());
    resolvedByGroup.get(groupUrn)!.set(memberUrn, { memberUrn, name: finalRec.current_name });
  }

  if (substituted.length > 0) {
    console.log(`\nsubstituted closed URNs for their real, current open successor (${substituted.length}):`);
    for (const s of substituted) console.log(`  ${s}`);
  }
  if (skipped.length > 0) {
    console.log(`\nskipped, no dead link written (${skipped.length}):`);
    for (const s of skipped) console.log(`  ${s}`);
  }

  console.log(`\nreal per-group member lists (${resolvedByGroup.size} of ${CONSORTIUM_GROUP_URNS.length} groups with at least one member):`);
  for (const groupUrn of CONSORTIUM_GROUP_URNS) {
    const members = resolvedByGroup.get(groupUrn);
    const groupName = statusByUrn.get(groupUrn)?.current_name ?? groupUrn;
    if (!members || members.size === 0) {
      console.log(`  ${groupUrn} (${groupName}): 0 members`);
      continue;
    }
    console.log(`  ${groupUrn} (${groupName}): ${members.size} members`);
    for (const m of members.values()) console.log(`    - ${m.memberUrn} ${m.name}`);
  }

  const upsertRows: { group_urn: string; member_urn: string; link_type: string; synced_at: string }[] = [];
  const now = new Date().toISOString();
  for (const [groupUrn, members] of resolvedByGroup) {
    for (const m of members.values()) {
      upsertRows.push({ group_urn: groupUrn, member_urn: m.memberUrn, link_type: "Sixth Form Centre School", synced_at: now });
    }
  }

  console.log(`\nwriting ${upsertRows.length} rows to consortium_members...`);
  const { error: upsertError } = await supabase
    .from("consortium_members")
    .upsert(upsertRows, { onConflict: "group_urn,member_urn" });
  if (upsertError) throw upsertError;

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
