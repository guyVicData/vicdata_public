"use client";

// VicData 0.8 groups r2: the group's Schools dashboard (docs/wireframes/groups). Head office of the group,
// a member school's SMT while it holds a grant, and platform admins through View as; the server decides
// (/api/group/dash). src/components/groups/dash/.
import { GroupDashboard } from "@/components/groups/dash/GroupDashboard";

export default function GroupSchoolsPage() {
  return <GroupDashboard dash="schools" />;
}
