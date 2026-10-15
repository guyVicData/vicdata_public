"use client";

// VicData 0.8 groups r1 (G2, G3): a member school's own view of its group, on its SMT home (and the
// School-Admin's). Only for a group whose head office holds a VicData group account: whether the school's
// SMT has the group dashboards (head office decides), and -- for the School-Admin -- whether head office
// may see the school's Admissions panels (default off). Nothing else about the group account. Draws
// nothing for a school in no such group, so homes without one are unchanged.
import { useEffect, useState, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { GROUP_ACCENT } from "@/lib/teacher-view-theme";
import { GROUP_NOTES, groupNote } from "@/catalogue/notes";
import { shortDate } from "@/lib/meeting-ops";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { GroupDashChips, GroupGlyph } from "./GroupHome";
import { groupVars } from "./ui";
import { groupToken } from "./useGroupOffices";

type SchoolGroup = { accountId: string; groupId: string; name: string; likely: boolean; groupView: { since: string } | null; shared: boolean };

export function SchoolGroupTile({ urn }: { urn: string | null }) {
  const [theme] = useTeacherTheme();
  const [data, setData] = useState<{ groups: SchoolGroup[]; schoolAdmin: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!urn) return;
    let live = true;
    (async () => {
      const token = await groupToken();
      if (!token) return;
      const res = await fetch(`/api/group/school?urn=${urn}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (live && res?.ok) setData(await res.json());
    })();
    return () => {
      live = false;
    };
  }, [urn]);
  if (!urn || !data || !data.groups.length) return null;

  async function share(g: SchoolGroup, on: boolean) {
    setBusy(g.accountId);
    setError(null);
    const { error: e } = await createBrowserSupabaseClient().rpc("school_set_group_admissions_share", { p_urn: urn, p_account: g.accountId, p_shared: on });
    if (e) setError(e.message);
    else setData((d) => d && { ...d, groups: d.groups.map((x) => (x.accountId === g.accountId ? { ...x, shared: on } : x)) });
    setBusy(null);
  }

  return (
    <>
      {data.groups.map((g) => (
        <div key={g.accountId} data-school-group="" style={{ ...groupVars(theme), "--tile": GROUP_ACCENT.hex, "--tile-rgb": GROUP_ACCENT.rgb } as CSSProperties} className="rounded-[14px] border-[1.5px] border-[var(--group-card-edge)] bg-[var(--panel-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--tile-rgb),0.14)] text-[var(--tile)]">
              <GroupGlyph />
            </div>
            <div className="min-w-0 flex-grow">
              <p className="text-[15px] font-bold">
                {g.name}
                {g.likely && <span title={GROUP_NOTES.likelyWhy} className="ml-2 rounded-[6px] bg-[var(--group-likely-bg)] px-[7px] py-px align-middle text-[10.5px] font-bold text-[var(--group-likely-fg)]">{GROUP_NOTES.likely}</span>}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--muted2)]">{g.groupView ? groupNote("schoolGroupView", { group: g.name, since: shortDate(g.groupView.since.slice(0, 10)) }) : groupNote("schoolNoGroupView", { group: g.name })}</p>
            </div>
          </div>
          {g.groupView && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <GroupDashChips accountId={g.accountId} size="sm" />
            </div>
          )}
          {data.schoolAdmin && (
            <label className="mt-3 flex items-start gap-2.5 text-[12.5px]">
              <button
                type="button"
                role="switch"
                aria-checked={g.shared}
                disabled={busy === g.accountId}
                onClick={() => share(g, !g.shared)}
                className="relative mt-px inline-block h-5 w-[34px] shrink-0 rounded-full border-0 p-0 disabled:opacity-50"
                style={{ background: g.shared ? "var(--group-switch-on)" : "var(--panel-border2)" }}
              >
                <span className="absolute top-[2px] h-4 w-4 rounded-full transition-[left]" style={{ left: g.shared ? 16 : 2, background: g.shared ? "var(--group-switch-knob-on)" : "var(--fg)" }} />
              </button>
              <span>
                <span className="font-bold">{groupNote("shareAdmissions", { group: g.name })}</span>
                <span className="mt-0.5 block text-[11.5px] text-[var(--muted2)]">{GROUP_NOTES.shareWhy}</span>
              </span>
            </label>
          )}
          {error && <p role="alert" className="mt-2 text-[12px] text-[var(--muted2)]">{error}</p>}
        </div>
      ))}
    </>
  );
}
