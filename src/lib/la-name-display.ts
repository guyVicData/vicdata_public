// Local authority display-name cleaning (2026-09-29). Real, confirmed problem: some
// real la_name values carry ONS's own ceremonial-naming convention -- a trailing
// ", County of" / ", City of" (and the wider real pattern this generalises to:
// ", Borough of" / ", Royal Borough of" / ", London Borough of" / ", District of" /
// ", Unitary Authority of") -- which reads badly folded into prose ("...in
// Herefordshire, County of and 3 FE colleges"). Confirmed against every real la_name
// this database actually has (183 distinct, among open schools): exactly 3 hit this --
// "Herefordshire, County of", "Bristol, City of", "Kingston upon Hull, City of". A
// general suffix-stripper, not a hardcoded 3-name replace, since ONS's own convention
// covers more suffix words than these 3 happen to need today.
//
// "Bournemouth, Christchurch and Poole" was checked and deliberately NOT touched by
// this -- that comma is the real, correct name of a merged unitary authority (three
// towns), not an ONS ceremonial suffix; the regex below doesn't match it (no trailing
// "... of" clause), so it passes through unchanged, correctly.
//
// DISPLAY ONLY. Confirmed live before building this: age_profile_aggregates.scope_key
// and roll_aggregates.scope_key both store the RAW ceremonial name
// ("Herefordshire, County of", not "Herefordshire") -- cleaning la_name before it
// reaches any lookup/join (population-trend-lookup.ts, age-band-distributions.ts,
// la-sector-composition.ts, sixth-form-sector-aggregates.ts, narrative-lookup.ts, and
// page.tsx's own getContextAggregates) would silently break the join for every LA
// this pattern hits. This function must only ever be called at the final point a name
// is interpolated into user-facing prose, never before a query that keys on it.
const CEREMONIAL_SUFFIX_RE = /,\s*(?:Royal Borough|London Borough|Unitary Authority|County|City|Borough|District) of$/i;

export function cleanLaNameForDisplay(name: string): string;
export function cleanLaNameForDisplay(name: string | null): string | null;
export function cleanLaNameForDisplay(name: string | null): string | null {
  if (!name) return name;
  return name.replace(CEREMONIAL_SUFFIX_RE, "").trim();
}
