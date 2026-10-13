"use client";

// VicData 0.8 SMT round 2: SMT Context -- the area around the school, population only until the
// deprivation and free-school-meals data arrive (the gap is shown). Same access as the Overview.
import { SmtDashboard } from "@/components/smt/SmtDashboard";

export default function SmtContextPage() {
  return <SmtDashboard dash="context" />;
}
