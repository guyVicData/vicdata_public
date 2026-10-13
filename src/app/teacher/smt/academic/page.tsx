"use client";

// VicData 0.8 SMT round 1 (B1): SMT Academic, top-down -- whole school, a phase, a subject area, then
// into the subject explorer with the same set. Same access as the Overview.
import { SmtDashboard } from "@/components/smt/SmtDashboard";

export default function SmtAcademicPage() {
  return <SmtDashboard dash="academic" />;
}
