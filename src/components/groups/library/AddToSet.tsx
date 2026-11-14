"use client";

// VicData 0.8 group sets, M4 (brief v2 §4): the library's "Add to set…" on a card and on a group's page.
// It lists the sets of groups this person may change -- their own (My sets) and, for an admin, the
// group's -- each ticked when the group is already in it; a tick adds or removes the group through the
// same save path as the editor (save_set, under the member's own session), refusing a ninth group
// ("8 is the most a set holds"). "New set with this group…" opens the editor with it in. View as, a peek
// and a member school's SMT never see it enabled (D2). R-GROUP-LIBRARY.
// 0.8 non-mainstream groups (R-NM-SETS): a group of another family than ours (a special and AP trust, a
// nursery federation, or a mainstream group) can't join our sets: the menu says why in one line.
import { useEffect, useRef, useState } from "react";
import { useSmt } from "@/components/smt/api";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { saveGroupSet } from "@/lib/sets/group-store";
import { CAP_WORDS, GROUP_SET_CAP, groupsWord } from "@/lib/groups/group-sets";
import { groupEditorHref } from "@/components/groups/dash/GroupSetPicker";
import type { GroupSetsResponse } from "@/components/sets/GroupSetEditor";
import { setRefusal } from "@/lib/groups/non-mainstream";

export function AddToSet({ groupId, account, query, readOnly, ourKind = null, groupKind = null, groupName }: { groupId: string; account: string; query: string; readOnly: boolean; ourKind?: string | null; groupKind?: string | null; groupName?: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const load = useSmt<GroupSetsResponse>(open ? `/api/group/sets?${query}${v ? `&v=${v}` : ""}` : null, null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", k);
    window.addEventListener("mousedown", down);
    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("mousedown", down);
    };
  }, [open]);
  if (readOnly) {
    return (
      <button type="button" disabled title="Read-only: sets are kept by the group's head office" className="cursor-not-allowed rounded-full border border-[var(--panel-border2)] px-3 py-1 text-[12px] font-bold text-[var(--muted2)] opacity-70">
        Add to set…
      </button>
    );
  }
  const refused = setRefusal(ourKind, groupKind, groupName);
  const d = load.status === "ready" ? load.data : null;
  const writable = d ? d.sets.filter((s) => s.kind === "group_peers" && !s.archived && ((s.scope === "personal" && s.ownerProfileId === d.viewer.userId) || (s.scope === "group" && d.can.admin))) : [];
  const toggle = async (id: string) => {
    const s = writable.find((x) => x.id === id);
    if (!s || refused) return;
    const has = s.members.includes(groupId);
    if (!has && s.members.length >= GROUP_SET_CAP) return setMsg(CAP_WORDS);
    setBusy(true);
    setMsg(null);
    const r = await saveGroupSet(createBrowserSupabaseClient(), s.id, "group_peers", {}, has ? s.members.filter((m) => m !== groupId) : [...s.members, groupId]);
    setBusy(false);
    if ("error" in r) setMsg(r.error);
    else {
      setMsg(has ? `Taken out of ${s.name}.` : `Added to ${s.name}.`);
      setV((n) => n + 1);
    }
  };
  const here = typeof window === "undefined" ? "/teacher/group/groups" : `${window.location.pathname}${window.location.search}`;
  return (
    <div ref={ref} className="relative" data-add-to-set={groupId}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-full border border-[var(--accent)] px-3 py-1 text-[12px] font-bold text-[var(--fg)]">
        Add to set…
      </button>
      {open && (
        <div role="menu" className="absolute bottom-[calc(100%+6px)] right-0 z-40 w-[290px] max-w-[88vw] rounded-[12px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] p-1 text-[12.5px] shadow-xl">
          {refused ? (
            <div className="px-3 py-2 text-[var(--muted)]" data-set-refused="" role="status">{refused}</div>
          ) : !d ? (
            <div className="px-3 py-2 text-[var(--muted2)]">{load.status === "error" ? load.message : "Loading your sets…"}</div>
          ) : d.notSetUp ? (
            <div className="px-3 py-2 text-[var(--muted2)]">Sets of groups aren&rsquo;t switched on yet.</div>
          ) : (
            <>
              {writable.length === 0 && <div className="px-3 py-2 text-[var(--muted2)]">No sets of groups you can change yet.</div>}
              {writable.map((s) => {
                const on = s.members.includes(groupId);
                return (
                  <button key={s.id} type="button" role="menuitemcheckbox" aria-checked={on} disabled={busy} onClick={() => toggle(s.id)} className="flex min-h-[34px] w-full items-center gap-2 rounded-[8px] px-3 py-1 text-left hover:bg-[var(--box-bg)] disabled:opacity-50">
                    <span className="w-[14px] shrink-0 text-[var(--accent)]">{on ? "✓" : ""}</span>
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 text-[11px] text-[var(--muted2)]">{s.scope === "group" ? "Head office · " : ""}{groupsWord(s.members.length)}</span>
                  </button>
                );
              })}
              {msg && <div className="px-3 py-1.5 text-[11.5px] font-semibold" role="status">{msg}</div>}
              <div className="border-t border-[var(--panel-border)] pt-1">
                <a href={groupEditorHref({ account, kind: "group_peers", members: [groupId], name: "New set of groups", returnTo: here })} className="flex min-h-[34px] items-center rounded-[8px] px-3 hover:bg-[var(--box-bg)]">
                  New set with this group…
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
