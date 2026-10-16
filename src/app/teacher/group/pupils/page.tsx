"use client";

// VicData 0.8 groups r3: the group's Pupils dashboard (docs/wireframes/groups). The same access as Overview
// and Schools; the server decides (/api/group/dash). src/components/groups/dash/.
import { GroupDashboard } from "@/components/groups/dash/GroupDashboard";

export default function GroupPupilsPage() {
  return <GroupDashboard dash="pupils" />;
}
