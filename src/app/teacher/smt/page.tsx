"use client";

// VicData 0.8 SMT round 1 (B1): SMT Overview. SMT (and governors, who hold the SMT role) and the
// School-Admin; platform admins through View as, read-only. src/components/smt/.
import { SmtDashboard } from "@/components/smt/SmtDashboard";

export default function SmtOverviewPage() {
  return <SmtDashboard dash="overview" />;
}
