// The 2025/26 sixth-form rehearsal (0.8 SMT Academic, R-SMT-YEARS): Post-16 2025/26 arrives, provisional,
// with its value added (DfE's mid-November release); GCSE stays where the data has it. Preload:
//   npx -y tsx --env-file=.env.local --env-file=.env --import ./scripts/year-rehearsal/install-ks5-2025.ts <script> ...
import { installSyntheticYear } from "./synthetic-year";

installSyntheticYear({ stage: "ks5", from: 2024, to: 2025, provisional: true, verbose: !!process.env.SYNTHETIC_VERBOSE });
