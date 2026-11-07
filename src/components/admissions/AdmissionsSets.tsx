"use client";

// VicData 0.8 sets round 1 (B6-B11, G26): Admissions' top bar -- the page's one set (Feeder schools on
// Pipelines, Compared against on Market share) and the Pupils filter. The old "Day + boarding" and
// "Independent only" dropdowns are gone: a boarding choice and a sector are now inside the set (the
// Default block's "10 nearest | boarding", "Day | independent", a school's "Day + boarding feeders").
import { returnToHere } from "@/lib/sets/editor-return";
import { MenuChip } from "@/components/shell/FilterPills";
import { SetSelector, type SetMenuRow } from "@/components/sets/SetSelector";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { markUsed } from "@/lib/sets/store";
import type { AdmissionsMenu, SetChoice } from "@/lib/sets/admissions-page";
import type { SetKind } from "@/lib/sets/model";
import { useRoute, type Filters } from "./api";
import type { AdmissionsMember } from "./member";

export const PUPILS_OPTIONS = [
  { id: "all" as const, label: "Girls & Boys" },
  { id: "female" as const, label: "Girls", title: "Births have no girl/boy split: a girls' pool from births is an estimate (49%)." },
  { id: "male" as const, label: "Boys", title: "Births have no girl/boy split: a boys' pool from births is an estimate (51%)." },
];

export function PupilsChip({ filters, onFilters }: { filters: Filters; onFilters: (f: Filters) => void }) {
  return <MenuChip label="Pupils" value={filters.sex} onPick={(sex) => onFilters({ ...filters, sex })} options={PUPILS_OPTIONS} />;
}

const rowOf = (c: SetChoice): SetMenuRow => ({ key: c.key, name: c.name, count: c.count, creator: c.creator, main: c.main, pinned: c.pinned, lastUsedAt: c.lastUsedAt, title: c.how ?? c.name });

/** Remember a pick for "recently used" (set_user_state; the person's own row). Never in View as. */
async function remember(member: AdmissionsMember, key: string) {
  if (member.viewAs || !member.userId) return;
  const k = key.startsWith("set:") ? key.slice(4) : key;
  try {
    await markUsed(createBrowserSupabaseClient(), member.userId, k);
  } catch {
    // Best effort.
  }
}

/** The editor's address for this page (C17, D20): a stored set opens as itself (a copy if this person
 * can't change it); a default set, or a school's Day + boarding pair, as a copy of its schools; New
 * set… empty. Save comes back here with the set in use. */
export function editorHref(member: AdmissionsMember, entry: string, kind: SetKind, current: SetChoice | null, fresh: boolean): string {
  const q = new URLSearchParams({ urn: member.schoolUrn, kind, entry, product: "admissions", returnTo: returnToHere(member.schoolUrn, "/teacher/admissions") });
  if (!fresh && current) {
    if (current.key.startsWith("set:")) q.set("set", current.key.slice(4));
    else {
      q.set("from", current.key);
      q.set("name", current.name);
      if (current.urns?.length) q.set("urns", current.urns.join(","));
    }
  }
  return `/sets/edit?${q.toString()}`;
}

export function AdmissionsSetSelector({ member, entry, kind, choice, inUse, onPick, phone }: { member: AdmissionsMember; entry: string; kind: SetKind; choice: string | null; inUse: SetChoice | null; onPick: (key: string) => void; phone?: boolean }) {
  const menu = useRoute<AdmissionsMenu>(`/api/admissions/sets?urn=${member.schoolUrn}&entry=${encodeURIComponent(entry)}&kind=${kind}${choice ? `&key=${encodeURIComponent(choice)}` : ""}`);
  const m = menu.status === "ready" ? menu.data : null;
  // The set in use: the page's answer when it has come (what the views drew), else the menu's.
  const current: SetChoice | null = inUse ?? m?.current ?? null;
  return (
    <SetSelector
      label={kind === "feeders" ? "Feeder schools" : "Compared against"}
      kind={kind}
      current={current ? { name: current.name, count: current.count, main: current.main } : null}
      loading={!current}
      rows={{ default: (m?.default ?? []).map(rowOf), school: (m?.school ?? []).map(rowOf), mine: (m?.mine ?? []).map(rowOf) }}
      mine={m ? { active: m.mineActive, cap: m.cap } : null}
      selectedKey={current?.key ?? null}
      onPick={(r) => {
        void remember(member, r.key);
        onPick(r.key);
      }}
      // C17: Edit opens the editor -- the set itself where this person can change it, else a copy.
      onEdit={member.viewAs ? null : { label: "Edit this set…", onClick: () => (window.location.href = editorHref(member, entry, kind, current, false)) }}
      onNew={member.viewAs ? null : { label: "New set…", onClick: () => (window.location.href = editorHref(member, entry, kind, current, true)) }}
      manageHref={`/sets?kind=${kind}&entry=${encodeURIComponent(entry)}`}
      phone={phone}
    />
  );
}
