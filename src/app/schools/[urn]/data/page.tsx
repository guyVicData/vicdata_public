"use client";

import { use } from "react";
import DataViewShell from "@/components/data-view/DataViewShell";

// Member Data View entry route (build brief v1) -- a real route, not a tab within the
// public /schools/[urn] page, since this is member-only paid content requiring its
// own auth/membership gate (DataViewShell's own job), distinct from that page's
// free/paid-woven-in sections. "use client" + `use(params)` matches this repo's own
// existing pattern for a dynamic-route client page (see /sets/[id]/page.tsx).
export default function SchoolDataViewPage({ params }: { params: Promise<{ urn: string }> }) {
  const { urn } = use(params);
  return <DataViewShell urn={urn} />;
}
