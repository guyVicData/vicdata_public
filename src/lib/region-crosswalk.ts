// LA -> standard-region/nation crosswalk for the Member Data View performance
// architecture work (school_region_nation table). Intended to reuse the ingest
// repo's own proven crosswalk (vicdata/geo/region_hierarchy.py + la_hierarchy.py,
// itself "largely reused as-is" from the original consulting pipeline per
// roll_pipeline/docs/roll pipileine geolocation.md §5/§8) rather than re-deriving
// region membership from scratch -- but that Python algorithm operates on ONS GSS-style
// LA codes (E09000007, E07000006, ...) resolved via a `la_region_lookup` built from the
// DfE census's own new_la_code/region_name columns, which this repo has no cheap access
// to (canonical_facts lives in a different Supabase project, reachable only via a
// paginated HTTP RPC -- see vicdata-reference.ts's own comment).
//
// Checked directly against this project's real data before deciding how to port this,
// not assumed: this project's own `schools.la_code` column is a DIFFERENT numbering
// scheme entirely -- DfE's own 3-digit numeric LA code (e.g. "674" for Rhondda Cynon
// Taf), not an ONS GSS code -- so the Python algorithm's code-based resolution chain
// (alias match / London-borough E09 prefix / upper_la_code() county promotion via
// lad_to_county_2023.csv / "Other England" fallback) cannot be fed this column's real
// values at all. And the county-lookup CSV itself only maps DISTRICT codes to their
// COUNTY code -- it carries no region-level information on its own; the Python
// algorithm's actual region assignment for anything beyond London/alias always came
// from the external DfE la_region_lookup, which isn't available here either.
//
// Given that, this is a from-scratch table keyed on this project's real, verified
// `schools.la_name` values (all 188 distinct values queried live from the schools
// table on 2026-09-08, zero silently dropped -- see the exhaustive classification
// below) rather than a direct code-for-code port. Region/nation membership itself is
// stable, well-documented English/Welsh administrative geography (the 9 ONS regions
// and 22 Welsh principal areas), not something this project's own data reveals -- so
// this table encodes that reference geography directly, cross-checked against the
// ONS "LAD to County (April 2023)" lookup for the shire-district entries (the same
// source `la_hierarchy.py`'s own lad_to_county_2023.csv uses) during construction.
//
// Not ported: la_hierarchy.py's BOUNDARY_CHANGES / upper_la_code() (pre-2020/2023
// district-code promotion) and region_hierarchy.py's la_to_region() code-based
// resolution chain -- both operate on GSS codes this project doesn't have locally, so
// there is nothing for them to resolve against here. If a future source gives this
// project real GSS-coded LA data, that logic would need porting properly at that
// point; today it would just be dead code operating on a key format nothing supplies.
//
// Cross-validated 2026-09-08 against this project's OWN existing, already-verified
// `la_gss_crosswalk.region` column (20260828130000_la_gss_crosswalk_region.sql --
// reasoned from England's stable 9-region structure, spot-checked against every real
// dfe_code/la_name/gss_code triple already in that table) rather than trusted blind:
// 158/158 comparable English rows matched exactly, all 22 Welsh rows correctly agreed
// (both null-region), and exactly 2 genuine gaps were found and fixed here ("Pre LGR
// (2009) Bedfordshire"/"Cheshire", legacy names present in la_gss_crosswalk's own
// historical rows but not among the then-188 live la_name values this table was first
// built from). This table and la_gss_crosswalk.region are two independently-reasoned
// views of the same real, stable administrative geography, not a guess -- kept as a
// separate la_name-keyed table rather than a live join to la_gss_crosswalk (which is
// la_code/dfe_code-keyed) because every other LA-scoped comparator function in this
// codebase (buildLaComparatorSet, adjacentLaCandidates) already keys on la_name, not
// la_code -- joining through a second key here would be inconsistent with that, not
// simpler.

export type Nation = "england" | "wales";

// Real ONS GSS region codes for the 9 English regions, standard ordering
// (E12000001-E12000009). Wales has no sub-region in this scheme; W92000004 is Wales's
// own real ONS country-level GSS code, used here as nation-level pseudo-region code
// so `school_region_nation.region_code` is never null for a real English/Welsh school.
const REGION_NAME_TO_ONS_CODE: Record<string, string> = {
  "North East": "E12000001",
  "North West": "E12000002",
  "Yorkshire and The Humber": "E12000003",
  "East Midlands": "E12000004",
  "West Midlands": "E12000005",
  "East of England": "E12000006",
  London: "E12000007",
  "South East": "E12000008",
  "South West": "E12000009",
  Wales: "W92000004",
};

