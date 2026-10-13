// The 2025/26 GCSE rehearsal (year rules report, Y3): GCSE 2025/26 arrives, provisional, with no
// Progress 8; Post-16 stays at 2024/25. Preload into a capture process:
//   npx -y tsx --env-file=.env --import ./scripts/year-rehearsal/install-ks4-2025.ts <script> ...
import { installSyntheticYear } from "./synthetic-year";

installSyntheticYear({ stage: "ks4", from: 2024, to: 2025, provisional: true, notPublished: ["progress8", "progress_8", "p8_"], verbose: !!process.env.SYNTHETIC_VERBOSE });
