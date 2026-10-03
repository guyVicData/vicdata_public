// /dashboards/[id]/edit (VicData 0.6 S5): the dashboard editor. Super-admin only (the
// client screen asks is_platform_admin and shows the plain 404 otherwise, as /platform
// does). `id` is the dashboard's uuid or its slug ("vicdata.ks4.candidates").
import { EditorScreen } from "@/components/editor/EditorScreen";

export default async function EditDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorScreen id={id} />;
}
