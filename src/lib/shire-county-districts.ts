// Real ONS GSS codes for the constituent lower-tier districts of England's remaining
// two-tier shire counties (births chart, population-trends-panel build, 2026-09-27).
//
// The gotcha this exists for: ons_births (canonical_facts_current) publishes at
// district/unitary/borough level only (E06/E07/E08/E09 prefixes) -- confirmed live,
// zero E10 (county council) rows exist anywhere in the source. A shire county's own
// la_gss_crosswalk.gss_code is the COUNTY-level E10 code, which therefore never has
// real ons_births data of its own; the real figure has to be the SUM of its real
// constituent districts instead.
//
// Scope, confirmed against live data, not assumed: every DISTINCT la_code among this
// database's own real open schools (183 of them) was checked against
// la_gss_crosswalk's own resolved gss_code for real ons_births data. 132 resolve
// directly (unitary authorities, London/metropolitan boroughs -- no aggregation
// needed). These 21 are exactly the ones that don't -- genuinely still two-tier
// shire counties as of the April-2023 ONS Local Authority District to County lookup
// (the source used to build this list; Surrey's 11 districts were independently
// hand-verified first and used as a calibration check against that source -- exact
// match). Every code below (164 total) was independently verified against live
// ons_births data before use -- real rows found for every one, back to 1992.
//
// Wales is a separate, different gap -- confirmed zero ons_births coverage at ANY
// period for Welsh unitary authorities (their own, already-finest-level codes), not
// a geography-mismatch problem a crosswalk could fix. Welsh schools correctly show
// no births chart at all (honest "no data," same as every other missing-source case
// on this page), not routed through this table.
//
// Keyed by the school's own DfE la_code (schools.la_code / la_gss_crosswalk.dfe_code).
export const SHIRE_COUNTY_DISTRICT_GSS_CODES: Record<string, string[]> = {
  "873": ["E07000008", "E07000009", "E07000010", "E07000011", "E07000012"], // Cambridgeshire
  "830": ["E07000032", "E07000033", "E07000034", "E07000035", "E07000036", "E07000037", "E07000038", "E07000039"], // Derbyshire
  "878": ["E07000040", "E07000041", "E07000042", "E07000043", "E07000044", "E07000045", "E07000046", "E07000047"], // Devon
  "845": ["E07000061", "E07000062", "E07000063", "E07000064", "E07000065"], // East Sussex
  "881": [
    "E07000066", "E07000067", "E07000068", "E07000069", "E07000070", "E07000071",
    "E07000072", "E07000073", "E07000074", "E07000075", "E07000076", "E07000077",
  ], // Essex
  "916": ["E07000078", "E07000079", "E07000080", "E07000081", "E07000082", "E07000083"], // Gloucestershire
  "850": [
    "E07000084", "E07000085", "E07000086", "E07000087", "E07000088",
    "E07000089", "E07000090", "E07000091", "E07000092", "E07000093", "E07000094",
  ], // Hampshire
  "919": [
    "E07000095", "E07000096", "E07000098", "E07000099", "E07000102", "E07000103",
    "E07000240", "E07000241", "E07000242", "E07000243",
  ], // Hertfordshire
  "886": [
    "E07000105", "E07000106", "E07000107", "E07000108", "E07000109", "E07000110",
    "E07000111", "E07000112", "E07000113", "E07000114", "E07000115", "E07000116",
  ], // Kent (E07000112 "Folkestone and Hythe", renamed from Shepway 2018, same code)
  "888": [
    "E07000117", "E07000118", "E07000119", "E07000120", "E07000121", "E07000122",
    "E07000123", "E07000124", "E07000125", "E07000126", "E07000127", "E07000128",
  ], // Lancashire
  "855": ["E07000129", "E07000130", "E07000131", "E07000132", "E07000133", "E07000134", "E07000135"], // Leicestershire
  "925": ["E07000136", "E07000137", "E07000138", "E07000139", "E07000140", "E07000141", "E07000142"], // Lincolnshire
  "926": ["E07000143", "E07000144", "E07000145", "E07000146", "E07000147", "E07000148", "E07000149"], // Norfolk
  "891": ["E07000170", "E07000171", "E07000172", "E07000173", "E07000174", "E07000175", "E07000176"], // Nottinghamshire
  "931": ["E07000177", "E07000178", "E07000179", "E07000180", "E07000181"], // Oxfordshire
  "860": ["E07000192", "E07000193", "E07000194", "E07000195", "E07000196", "E07000197", "E07000198", "E07000199"], // Staffordshire
  "935": ["E07000200", "E07000202", "E07000203", "E07000244", "E07000245"], // Suffolk
  "936": [
    "E07000207", "E07000208", "E07000209", "E07000210", "E07000211",
    "E07000212", "E07000213", "E07000214", "E07000215", "E07000216", "E07000217",
  ], // Surrey
  "937": ["E07000218", "E07000219", "E07000220", "E07000221", "E07000222"], // Warwickshire
  "938": ["E07000223", "E07000224", "E07000225", "E07000226", "E07000227", "E07000228", "E07000229"], // West Sussex
  "885": ["E07000234", "E07000235", "E07000236", "E07000237", "E07000238", "E07000239"], // Worcestershire
};
