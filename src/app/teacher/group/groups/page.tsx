"use client";

// VicData 0.8 group sets, M3: the groups library (brief v2 §4). Head office only; the server decides
// (/api/group/library). src/components/groups/library/.
import { GroupLibrary } from "@/components/groups/library/GroupLibrary";

export default function GroupLibraryRoute() {
  return <GroupLibrary />;
}
