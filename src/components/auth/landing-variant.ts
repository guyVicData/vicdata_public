import type { LandingVariant } from "./LandingArt";

// 0.8 front door part 3 (A2): which landing background is live. Three designs, one constant; see
// docs/v0.8/front_door_3_screenshots/landing_<variant>_* and src/components/auth/LandingArt.tsx:
//   "arcs"      concentric arcs in the phase colours from the lower right, drawn in once (off under reduced motion)
//   "spectrum"  only the fine five-colour line under the logo
//   "bands"     translucent ribbons in the same colours, fanned across the lower right
export const LANDING_VARIANT: LandingVariant = "arcs";
