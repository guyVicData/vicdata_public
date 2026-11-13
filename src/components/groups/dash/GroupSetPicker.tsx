"use client";

// VicData 0.8 group sets, M4 (brief v2 §5.1, §5.2; Guy's D2, D8; R-GROUP-SET-PICKER): the one set
// picker on the Group pages' Overview, Academic and Pupils. It is the shared SetSelector -- "Compared
// against", the button holding the set's name and "n groups" -- with its three blocks: Default (computed,
// never stored), Group sets (made by the head office, "Head office" in the group's colour) and My sets
// ("n of 8"); then Edit this set…, New set…, Make default (admins), Duplicate to My sets (a group set),
// Manage sets. A member school's SMT, View as and a peek get Default and the group's sets, read-only: no
// actions and no My sets (D2).
import { useState } from "react";
import { SetSelector, type SetMenuAction, type SetMenuRow } from "@/components/sets/SetSelector";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { clearGroupDefault, makeGroupDefault } from "@/lib/sets/group-store";
import { groupsWord, type GroupSetRow } from "@/lib/groups/group-sets";
import type { Picker } from "@/lib/groups/dash";
import type { GroupSetsInfo } from "@/lib/groups/group-sets-server";

const here = () => (typeof window === "undefined" ? "/teacher/group/overview" : `${window.location.pathname}${window.location.search}`);

/** The editor's address for a set of groups on this group (group mode: account and kind). */
export function groupEditorHref(o: { account: string; kind: "group_peers" | "group_schools"; set?: string | null; members?: string[]; name?: string; from?: string; returnTo?: string }): string {
  const q = new URLSearchParams({ account: o.account, kind: o.kind });
  if (o.set) q.set("set", o.set);
  if (o.members?.length) q.set(o.kind === "group_peers" ? "groups" : "urns", o.members.join(","));
  if (o.name) q.set("name", o.name);
  if (o.from) q.set("from", o.from);
  q.set("product", "group");
  q.set("returnTo", o.returnTo ?? here());
  return `/sets/edit?${q}`;
}

export const setRowOf = (s: GroupSetRow, defaultId: string | null): SetMenuRow => ({
  key: `set:${s.id}`,
  name: s.name,
  count: s.members.length,
  countText: s.kind === "group_peers" ? groupsWord(s.members.length) : `${s.members.length} school${s.members.length === 1 ? "" : "s"}`,
  creator: s.scope === "group" ? "group" : "me",
  creatorLabel: s.scope === "group" ? "Head office" : undefined,
  pinned: s.pinned,
  title: `${s.name}${s.id === defaultId ? " · the group's default" : ""}`,
  lastUsedAt: s.updatedAt,
});

export function GroupSetPicker({ picker, sets, account, phone, onPick, onChanged, defaultOpen }: { picker: Picker; sets: GroupSetsInfo; account: string; phone: boolean; onPick: (key: string) => void; onChanged: () => void; defaultOpen?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const peers = sets.sets.filter((s) => s.kind === "group_peers");
  const groupSets = peers.filter((s) => s.scope === "group");
  const mine = peers.filter((s) => s.scope === "personal");
  const current = picker.set?.setId ? peers.find((s) => s.id === picker.set!.setId) ?? null : null;
  const defaultId = sets.defaults.group_peers;
  const go = (href: string) => window.location.assign(href);

  const rows = {
    default: picker.defaults.map((d): SetMenuRow => ({ key: d.key, name: d.name, count: null, countText: d.countText, creator: "default", title: d.title })),
    school: groupSets.map((s) => setRowOf(s, defaultId)),
    mine: mine.map((s) => setRowOf(s, defaultId)),
  };

  const extra: SetMenuAction[] = [];
  let onEdit: SetMenuAction | null = null;
  let onNew: SetMenuAction | null = null;
  if (sets.canKeep && !sets.notSetUp) {
    const g = picker.set;
    if (current && (current.scope === "personal" || sets.admin)) onEdit = { label: "Edit this set…", onClick: () => go(groupEditorHref({ account, kind: "group_peers", set: current.id })) };
    else if (g && g.groups.length) onEdit = { label: g.source === "unsaved" ? "Save this set…" : "Edit this set…", title: "Opens as a copy, to save as a set", onClick: () => go(groupEditorHref({ account, kind: "group_peers", members: g.groups.map((x) => x.id), name: g.source === "nearest" ? "Nearest in size" : "New set", from: g.key })) };
    onNew = { label: "New set…", onClick: () => go(groupEditorHref({ account, kind: "group_peers" })) };
    if (current && current.scope === "group") extra.push({ label: "Duplicate to My sets…", title: "A private copy, yours to change", onClick: () => go(groupEditorHref({ account, kind: "group_peers", members: current.members, name: `${current.name} (copy)`, from: `set:${current.id}` })) });
    if (sets.admin) {
      const run = (label: string, fn: () => Promise<string | null>) => async () => {
        setBusy(label);
        const err = await fn();
        setBusy(null);
        if (err) window.alert(err);
        else onChanged();
      };
      const client = () => createBrowserSupabaseClient();
      if (current && current.scope === "group" && current.id !== defaultId)
        extra.push({ label: "Make default for the group", title: "The Group pages open on this set for everyone in the group, member schools included", disabled: !!busy, onClick: run("default", () => makeGroupDefault(client(), "group_peers", current.id, defaultId)) });
      if (defaultId && !picker.set && picker.key === picker.defaults[0]?.key)
        extra.push({ label: "Make the size band the default", title: "The Group pages open on the size band again", disabled: !!busy, onClick: run("band", () => clearGroupDefault(client(), "group_peers", defaultId)) });
    }
  }

  return (
    <SetSelector
      label="Compared against"
      kind="compared_against"
      current={{ name: picker.name, count: picker.set ? picker.set.groups.length : null, countText: picker.countText }}
      rows={rows}
      mine={sets.canKeep ? { active: sets.personalActive, cap: sets.cap } : null}
      selectedKey={picker.key}
      onPick={(r) => onPick(r.key)}
      onEdit={onEdit}
      onNew={onNew}
      extraActions={extra}
      manageHref={sets.canKeep ? `/sets?account=${encodeURIComponent(account)}` : null}
      manageUrn={null}
      blockLabels={{ school: "Group sets", schoolAll: "All group sets" }}
      hideMine={!sets.canKeep}
      phone={phone}
      loading={!!busy}
      defaultOpen={defaultOpen}
    />
  );
}
