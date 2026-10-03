"use client";

// 0.6 S1: super-admin "Schools" (docs/wireframes/v0.6/Platform.dc.html). Platform admins
// only; everyone else sees a plain 404.
import { PlatformScreen } from "@/components/admin/PlatformScreen";

export default function PlatformPage() {
  return <PlatformScreen />;
}
