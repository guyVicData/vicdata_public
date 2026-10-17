"use client";

// VicData 0.8 groups r1 (G2): the banner while a platform admin views a head office (View as for a
// group): read-only. 0.8 View as: head office is a View as role in the one cookie, so this is the one
// View as banner ("Viewing as Head office · Harris Federation · View as: read-only · Change · Back to
// me"). The server re-checks platform admin on every group request, so anyone else's cookie shows
// nothing and reads nothing.
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";

export function GroupViewAsBanner({ className = "mb-3" }: { className?: string }) {
  return <ViewAsBanner className={className} />;
}
