"use client";

// VicData 0.8 front door (B11): the walk player. Milestone 3 ships the homes, whose arrows land here; until
// the walks are built (milestone 5) a walk opens its dashboard.
import { useEffect } from "react";
import { walkById } from "@/lib/front-door/walks";

export function WalkPage({ walkId }: { walkId: string }) {
  const walk = walkById(walkId);
  useEffect(() => {
    window.location.replace(walk?.dashboard ?? "/teacher");
  }, [walk]);
  return <main className="mx-auto max-w-3xl p-6 text-sm text-neutral-500">Opening…</main>;
}
