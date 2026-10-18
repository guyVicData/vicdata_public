"use client";

// VicData 0.8 notes and feedback (decision 4): reopening a feedback item's view. The Open link
// (feedbackOpenHref) restores what the address can carry -- the school or group and role (a peek), the
// dashboard, the panel and view, and each product's own address state -- and this small banner shows
// the state the item recorded beside what the page now has, so whatever the address can't restore
// (a saved set, a pill, the year) is still in front of whoever triages it.
import { useEffect, useState } from "react";
import { FB_ITEM_PARAM, RESTORED_BY_ADDRESS, parseFeedbackNumber, type ViewSurface } from "@/lib/view-ref";
import { feedbackToken } from "./store";

type Recorded = { ref: string; created_london: string; author_name: string; view_as: boolean; role: string | null; school_or_group: string | null; view_label: string | null; dashboard_name: string | null; state: Record<string, unknown>; body: string; looks_good: boolean };

export function FeedbackOpenBanner({ surface }: { surface: ViewSurface }) {
  const [number] = useState(() => (typeof window === "undefined" ? null : parseFeedbackNumber(new URLSearchParams(window.location.search).get(FB_ITEM_PARAM))));
  const [item, setItem] = useState<Recorded | null>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (number === null) return;
    let live = true;
    (async () => {
      const token = await feedbackToken();
      const res = await fetch(`/api/platform/feedback?number=F-${number}`, { headers: { Authorization: `Bearer ${token ?? ""}` } }).catch(() => null);
      const json = res && res.ok ? ((await res.json()) as { items?: Recorded[] }) : null;
      if (live) setItem(json?.items?.[0] ?? null);
    })();
    return () => {
      live = false;
    };
  }, [number]);
  if (number === null || closed || !item) return null;
  const rows = Object.entries(item.state ?? {}).filter(([, v]) => v !== null && v !== "");
  const now = surface.state;
  const restore = RESTORED_BY_ADDRESS[surface.product];
  return (
    <aside data-fb-open-banner="" role="status" className="fixed bottom-3 left-3 z-[1650] w-[22rem] max-w-[calc(100vw-24px)] rounded-[12px] border border-[var(--fb-open)] bg-[var(--panel-bg)] p-3 text-[11.5px] leading-snug text-[var(--fg)] shadow-[0_10px_24px_rgba(0,0,0,0.25)] print:hidden">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {item.ref} · {item.view_label} <span className="font-normal text-[var(--muted2)]">· {item.dashboard_name}</span>
          </p>
          <p className="text-[var(--muted2)]">
            {item.created_london} · {item.author_name}
            {item.view_as ? ` · View as ${item.role ?? ""}` : ""} · {item.school_or_group}
          </p>
        </div>
        <button type="button" aria-label="Close" onClick={() => setClosed(true)} className="text-[var(--muted)] hover:text-[var(--fg)]">
          ✕
        </button>
      </div>
      {item.body.trim() && <p className="mt-1.5 line-clamp-3 italic text-[var(--muted)]">&ldquo;{item.body.trim()}&rdquo;</p>}
      {rows.length > 0 && (
        <table className="mt-2 w-full">
          <tbody>
            {rows.map(([k, v]) => {
              const same = String(now[k] ?? "") === String(v);
              return (
                <tr key={k} data-fb-state={same ? "same" : "differs"}>
                  <td className="pr-2 align-top text-[var(--muted2)]">{k}</td>
                  <td className="align-top">
                    {String(v)}
                    {!same && <span className="block text-[var(--fb-open)]">now: {now[k] === null || now[k] === undefined ? "—" : String(now[k])}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[10.5px] text-[var(--muted3)]">The address restored: {restore.restores.join(", ")}. Shown here only: {restore.bannerOnly.join(", ")}.</p>
    </aside>
  );
}
