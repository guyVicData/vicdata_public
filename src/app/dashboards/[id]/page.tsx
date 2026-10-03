// VicData 0.6 E: a stored dashboard config, drawn live (CustomDashboardScreen). The id is
// the dashboard's uuid or its slug ("vicdata.ks4.candidates").
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
  return <CustomDashboardScreen id={decoded(id)} />;
}
