// VicData 0.8 group sets, M3: one group's page in the library. Head office only (/api/group/library/group).
import { GroupLibraryPage } from "@/components/groups/library/GroupLibraryPage";

function decoded(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export default async function GroupLibraryGroupRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupLibraryPage id={decoded(id)} />;
}
