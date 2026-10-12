"use client";

// VicData 0.7 admissions r2 (D2): the home page's Admissions tile -- for Admissions, SMT and the
// School-Admin (and a platform admin through View as as one of them). Teachers never get it.
import { HomeCard } from "@/components/teacher/HomeCard";
import { ROLE_ACCENT } from "@/lib/teacher-view-theme";

const AdmissionsGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
);

export function AdmissionsTile() {
  return (
    <HomeCard
      href="/teacher/admissions"
      colour={ROLE_ACCENT.admissions!}
      icon={<AdmissionsGlyph />}
      title="Admissions"
      description="Who will reach our entry points, and how do we compare with our rivals?"
    />
  );
}
