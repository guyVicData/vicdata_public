import type { LandingVariant } from "./LandingArt";

// 0.8 front door part 3 (A2): which landing background is live. Four designs, one constant; see
// docs/v0.8/front_door_3_screenshots/landing_variant_<variant>_* and src/components/auth/LandingArt.tsx:
//   "bands"     the default (bands v3, Guy 22 Nov): five translucent bars of different lengths on one diagonal
//               baseline, crossing the page behind the content (a soft local fade keeps it legible), growing once
//   "bars"      bands v2: the same bars near-horizontal, in a strip reserved below the content
//   "arcs"      concentric arcs in the phase colours from the lower right, drawn in once
//   "spectrum"  only the fine five-colour line under the logo
// Every movement is off under prefers-reduced-motion.
export const LANDING_VARIANT: LandingVariant = "bands";
