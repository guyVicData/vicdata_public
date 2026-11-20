"use client";

// Guy, 20 Nov ("learn from SMT"): the group home's comparison panel, built like SMT's (front-door/smt-sets-panel.tsx).
// One pane under the walks that (a) says what the set is for -- the walks set the group against other groups -- (b)
// lists the choices: VicData's defaults (Nearest in size, same type; the size band; …), the group's own sets (made by
// head office) and My sets, the one in use highlighted and ticked, (c) shows who is in it: the set's groups with their
// type and size (groups aren't points on a map), and (d) says how it was chosen, with Make your own set. Picking one
// changes the comparison for every walk and dashboard opened from the home (&compare=, which they all read).
import Link from "next/link";
import type { DashResponse } from "@/components/groups/dash/GroupDashboard";
import { groupEditorHref } from "@/components/groups/dash/GroupSetPicker";
import { Spinner } from "@/components/shell/LoadingGraphic";

const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

type Row = { key: string; name: string; count: string; title?: string };

export function GroupSetsPanel({ data, groupName, account, groupHome, onPick, readOnly }: { data: DashResponse | "loading" | "error"; groupName: string; account: string; groupHome: string; onPick: (key: string) => void; readOnly: boolean }) {
  const d = data === "loading" || data === "error" ? null : data;
  const o = d?.overview ?? null;
  const picker = o?.picker ?? null;
  const peers = (d?.sets?.sets ?? []).filter((s) => s.kind === "group_peers");
  const groupsWord = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "group" : "groups"}`;
  const blocks: { title: string; rows: Row[] }[] = picker
    ? ([
        { title: "VicData default", rows: picker.defaults.map((r) => ({ key: r.key, name: r.name, count: r.countText, title: r.title })) },
        { title: "Group sets", rows: peers.filter((s) => s.scope === "group").map((s) => ({ key: `set:${s.id}`, name: s.name, count: groupsWord(s.members.length) })) },
        { title: "My sets", rows: peers.filter((s) => s.scope === "personal").map((s) => ({ key: `set:${s.id}`, name: s.name, count: groupsWord(s.members.length) })) },
      ] as const).filter((b) => b.rows.length) as { title: string; rows: Row[] }[]
    : [];
  const selected = picker?.key ?? null;
  const set = picker?.set ?? null;
  const fromDefault = picker?.defaults.find((r) => r.key === selected) ?? null;
  const saved = set?.setId ? peers.find((s) => s.id === set.setId) ?? null : null;
  const how = fromDefault
    ? fromDefault.title
    : saved
      ? `Chosen by ${saved.scope === "group" ? "head office" : "you"} as "${saved.name}".`
      : set
        ? `A set of ${groupsWord(set.groups.length)} chosen by hand.`
        : null;
  const members = [...(set?.groups ?? [])].sort((a, b) => b.schools - a.schools || a.label.localeCompare(b.label));
  const canMake = !!d?.sets?.canKeep && !d?.sets?.notSetUp && !readOnly;
  return (
    <section data-group-sets="" aria-labelledby="group-sets-h" className="fd-tile flex flex-col gap-4 rounded-[14px] px-5 py-5 text-[var(--fg)]">
      <div className="flex flex-col gap-1">
        <h2 id="group-sets-h" className="text-[17px] font-semibold">Who do we compare the group with?</h2>
        <p className="max-w-[780px] text-[13.5px] leading-relaxed text-[var(--muted2)]">
          The walkthroughs above set {groupName} against a set of other groups: the Overview&rsquo;s measures, the Academic results and the Pupils roll are each compared with the set&rsquo;s middle. Pick a set here and every group walk and dashboard opened from this page uses it.
        </p>
      </div>
      {data === "error" ? (
        <p className="text-[13px] text-[var(--muted2)]">The comparison sets didn&rsquo;t load. The group dashboards list them.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(240px,340px)_1fr]">
          <div className="flex flex-col gap-3" role="radiogroup" aria-label="Comparison set">
            {!picker && (
              <p className="flex items-center gap-2 text-[13px] text-[var(--muted2)]">
                <Spinner size={14} /> Loading the sets…
              </p>
            )}
            {blocks.map((b) => (
              <div key={b.title} className="flex flex-col gap-1.5">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted2)]">{b.title}</p>
                <ul className="flex flex-col gap-1.5">
                  {b.rows.map((r) => {
                    const on = r.key === selected;
                    return (
                      <li key={r.key}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-group-set-row={r.key}
                          title={r.title}
                          onClick={() => onPick(r.key)}
                          className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-[14px] ${on ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.14)] font-semibold" : "border-[var(--panel-border2)] hover:border-[var(--accent)]"}`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-[var(--accent)] text-[#111]" : "border border-[var(--panel-border2)]"}`}>{on && <Tick />}</span>
                          <span className="min-w-0 flex-grow truncate">{r.name}</span>
                          <span className="shrink-0 text-[12px] font-normal tabular-nums text-[var(--muted2)]">{r.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {canMake && (
              <Link href={groupEditorHref({ account, kind: "group_peers", returnTo: groupHome })} data-group-set-make="" className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-[#111] hover:opacity-90">
                <span aria-hidden="true">+</span> Make your own set
              </Link>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3" data-group-set-show="">
            {!picker ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-[10px] border border-[var(--panel-border)] text-[13px] text-[var(--muted2)]">
                <span className="flex items-center gap-2">
                  <Spinner size={16} /> Loading the set&rsquo;s groups…
                </span>
              </div>
            ) : members.length ? (
              <div className="overflow-hidden rounded-[10px] border border-[var(--panel-border)]">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11.5px] text-[var(--muted2)]">
                      <th className="px-3 py-2 font-normal">Group</th>
                      <th className="px-3 py-2 font-normal">Type</th>
                      <th className="px-3 py-2 text-right font-normal">Schools</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((g) => (
                      <tr key={g.id} className="border-t border-[var(--panel-border)]">
                        <td className="max-w-[260px] truncate px-3 py-[6px]">{g.label}</td>
                        <td className="px-3 py-[6px] text-[var(--muted2)]">{g.type}</td>
                        <td className="px-3 py-[6px] text-right tabular-nums">{g.schools.toLocaleString("en-GB")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex min-h-[160px] flex-col justify-center gap-2 rounded-[10px] border border-[var(--panel-border)] px-5 py-6">
                <p className="text-[22px] font-semibold">{picker.countText || picker.name}</p>
                <p className="text-[14px] text-[var(--muted2)]">{picker.name}: the walks compare {groupName} with the middle of these groups.</p>
              </div>
            )}
            {picker && (
              <p data-group-set-story="" className="text-[13.5px] leading-relaxed">
                This set includes {members.length ? groupsWord(members.length) : picker.countText || "the groups shown"}{how ? `. ${how}` : "."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
