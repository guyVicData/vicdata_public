"use client";

// VicData 0.8 groups r1 (G2): the banner while a platform admin views a head office (View as for a
// group): read-only and never logged. Drawn from the cookie; the server re-checks platform admin on every
// group request, so anyone else's cookie shows nothing and reads nothing.
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { exitViewAsGroup, viewAsGroupSnapshot, type ViewAsGroup } from "@/lib/groups/view-as-group";
import { VIEW_AS_READ_ONLY } from "@/lib/view-as";

const noSubscribe = () => () => {};
const ACTION = "font-semibold text-[var(--fg)] underline-offset-2 hover:underline";

export function GroupViewAsBanner({ className = "mb-3" }: { className?: string }) {
  // The cookie, read after hydration (the server has none); a string so the snapshot is stable.
  const raw = useSyncExternalStore(noSubscribe, () => JSON.stringify(viewAsGroupSnapshot()), () => "null");
  const v = JSON.parse(raw) as ViewAsGroup | null;
  const router = useRouter();
  if (!v) return null;
  return (
    <div role="status" data-view-as-banner="" className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-2 text-sm text-[var(--muted2)] print:hidden ${className}`}>
      <span className="font-semibold text-[var(--fg)]">Viewing as {v.name} head office</span>
      <span aria-hidden="true">·</span>
      <span>{VIEW_AS_READ_ONLY}</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        className={ACTION}
        onClick={() => {
          exitViewAsGroup();
          router.push("/platform");
        }}
      >
        Back to me
      </button>
    </div>
  );
}
