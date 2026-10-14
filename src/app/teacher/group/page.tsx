"use client";

// VicData 0.8 groups r1 (G3): the head-office home. Under /teacher so the shell's nav, theme and Home
// link work as on every role home (logged: /teacher/group rather than /group).
import { GroupHome } from "@/components/groups/GroupHome";

export default function GroupHomePage() {
  return <GroupHome />;
}
