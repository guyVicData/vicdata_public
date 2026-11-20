// SMT's headline measure keys, client-safe (population.ts, which re-exports them, is server-only): the dashboard
// and the home read the same keys the server ranks on.

// HEADLINE_MEASURE.ks2 (academic-data-view.ts, server-only): smt-measures.test.ts keeps the two equal.
const KS2_RWM = "Reading, writing and maths::expected_standard_pupil_percent";

export const SMT_MEASURES = {
  ks4: { a8: "attainment8_average", em5: "engmath_95_percent", em4: "engmath_94_percent", p8: "progress8_average", p8lo: "progress8_lower_95_ci", p8hi: "progress8_upper_95_ci" },
  // 20 Nov (Guy, Leighton Park prep): DfE's "Academic" figures -- A level, IB, Pre-U, AS and the EPQ on one points
  // scale -- so IB and Pre-U students count and IB-only schools are ranked (2,520 with a figure in 2024/25, against
  // 2,464 on A level alone; 56 have only an Academic figure, Sevenoaks among them). Value added the same way.
  ks5: { aps: "Academic::aps_per_entry", va: "Academic::value_added", valo: "Academic::value_added_lower_ci", vahi: "Academic::value_added_upper_ci", band: "Academic::progress_banding" },
  ks2: { rwm: KS2_RWM },
} as const;
