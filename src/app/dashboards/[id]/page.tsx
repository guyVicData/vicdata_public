// VicData 0.6 E: a stored dashboard config, drawn live (CustomDashboardScreen). The id is
// the dashboard's uuid or its slug ("vicdata.ks4.candidates").
import { redirect } from "next/navigation";
import { CustomDashboardScreen } from "@/components/dashboard-config/CustomDashboardScreen";

function decoded(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 0.7 admissions r2: an Admissions dashboard is drawn by the Admissions page.
  const slug = decoded(id);
  if (slug === "vicdata.admissions.pipelines" || slug === "vicdata.admissions.market-share") redirect(`/teacher/admissions?view=${slug.slice("vicdata.admissions.".length)}`);
  return <CustomDashboardScreen id={slug} />;
}
