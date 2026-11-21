import type { LandingVariant } from "./LandingArt";

// 0.8 front door part 3 (A2): which landing background is live. Three designs, one constant; see
// docs/v0.8/front_door_3_screenshots/landing_<variant>_* and src/components/auth/LandingArt.tsx:
//   "bands"     the default (Guy, 22 Nov): five translucent bars of different lengths across the foot of the page,
//               a bar chart in the phase colours, growing to their lengths once (off under reduced motion)
//   "arcs"      concentric arcs in the phase colours from the lower right, drawn in once (off under reduced motion)
//   "spectrum"  only the fine five-colour line under the logo
export const LANDING_VARIANT: LandingVariant = "bands";