// Every one of the 188 distinct `la_name` values live in this project's `schools`
// table as of 2026-09-08, classified exhaustively -- nothing left unmapped. Pre-LGR
// legacy names (schools whose la_name predates a 2019/2021/2023 local-government
// reorganisation) are mapped to their real current region, not dropped, since they're
// genuine English schools, just carrying a stale LA label upstream in GIAS.
const LA_NAME_TO_REGION: Record<string, string> = {
  // North East
  "County Durham": "North East",
  Darlington: "North East",
  Gateshead: "North East",
  Hartlepool: "North East",
  Middlesbrough: "North East",
  "Newcastle upon Tyne": "North East",
  "North Tyneside": "North East",
  Northumberland: "North East",
  "Redcar and Cleveland": "North East",
  "South Tyneside": "North East",
  "Stockton-on-Tees": "North East",
  Sunderland: "North East",

  // North West
  "Blackburn with Darwen": "North West",
  Blackpool: "North West",
  Bolton: "North West",
  Bury: "North West",
  "Cheshire East": "North West",
  "Cheshire West and Chester": "North West",
  Cumberland: "North West",
  "Pre-LGR 2023 Cumbria": "North West",
  "Pre LGR (2009) Cheshire": "North West",
  Halton: "North West",
  Knowsley: "North West",
  Lancashire: "North West",
  Liverpool: "North West",
  Manchester: "North West",
  Oldham: "North West",
  Rochdale: "North West",
  Salford: "North West",
  Sefton: "North West",
  "St. Helens": "North West",
  Stockport: "North West",
  Tameside: "North West",
  Trafford: "North West",
  Warrington: "North West",
  "Westmorland and Furness": "North West",
  Wigan: "North West",
  Wirral: "North West",

  // Yorkshire and The Humber
  Barnsley: "Yorkshire and The Humber",
  Bradford: "Yorkshire and The Humber",
  Calderdale: "Yorkshire and The Humber",
  Doncaster: "Yorkshire and The Humber",
  "East Riding of Yorkshire": "Yorkshire and The Humber",
  "Kingston upon Hull, City of": "Yorkshire and The Humber",
  Kirklees: "Yorkshire and The Humber",
  Leeds: "Yorkshire and The Humber",
  "North East Lincolnshire": "Yorkshire and The Humber",
  "North Lincolnshire": "Yorkshire and The Humber",
  "North Yorkshire": "Yorkshire and The Humber",
  Rotherham: "Yorkshire and The Humber",
  Sheffield: "Yorkshire and The Humber",
  Wakefield: "Yorkshire and The Humber",
  York: "Yorkshire and The Humber",

  // East Midlands
  Derby: "East Midlands",
  Derbyshire: "East Midlands",
  Leicester: "East Midlands",
  Leicestershire: "East Midlands",
  Lincolnshire: "East Midlands",
  "North Northamptonshire": "East Midlands",
  "Pre-LGR 2021 Northamptonshire": "East Midlands",
  Nottingham: "East Midlands",
  Nottinghamshire: "East Midlands",
  Rutland: "East Midlands",
  "West Northamptonshire": "East Midlands",

  // West Midlands
  Birmingham: "West Midlands",
  Coventry: "West Midlands",
  Dudley: "West Midlands",
  "Herefordshire, County of": "West Midlands",
  Sandwell: "West Midlands",
  Shropshire: "West Midlands",
  Solihull: "West Midlands",
  Staffordshire: "West Midlands",
  "Stoke-on-Trent": "West Midlands",
  "Telford and Wrekin": "West Midlands",
  Walsall: "West Midlands",
  Warwickshire: "West Midlands",
  Wolverhampton: "West Midlands",
  Worcestershire: "West Midlands",

  // East of England
  Bedford: "East of England",
  "Central Bedfordshire": "East of England",
  "Pre LGR (2009) Bedfordshire": "East of England",
  Cambridgeshire: "East of England",
  Essex: "East of England",
  Hertfordshire: "East of England",
  Luton: "East of England",
  Norfolk: "East of England",
  Peterborough: "East of England",
  "Southend-on-Sea": "East of England",
  Suffolk: "East of England",
  Thurrock: "East of England",

  // London (32 boroughs + City of London)
  "Barking and Dagenham": "London",
  Barnet: "London",
  Bexley: "London",
  Brent: "London",
  Bromley: "London",
  Camden: "London",
  "City of London": "London",
  Croydon: "London",
  Ealing: "London",
  Enfield: "London",
  Greenwich: "London",
  Hackney: "London",
  "Hammersmith and Fulham": "London",
  Haringey: "London",
  Harrow: "London",
  Havering: "London",
  Hillingdon: "London",
  Hounslow: "London",
  Islington: "London",
  "Kensington and Chelsea": "London",
  "Kingston upon Thames": "London",
  Lambeth: "London",
  Lewisham: "London",
  Merton: "London",
  Newham: "London",
  Redbridge: "London",
  "Richmond upon Thames": "London",
  Southwark: "London",
  Sutton: "London",
  "Tower Hamlets": "London",
  "Waltham Forest": "London",
  Wandsworth: "London",
  Westminster: "London",

  // South East
  "Bracknell Forest": "South East",
  "Brighton and Hove": "South East",
  Buckinghamshire: "South East",
  "East Sussex": "South East",
  Hampshire: "South East",
  "Isle of Wight": "South East",
  Kent: "South East",
  Medway: "South East",
  "Milton Keynes": "South East",
  Oxfordshire: "South East",
  Portsmouth: "South East",
  Reading: "South East",
  Slough: "South East",
  Southampton: "South East",
  Surrey: "South East",
  "West Berkshire": "South East",
  "West Sussex": "South East",
  "Windsor and Maidenhead": "South East",
  Wokingham: "South East",

  // South West
  "Bath and North East Somerset": "South West",
  "Bournemouth, Christchurch and Poole": "South West",
  "Pre-LGR 2019 Bournemouth": "South West",
  "Pre-LGR 2019 Dorset": "South West",
  "Pre-LGR 2019 Poole": "South West",
  "Bristol, City of": "South West",
  Cornwall: "South West",
  Devon: "South West",
  Dorset: "South West",
  Gloucestershire: "South West",
  "Isles Of Scilly": "South West",
  "North Somerset": "South West",
  Plymouth: "South West",
  Somerset: "South West",
  "South Gloucestershire": "South West",
  Swindon: "South West",
  Torbay: "South West",
  Wiltshire: "South West",

  // Wales (22 principal areas) -- region_name set to "Wales" itself (Wales has no
  // ONS sub-region in this scheme), nation derived separately below.
  "Blaenau Gwent": "Wales",
  Bridgend: "Wales",
  Caerphilly: "Wales",
  Cardiff: "Wales",
  Carmarthenshire: "Wales",
  Ceredigion: "Wales",
  Conwy: "Wales",
  Denbighshire: "Wales",
  Flintshire: "Wales",
  Gwynedd: "Wales",
  "Isle of Anglesey": "Wales",
  "Merthyr Tydfil": "Wales",
  Monmouthshire: "Wales",
  "Neath Port Talbot": "Wales",
  Newport: "Wales",
  Pembrokeshire: "Wales",
  Powys: "Wales",
  "Rhondda Cynon Taf": "Wales",
  Swansea: "Wales",
  Torfaen: "Wales",
  "Vale of Glamorgan": "Wales",
  Wrexham: "Wales",
};

