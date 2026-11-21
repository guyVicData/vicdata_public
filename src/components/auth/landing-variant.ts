import type { LandingVariant } from "./LandingArt";

// 0.8 front door part 3 (A2): which landing background is live. Five designs, one constant; see
// docs/v0.8/front_door_3_screenshots/landing_variant_<variant>_* and src/components/auth/LandingArt.tsx:
//   "bands"       the default (bands v1, Guy 22 Nov: "looked better"): five translucent ribbons fanned across the
//                 lower right, still
//   "bands-long"  bands v3: five bars of different lengths on one diagonal baseline, crossing behind the content,
//                 growing once
//   "bars"        bands v2: the same bars near-horizontal, in a strip reserved below the content, growing once
//   "arcs"        concentric arcs in the phase colours from the lower right, drawn in once
//   "spectrum"    only the fine five-colour line under the logo
// Every movement is off under prefers-reduced-motion.
export const LANDING_VARIANT: LandingVariant = "bands";
