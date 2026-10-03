"use client";

// Teacher view phase dashboard (design brief v2 §§5, 6, 7, 14).
//
// VicData 0.6 E: the page's body -- data loading, derivation, onboarding and the three
// column hosts -- moved, unchanged, into TeacherDashboard, so the same dashboard can be
// drawn outside this page (custom dashboards, meeting slots, the chooser's preview). This
// route renders it in mode "page": exactly the page as it was, nav, control bar,
// onboarding, look-as and the ?renderer=config flag included.
import { useParams } from "next/navigation";
import { TeacherDashboard } from "@/components/dashboard-config/TeacherDashboard";

export default function TeacherPhaseDashboard() {
  const params = useParams<{ phase: string }>();
  return <TeacherDashboard phase={params.phase} mode="page" />;
}
