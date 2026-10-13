"use client";

// VicData 0.8 SMT round 2: SMT Pupils -- the roll, shape and size, Admissions' entry points, leaving at
// 16 and market share (read-only), and their trends. Same access as the Overview.
import { SmtDashboard } from "@/components/smt/SmtDashboard";

export default function SmtPupilsPage() {
  return <SmtDashboard dash="pupils" />;
}