// GIAS/DfE sentinel LA-name categories that aren't real comparable English/Welsh
// local authorities at all (overseas forces/offshore establishments, or a genuine
// "not applicable" marker) -- confirmed as the full remaining set once every real LA
// name above is accounted for (188 distinct la_name values total, 158 real English +
// 22 real Welsh + these 8). Deliberately left with no region/nation rather than
// guessed at, so a consumer can see and handle them explicitly instead of silently
// mis-bucketing a handful of overseas-establishment schools into "Other England".
const NON_STANDARD_LA_NAMES = new Set([
  "BFPO Overseas Establishments",
  "Does not apply",
  "Fieldwork Overseas Establishments",
  "Gibraltar Overseas Establishments",
  "Guernsey Offshore Establishments",
  "Isle of Man Offshore Establishments",
  "Jersey Offshore Establishments",
  "Scotland Offshore Establishments",
]);

export type RegionNationResult = {
  regionName: string | null;
  regionCode: string | null;
  nation: Nation | null;
};

const NULL_RESULT: RegionNationResult = { regionName: null, regionCode: null, nation: null };

// Primary entry point: `la_name` (this project's real, verified local key), not an
// ONS or DfE LA code -- see the file-header comment for why a code-keyed lookup isn't
// usable against this project's actual schema. Returns null fields (not a guessed
// fallback) for the small set of non-standard GIAS sentinel LA names.
export function resolveRegionNation(laName: string | null): RegionNationResult {
  if (!laName) return NULL_RESULT;
  const name = laName.trim();
  if (NON_STANDARD_LA_NAMES.has(name)) return NULL_RESULT;
  const region = LA_NAME_TO_REGION[name];
  if (!region) return NULL_RESULT;
  const nation: Nation = region === "Wales" ? "wales" : "england";
  return { regionName: region, regionCode: REGION_NAME_TO_ONS_CODE[region] ?? null, nation };
}
