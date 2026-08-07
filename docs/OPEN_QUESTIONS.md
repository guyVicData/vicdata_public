# Open questions / decisions log

Per the build brief's working mode: genuine product/architecture decisions not already
resolved across the three specs are logged here with reasoning and the default proceeded
with, rather than blocking.

---

## 2026-08-07 — Ingest repo extended: town/postcode + a bulk-export RPC

**Finding**: the membership spec (§3, §6) says search needs `school_entities.town` and
`.postcode`, and calls this "not a new decision" — but neither column existed in the
ingest repo (`vicdata`), and the existing `school_entities_lookup` RPC (a) only returns
6 original columns, none of the 2026-08-06 location/attribute fields the precondition fix
added, and (b) deliberately requires a non-empty URN list, with no way to bulk-fetch the
full ~52k-school directory for an initial search-copy sync.

**Decision, confirmed with Guy before proceeding** (this crosses into the ingest repo's
production database, not just this repo): extended `vicdata`, additively, same pattern as
the precondition fix —
- Migration: `school_entities.town`, `.postcode` columns.
- `gias.py`: mapped GIAS's `Town`/`Postcode` fields; registered as a reviewed field
  mapping in `source_field_mappings` (avoids the drift-flagging path, which hit an
  unrelated actor/permission gap when driven from a raw script rather than
  `admin_app.py`'s authenticated session — not investigated further, out of scope here).
- Re-ran GIAS ingest live (52,480 schools promoted), verified against Leighton Park
  (Reading, RG2 7ED), Woldingham (Caterham, CR3 7YA), Charterhouse (Godalming, GU7 2DX).
- New `school_entities_export(p_limit, p_offset, p_updated_since)` RPC: plain SQL (not
  the plpgsql/dynamic-EXECUTE pattern the filtered lookups use — no filter column to plan
  around here), paginated, anon-callable, returns every column this build needs including
  the previously-unexposed 2026-08-06 fields. Left `school_entities_lookup` untouched —
  vicdash's existing usage is unaffected.

Commit: `vicdata@6ace071`.

---

## Template for future entries

**Decision**: ...
**Why**: ...
**Default proceeding with**: ...
