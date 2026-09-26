// Teacher view dashboard: the literal visual values from the approved mockups
// (docs/vicdata_phase3_teacher_view_design_reference_v1.md, Design artifact Version 34).
//
// One module so both phases draw from the same values: the cards, boxes and chip
// header are shared components, and a hex copied into each of them would be a second
// source of truth waiting to drift.
import { comparabilityKey, comparabilityLabel } from "./teacher-view-catalogue";
import { displayBucketFor, KS5_BUCKET_LABEL } from "./dfe-qualification-buckets";
import type { TeacherPhase } from "./teacher-view-phases";
import { shortQualificationLabel } from "@/components/data-view/SubjectAreaSection";

// The phase accent: column icon backgrounds, the 3px bar on every card, the builder
// link, the active fullscreen icon. KS2 has its own, different design (the rebuild brief
// leaves it alone), so it has no accent and its cards keep their plain treatment.
export const PHASE_ACCENT: Record<TeacherPhase, { hex: string; rgb: string } | null> = {
  ks2: null,
  ks4: { hex: "#34d399", rgb: "52,211,153" },
  ks5: { hex: "#a78bfa", rgb: "167,139,250" },
};

// The two standalone features' colours on the Teacher view home (Home.dc.html): amber for
// Recruitment, rose for Meetings. Same shape as PHASE_ACCENT so the home cards treat a
// phase and a feature identically.
export const FEATURE_ACCENT = {
  recruitment: { hex: "#fbbf24", rgb: "251,191,36" },
  meetings: { hex: "#fb7185", rgb: "251,113,133" },
} as const;

// Subject-chip colours. In the mockups a colour belongs to a QUALIFICATION GROUP, not to
// each subject: both GCSE subjects are green and the BTEC one blue, and the pie groups
// its slices the same way ("Geography & Sports (GCSE) — 9%"). Post-16 starts further
// along the cycle (pink, then teal) so its first group never matches the purple accent.
export const SUBJECT_PALETTE = ["#34d399", "#60a5fa", "#a78bfa", "#f472b6", "#2dd4bf", "#f87171"];
const PALETTE_START: Record<TeacherPhase, number> = { ks2: 0, ks4: 0, ks5: 3 };

export const DELTA_POSITIVE = "#34d399";
export const DELTA_NEGATIVE = "#f87171";

// The group key is the existing comparability key (bucket at KS5, qualification type at
// KS4), so "same colour" means exactly what "comparable" already means everywhere else in
// Teacher view.
export function colourByGroup(phase: TeacherPhase, items: { qualificationType: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const it of items) {
    const key = comparabilityKey(phase, it.qualificationType);
    if (!out.has(key)) out.set(key, SUBJECT_PALETTE[(PALETTE_START[phase] + out.size) % SUBJECT_PALETTE.length]);
  }
  return out;
}

// The short qualification label the mockups print after a subject ("Geography · GCSE").
// KS5 already has one (the bucket label). KS4's raw DfE names are long -- "GCSE (9-1)
// Full Course", "OCR Level 1 / 2 Cambridge National Certificate" -- so GCSE is named
// plainly and everything else gets the Data View's existing band-suffix trim.
// The KS4 qualification patterns, named once so the short label below and the family
// grouping after it can never disagree about what counts as GCSE or BTEC/OCR.
const KS4_GCSE = "GCSE (9-1) Full Course";
const KS4_GCSE_DOUBLE = "GCSE (9-1) Full Course (Double Award)";
const isCambridgeNational = (q: string) => /cambridge national/i.test(q);
const isBtec = (q: string) => /^btec/i.test(q);

export function qualificationShortLabel(phase: TeacherPhase, qualificationType: string): string {
  if (phase === "ks5") return comparabilityLabel(phase, qualificationType);
  if (qualificationType === KS4_GCSE) return "GCSE";
  if (qualificationType === KS4_GCSE_DOUBLE) return "GCSE Double Award";
  // The vocational families by their everyday names, as the mockups do ("BTEC & OCR"):
  // "OCR Level 1 / 2 Cambridge National Certificate" is what DfE calls it, but at chip
  // and row size it crowds out the subject it is meant to qualify.
  if (isCambridgeNational(qualificationType)) return "Cambridge National";
  if (isBtec(qualificationType)) return "BTEC";
  return shortQualificationLabel(qualificationType);
}

// KS4's qualification families for onboarding step 1 (GCSE-Step1.dc.html): GCSE, BTEC &
// OCR, everything else. KS5 needs no equivalent -- its families ARE the existing
// KS5_BUCKETS via displayBucketFor (bucketFor, with AS level and AEA under Other).
export type Ks4QualificationFamily = "gcse" | "btec_ocr" | "other_vocational";
export function ks4QualificationFamily(qualificationType: string): Ks4QualificationFamily {
  if (qualificationType === KS4_GCSE || qualificationType === KS4_GCSE_DOUBLE) return "gcse";
  if (isBtec(qualificationType) || isCambridgeNational(qualificationType)) return "btec_ocr";
  return "other_vocational";
}

// One qualification family as onboarding shows it: a tile in step 1, a tab in step 2, a
// legend swatch in step 3. Colours and one-line descriptions are literal from the step 1
// mockups; the KS5 labels are KS5_BUCKET_LABEL itself, not a copy.
export type QualificationFamily = { id: string; label: string; description: string; hex: string; rgb: string };

export const QUALIFICATION_FAMILIES: Record<"ks4" | "ks5", QualificationFamily[]> = {
  ks4: [
    { id: "gcse", label: "GCSE", description: "GCSE (9-1) Full Course, the standard route", hex: "#34d399", rgb: "52,211,153" },
    { id: "btec_ocr", label: "BTEC & OCR", description: "BTEC Technical Award, OCR Cambridge National", hex: "#60a5fa", rgb: "96,165,250" },
    { id: "other_vocational", label: "Other vocational", description: "Other Level 1/2 vocational qualifications, VRQ", hex: "#a1a1aa", rgb: "161,161,170" },
  ],
  ks5: [
    { id: "alevel", label: KS5_BUCKET_LABEL.alevel, description: "A level, Advanced Extension Award", hex: "#f472b6", rgb: "244,114,182" },
    { id: "ib", label: KS5_BUCKET_LABEL.ib, description: "Higher & Standard level, Diploma Core", hex: "#38bdf8", rgb: "56,189,248" },
    { id: "btec_ocr", label: KS5_BUCKET_LABEL.btec_ocr, description: "Vocational and technical qualifications", hex: "#2dd4bf", rgb: "45,212,191" },
    { id: "tlevel", label: KS5_BUCKET_LABEL.tlevel, description: "2-year technical programmes, by pathway", hex: "#fb923c", rgb: "251,146,60" },
    { id: "other", label: KS5_BUCKET_LABEL.other, description: "AS level, EPQ, Core Maths, Pre-U and similar", hex: "#a1a1aa", rgb: "161,161,170" },
  ],
};

// Which family a (subject, qualification) item is shown under. At KS5 the display bucket:
// AS level and AEA sit in "other", not beside A level (displayBucketFor).
export function qualificationFamilyOf(phase: "ks4" | "ks5", qualificationType: string): string {
  return phase === "ks5" ? displayBucketFor(qualificationType) : ks4QualificationFamily(qualificationType);
}

// "Source: DfE Key stage 4 performance, 2024/25", per the mockups' source line.
export const SOURCE_NAME: Record<TeacherPhase, string> = {
  ks2: "DfE Key stage 2 attainment",
  ks4: "DfE Key stage 4 performance",
  ks5: "DfE A level and other 16 to 18 results",
};

export function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}
