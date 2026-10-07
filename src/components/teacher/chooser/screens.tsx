"use client";

// Comparator chooser: the wireframe's screens (docs/wireframes/comparator-chooser-v29),
// each a pure view over state the orchestrator (ComparatorSetChooser.tsx) owns.
//   Main / MainSavedSets / MainSchoolSets / MainRankings -> HubScreen
//   AdjustNearest (2a) -> NearestScreen     AdjustLA (2b) -> LaScreen
//   AdjustCustom (2c)  -> CustomScreen      AdjustRanking* (3a/3b) -> RankingScreen
import { useState, type ReactNode } from "react";
import type { SchoolSearchResult } from "@/components/SchoolSearch";
import type { SavedComparatorSet, SavedRanking } from "@/lib/teacher-view-saved-sets";
import {
  BOARDING_BANDS,
  RANKING_GENDERS,
  RANKING_QUALIFICATIONS,
  RANKING_SECTORS,
  SIZE_BADGES,
  boardingPair,
  formatKm,
  genderPair,
  includesLines,
  sectorPair,
  type BoardingChoice,
  type ChooserSchool,
  type RankingFilters,
  type RankingScope,
} from "@/lib/comparator-chooser";
import type { SectorTag } from "@/lib/typology";
import {
  AddByName,
  Banner,
  Body,
  BuildRow,
  Check,
  Chip,
  ChevronDownIcon,
  DangerGhostButton,
  Divider,
  FilterBox,
  FilterLabel,
  Footer,
  FooterCount,
  GhostWideButton,
  GroupChip,
  Hint,
  HubHeader,
  HubRow,
  IconCircle,
  IncludesBox,
  Legend,
  PrimaryButton,
  RankRow,
  RowMenu,
  SaveBox,
  SecondaryButton,
  SectionLabel,
  SizeSquare,
  StatCard,
  StepHeader,
  Stepper,
  SubLabel,
  SubList,
  SubRow,
} from "./ui";

export type Theme = "dark" | "light";
const pairOf = (p: { light: [string, string]; dark: [string, string] }, theme: Theme) => (theme === "light" ? p.light : p.dark);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// ======================================================================== screen 1: hub

export type HubPick = "nearest" | "la" | "rankings" | "mine" | "school" | "vc";

export type HubProps = {
  targetName: string;
  closeRef: React.Ref<HTMLButtonElement>;
  onClose: () => void;
  pick: HubPick;
  onPick: (p: HubPick) => void;
  // 10 nearest
  nearest: { title: string; count: number | null; radiusKm: number | null };
  // Schools in {LA} (null = the school has no LA)
  la: { laName: string; count: number | null; spanKm: number | null; includesColleges: boolean } | null;
  // Rankings (null at KS2: no exam population to rank within)
  rankings: {
    sub: string | null; // "national" | "regional" | saved ranking id
    onSub: (id: string) => void;
    national: number | null;
    regional: { name: string; count: number | null } | null;
    saved: (SavedRanking & { count: number | null })[];
    onEdit: (r: SavedRanking) => void;
    onDelete: (r: SavedRanking) => void;
    onBuild: () => void;
  } | null;
  // Saved sets
  mine: SavedComparatorSet[];
  school: SavedComparatorSet[];
  schoolLabel: string; // "The Chase sets"
  setSub: string | null;
  onSetSub: (id: string) => void;
  onEditSet: (s: SavedComparatorSet) => void;
  onDeleteSet: (s: SavedComparatorSet) => void;
  // Victoria Consultancy Sets (null = not switched on for this school)
  vc: { sets: SavedComparatorSet[] } | null;
  // Footer
  count: string; // "10 schools selected", "4,857 schools & colleges"
  action: { label: "Next" | "Done"; disabled: boolean; onClick: () => void };
};

// A two-step Delete inside the ⋯ menu: the first tap asks, the second deletes.
function useConfirm() {
  const [armed, setArmed] = useState<string | null>(null);
  return { armed, arm: (id: string) => setArmed(id), clear: () => setArmed(null) };
}

export function HubScreen(p: HubProps) {
  const confirm = useConfirm();
  const inRankings = p.pick === "rankings";
  const setRows = (sets: SavedComparatorSet[], editable: boolean) =>
    sets.map((s) => (
      <SubRow
        key={s.id}
        active={p.setSub === s.id}
        label={s.name}
        count={plural(s.members.length, "school")}
        onClick={() => p.onSetSub(s.id)}
        menu={
          editable && s.editable ? (
            <RowMenu
              label={s.name}
              items={[
                { label: "Edit", onSelect: () => p.onEditSet(s) },
                confirm.armed === s.id
                  ? { label: "Tap again to delete", danger: true, onSelect: () => { confirm.clear(); p.onDeleteSet(s); } }
                  : { label: "Delete", danger: true, onSelect: () => confirm.arm(s.id) },
              ]}
            />
          ) : undefined
        }
      />
    ));

  return (
    <>
      <HubHeader subtitle={`${p.count} · ${p.targetName}`} onClose={p.onClose} closeRef={p.closeRef} />
      <Body>
        <SectionLabel>Start from — pick one</SectionLabel>

        <HubRow
          active={p.pick === "nearest"}
          title={p.nearest.title}
          subtitle="Same sector, phase & qualification · boarding matched where relevant"
          badge={inRankings ? null : p.nearest.count === null ? "…" : plural(p.nearest.count, "school")}
          badgeNote={inRankings ? undefined : p.nearest.radiusKm !== null ? `Radius: up to ${formatKm(p.nearest.radiusKm)}` : null}
          onClick={() => p.onPick("nearest")}
        />

        {p.la && (
          <HubRow
            active={p.pick === "la"}
            title={`Schools in ${p.la.laName}`}
            subtitle="Same LA & phase, all qualifications & mainstream sectors"
            note={!inRankings && p.la.includesColleges ? "Includes FE & sixth-form colleges" : null}
            badge={inRankings ? null : p.la.count === null ? "…" : plural(p.la.count, "school")}
            badgeNote={inRankings ? undefined : p.la.spanKm !== null ? `Spans up to ${formatKm(p.la.spanKm)}` : null}
            onClick={() => p.onPick("la")}
          />
        )}

        {p.rankings && (
        <HubRow
          active={inRankings}
          title="Regional & national rankings"
          subtitle={inRankings ? "Compare against a whole population, not hand-picked schools" : "Browse ranking sets, then filter down"}
          onClick={() => p.onPick("rankings")}
        />
        )}
        {inRankings && p.rankings && (() => { const rk = p.rankings; return (
          <SubList>
            <SubLabel>Default — no sector filters</SubLabel>
            <SubRow
              active={rk.sub === "national"}
              label="National — all England schools & colleges"
              count={rk.national === null ? "…" : rk.national.toLocaleString()}
              onClick={() => rk.onSub("national")}
            />
            {rk.regional && (
              <SubRow
                active={rk.sub === "regional"}
                label={`Regional — all ${rk.regional.name} schools & colleges`}
                count={rk.regional.count === null ? "…" : rk.regional.count.toLocaleString()}
                onClick={() => rk.onSub("regional")}
              />
            )}
            {rk.saved.length > 0 && <SubLabel>Your saved rankings</SubLabel>}
            {rk.saved.map((r) => (
              <SubRow
                key={r.id}
                active={rk.sub === r.id}
                label={r.name}
                count={r.count === null ? "" : r.count.toLocaleString()}
                onClick={() => rk.onSub(r.id)}
                menu={
                  r.editable ? (
                    <RowMenu
                      label={r.name}
                      items={[
                        { label: "Edit", onSelect: () => rk.onEdit(r) },
                        confirm.armed === r.id
                          ? { label: "Tap again to delete", danger: true, onSelect: () => { confirm.clear(); rk.onDelete(r); } }
                          : { label: "Delete", danger: true, onSelect: () => confirm.arm(r.id) },
                      ]}
                    />
                  ) : undefined
                }
              />
            ))}
            <BuildRow onClick={rk.onBuild} />
          </SubList>
        ); })()}

        <HubRow
          active={p.pick === "mine"}
          title="My saved sets"
          subtitle="Use or edit a set"
          badge={`${p.mine.length} saved`}
          onClick={() => p.onPick("mine")}
        />
        {p.pick === "mine" && (
          <SubList>
            {p.mine.length ? setRows(p.mine, true) : <div style={{ fontSize: 12, color: "var(--cc-faint)", padding: "7px 4px" }}>None saved yet — adjust a starting point and save it.</div>}
          </SubList>
        )}

        {p.school.length > 0 && (
          <HubRow
            active={p.pick === "school"}
            title={p.schoolLabel}
            subtitle="Shared school-wide · switch one on, can't be edited"
            badge={plural(p.school.length, "set")}
            onClick={() => p.onPick("school")}
          />
        )}
        {p.pick === "school" && <SubList>{setRows(p.school, true)}</SubList>}

        {p.vc && (
          <HubRow
            active={p.pick === "vc"}
            title="Victoria Consultancy Sets"
            subtitle="Shared with leadership, can't be edited"
            badge={plural(p.vc.sets.length, "set")}
            onClick={() => p.onPick("vc")}
          />
        )}
        {p.pick === "vc" && p.vc && <SubList>{setRows(p.vc.sets, false)}</SubList>}
      </Body>
      <Footer>
        <FooterCount>{p.count}</FooterCount>
        <PrimaryButton onClick={p.action.onClick} disabled={p.action.disabled}>{p.action.label}</PrimaryButton>
      </Footer>
    </>
  );
}

// ====================================================================== 2a: 10 nearest

export function NearestScreen({
  targetName,
  schools,
  count,
  title: titleIn,
  loading,
  onLess,
  onMore,
  onAdd,
  onBack,
  onClose,
  onDone,
}: {
  targetName: string;
  schools: ChooserSchool[];
  count: number;
  // 0.6.5 S4: the page's own name for the set ("10 nearest with a sixth form or 16+ provision"
  // at Post-16); absent = "N nearest schools", as before.
  title?: string;
  loading: boolean;
  onLess: () => void;
  onMore: () => void;
  onAdd: (s: SchoolSearchResult) => void;
  onBack: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const title = titleIn ?? `${count} nearest schools`;
  return (
    <>
      <StepHeader title={title} subtitle="Ordered by distance · same sector, phase & qualification" onBack={onBack} onClose={onClose} />
      <Body gap={4}>
        <div style={{ fontSize: 10.5, color: "var(--cc-faint)", padding: "0 2px 2px" }}>
          Sector-matched to {targetName} — state also draws on post-16/FE colleges; independent &amp; special stay within their own sector. Switch to county view for other sectors.
        </div>
        <Legend schools={schools} />
        {schools.map((s, i) => (
          <RankRow
            key={s.urn}
            rank={String(i + 1)}
            school={s}
            extra={s.boarders ? <span style={{ fontSize: 10, color: "var(--cc-faint)" }}> · has boarders</span> : null}
          />
        ))}
        {loading && schools.length === 0 && <div style={{ fontSize: 12, color: "var(--cc-faint)", padding: "7px 2px" }}>Finding the nearest schools…</div>}
        <Divider />
        <Stepper label={title} onLess={onLess} onMore={onMore} lessDisabled={count <= 5} busy={loading} />
        <div style={{ marginTop: 10 }}>
          <AddByName placeholder="Add a specific school by name" onPick={onAdd} exclude={new Set(schools.map((s) => s.urn))} />
          <Hint>Adding a school by name turns this into a custom set</Hint>
        </div>
      </Body>
      <Footer>
        <FooterCount>{plural(schools.length, "school")} selected</FooterCount>
        <PrimaryButton onClick={onDone} disabled={schools.length === 0}>Done</PrimaryButton>
      </Footer>
    </>
  );
}

// ==================================================================== 2b: schools in LA

export type GroupBy = "none" | "sector" | "la";
const SECTOR_GROUP: Record<SectorTag, string> = { State: "State schools", Independent: "Independent schools", FE: "FE & sixth-form colleges", "Special Schools": "Special schools" };
const SECTOR_ORDER: SectorTag[] = ["State", "Independent", "FE", "Special Schools"];

export function LaScreen({
  laLabel,
  schools,
  extra,
  ticked,
  onToggle,
  onToggleMany,
  groupBy,
  onGroupBy,
  adjacent,
  onAddLa,
  laBusy,
  onAdd,
  onBack,
  onClose,
  onDone,
}: {
  laLabel: string;
  schools: ChooserSchool[];
  // default-comparator-lists' local16Plus beyond list2: deliberately additive upstream, so
  // kept as its own group here in every grouping rather than folded into list2's.
  extra: { label: string; urns: Set<string> } | null;
  ticked: Set<string>;
  onToggle: (urn: string) => void;
  onToggleMany: (urns: string[], on: boolean) => void;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  adjacent: { names: string[]; open: boolean; onOpen: () => void; loaded: boolean };
  onAddLa: (name: string) => void;
  laBusy: boolean;
  onAdd: (s: SchoolSearchResult) => void;
  onBack: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const sorted = [...schools].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  const byDistance = extra ? sorted.filter((x) => !extra.urns.has(x.urn)) : sorted;
  const extraGroup = extra ? [{ key: "local16plus", label: extra.label, items: sorted.filter((x) => extra.urns.has(x.urn)) }].filter((g) => g.items.length) : [];
  const baseGroups: { key: string; label: string; items: ChooserSchool[] }[] =
    groupBy === "none"
      ? [{ key: "all", label: "All schools", items: byDistance }]
      : groupBy === "sector"
        ? SECTOR_ORDER.map((s): { key: string; label: string; items: ChooserSchool[] } => ({ key: s, label: SECTOR_GROUP[s], items: byDistance.filter((x) => x.sector === s) }))
            .concat([{ key: "other", label: "Other", items: byDistance.filter((x) => x.sector === null) }])
            .filter((g) => g.items.length)
        : Array.from(new Set(byDistance.map((x) => x.laName ?? "Other"))).map((la) => ({ key: la, label: la, items: byDistance.filter((x) => (x.laName ?? "Other") === la) }));
  const groups = [...baseGroups, ...extraGroup];
  const n = schools.length;
  const t = schools.filter((s) => ticked.has(s.urn)).length;
  return (
    <>
      <StepHeader title={`Schools in ${laLabel}`} subtitle={`Mainstream ${laLabel} schools & colleges, same phase · ${t}/${n} ticked`} onBack={onBack} onClose={onClose} />
      <Body>
        <Legend schools={schools} showDay={false} />
        <div>
          <FilterLabel>Group by</FilterLabel>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            <GroupChip active={groupBy === "none"} onClick={() => onGroupBy("none")}>None</GroupChip>
            <GroupChip active={groupBy === "sector"} onClick={() => onGroupBy("sector")}>Sector</GroupChip>
            <GroupChip active={groupBy === "la"} onClick={() => onGroupBy("la")}>Local authority</GroupChip>
          </div>
        </div>
        {groups.map((g) => {
          const on = g.items.filter((x) => ticked.has(x.urn)).length;
          const all = on === g.items.length;
          const open = !collapsed[g.key];
          return (
            <div key={g.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", position: "sticky", top: 0, background: "var(--cc-panel)", zIndex: 1 }}>
                <button type="button" aria-label={`${all ? "Untick" : "Tick"} every school in ${g.label}`} onClick={() => onToggleMany(g.items.map((x) => x.urn), !all)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                  <Check on={all} partial={!all && on > 0} />
                </button>
                <button type="button" aria-expanded={open} onClick={() => setCollapsed({ ...collapsed, [g.key]: open })} style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 auto", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cc-ink)", flex: "1 1 auto" }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: "var(--cc-faint)" }}>{on} / {g.items.length} ticked</div>
                  <div style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }}><ChevronDownIcon size={14} stroke="var(--cc-faint)" /></div>
                </button>
              </div>
              {open &&
                g.items.map((s) => {
                  const isOn = ticked.has(s.urn);
                  return (
                    <div
                      key={s.urn}
                      role="checkbox"
                      aria-checked={isOn}
                      tabIndex={0}
                      onClick={() => onToggle(s.urn)}
                      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(s.urn); } }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 2px 7px 26px", cursor: "pointer" }}
                    >
                      <Check on={isOn} />
                      <IconCircle sector={s.sector} boarders={s.boarders} compact />
                      <div style={{ fontSize: 13, color: isOn ? "var(--cc-ink)" : "var(--cc-faint)", flex: "1 1 auto", textDecoration: isOn ? "none" : "line-through", minWidth: 0 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--cc-faint)" }}>{formatKm(s.distanceKm)}</div>
                    </div>
                  );
                })}
            </div>
          );
        })}
        <Divider margin="6px 0 0" />
        <GhostWideButton onClick={adjacent.onOpen}>Add another local authority</GhostWideButton>
        {adjacent.open && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {!adjacent.loaded ? (
              <div style={{ fontSize: 12, color: "var(--cc-faint)" }}>Finding neighbouring local authorities…</div>
            ) : adjacent.names.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--cc-faint)" }}>No neighbouring local authorities with schools of this phase.</div>
            ) : (
              adjacent.names.map((name) => (
                <Chip key={name} active={false} onClick={() => onAddLa(name)} size="md">{laBusy ? "…" : `+ ${name}`}</Chip>
              ))
            )}
          </div>
        )}
        <div>
          <AddByName placeholder="Add a specific school by name" onPick={onAdd} exclude={new Set(schools.map((s) => s.urn))} />
          <Hint>Adding a school by name turns this into a custom set</Hint>
        </div>
      </Body>
      <Footer>
        <FooterCount>{plural(t, "school")} selected</FooterCount>
        <PrimaryButton onClick={onDone} disabled={t === 0}>Done</PrimaryButton>
      </Footer>
    </>
  );
}

// ======================================================================= 2c: custom set

export function CustomScreen({
  theme,
  title,
  subtitle,
  forked,
  core,
  added,
  onRemoveCore,
  onRemoveAdded,
  stepper,
  onAdd,
  name,
  onName,
  canShare,
  shared,
  onShared,
  saveNote,
  canDelete,
  onDelete,
  onSaveAs,
  onSave,
  saveDisabled,
  saveAsDisabled,
  busy,
  error,
  onBack,
  onClose,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
  forked: boolean;
  core: ChooserSchool[];
  added: ChooserSchool[];
  onRemoveCore: ((urn: string) => void) | null;
  onRemoveAdded: (urn: string) => void;
  stepper: { label: string; onLess: () => void; onMore: () => void; lessDisabled: boolean; busy: boolean } | null;
  onAdd: (s: SchoolSearchResult) => void;
  name: string;
  onName: (v: string) => void;
  canShare: boolean;
  shared: boolean;
  onShared: (v: boolean) => void;
  saveNote: string | null;
  canDelete: boolean;
  onDelete: () => void;
  onSaveAs: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  saveAsDisabled: boolean;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const all = [...core, ...added];
  const [armed, setArmed] = useState(false);
  return (
    <>
      <StepHeader title={title} subtitle={subtitle} onBack={onBack} onClose={onClose} />
      <Body>
        {forked && <Banner>You added a school by name, so this is now a custom set — save it below to reuse it.</Banner>}
        <Legend schools={all} showDay={false} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {core.map((s, i) => (
            <RankRow key={s.urn} rank={String(i + 1)} school={s} onRemove={onRemoveCore ? () => onRemoveCore(s.urn) : undefined} />
          ))}
          {added.map((s, i) => {
            const pair = s.sector ? pairOf(sectorPair(s.sector), theme) : null;
            return (
              <RankRow
                key={s.urn}
                rank="—"
                school={s}
                topRule={i === 0 && core.length > 0}
                onRemove={() => onRemoveAdded(s.urn)}
                extra={
                  <span style={{ fontSize: 10, fontWeight: 700, color: pair?.[1] ?? "var(--cc-label)", background: pair?.[0] ?? "var(--cc-chipbg)", borderRadius: 10, padding: "1px 6px", marginLeft: 4 }}>
                    Added by name{s.sector ? ` · ${s.sector === "Special Schools" ? "Special" : s.sector}` : ""}
                  </span>
                }
              />
            );
          })}
        </div>
        <Divider margin="2px 0" />
        {stepper && <Stepper {...stepper} />}
        <AddByName placeholder="Add another school by name" onPick={onAdd} exclude={new Set(all.map((s) => s.urn))} />
        <SaveBox title="Name this set" name={name} onName={onName} placeholder="e.g. GCSE core comparators" canShare={canShare} shared={shared} onShared={onShared} note={saveNote} />
        {error && <div role="alert" style={{ fontSize: 12, color: "var(--cc-danger)" }}>{error}</div>}
      </Body>
      <Footer>
        {canDelete ? (
          <DangerGhostButton onClick={() => (armed ? onDelete() : setArmed(true))} disabled={busy}>{armed ? "Confirm delete" : "Delete"}</DangerGhostButton>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <SecondaryButton onClick={onSaveAs} disabled={saveAsDisabled || busy}>Save as</SecondaryButton>
          <PrimaryButton onClick={onSave} disabled={saveDisabled || busy}>Save</PrimaryButton>
        </div>
      </Footer>
    </>
  );
}

// ================================================================= 3a/3b: build a ranking

export function RankingScreen({
  theme,
  phase,
  title,
  subtitle,
  filters,
  onFilters,
  ownRegion,
  otherRegions,
  count,
  custom,
  footer,
  save,
  onBack,
  onClose,
}: {
  theme: Theme;
  phase: "ks4" | "ks5";
  title: string;
  subtitle: string;
  filters: RankingFilters;
  onFilters: (f: RankingFilters) => void;
  ownRegion: RankingScope | null;
  otherRegions: { code: string; name: string }[];
  count: { matched: number | null; total: number | null };
  custom: boolean;
  footer: ReactNode;
  save: ReactNode | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const set = (patch: Partial<RankingFilters>) => onFilters({ ...filters, ...patch });
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const num = (n: number | null) => (n === null ? "…" : n.toLocaleString());
  const boardingChip = (id: Exclude<BoardingChoice, "any">, label: string, subtle: boolean) => {
    const pr = pairOf(boardingPair(id), theme);
    return (
      <Chip key={id} active={filters.boarding === id} onClick={() => set({ boarding: filters.boarding === id ? "any" : id })} pair={pr} dot={pairOf(boardingPair(id), "light")[1]} subtle={subtle}>
        {label}
      </Chip>
    );
  };
  const scopeIsOther = filters.scope.kind === "region" && !(ownRegion && ownRegion.kind === "region" && ownRegion.code === filters.scope.code);
  const bandLabel = phase === "ks5" ? "Sixth Form (Years 12–13)" : "Secondary (Years 7–11)";

  return (
    <>
      <StepHeader title={title} subtitle={subtitle} onBack={onBack} onClose={onClose} />
      <Body gap={12}>
        {!custom && (
          <div style={{ fontSize: 10.5, color: "var(--cc-faint)", padding: "0 2px" }}>This is a population, not a hand-picked list — it shows what&apos;s included, not individual schools.</div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {custom ? <StatCard num={num(count.matched)} label={`of ${num(count.total)} match`} /> : <StatCard num={num(count.total)} label="schools & colleges" />}
          {custom ? (
            <Banner>You&apos;ve narrowed this ranking, so it&apos;s now a custom ranking set — save it below to reuse it.</Banner>
          ) : (
            <IncludesBox lines={includesLines(filters)} />
          )}
        </div>
        {!custom && (
          <>
            <div style={{ height: 1, background: "var(--cc-line)" }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cc-ink)" }}>Narrow this into your own ranking</div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <FilterBox>
              <FilterLabel>Sector</FilterLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <Chip active={filters.sectors.length === 0} onClick={() => set({ sectors: [] })}>All</Chip>
                {RANKING_SECTORS.slice(0, 2).map((s) => (
                  <Chip key={s.tag} active={filters.sectors.includes(s.tag)} onClick={() => set({ sectors: toggleIn(filters.sectors, s.tag) })} pair={pairOf(sectorPair(s.tag), theme)} dot={sectorPair(s.tag).light[1]}>
                    {s.label}
                  </Chip>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {RANKING_SECTORS.slice(2).map((s) => (
                  <Chip key={s.tag} active={filters.sectors.includes(s.tag)} onClick={() => set({ sectors: toggleIn(filters.sectors, s.tag) })} pair={pairOf(sectorPair(s.tag), theme)} dot={sectorPair(s.tag).light[1]}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </FilterBox>
            <FilterBox>
              <FilterLabel>Gender</FilterLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip active={filters.gender === null} onClick={() => set({ gender: null })}>Any</Chip>
                {RANKING_GENDERS.map((g) => (
                  <Chip key={g} active={filters.gender === g} onClick={() => set({ gender: filters.gender === g ? null : g })} pair={pairOf(genderPair(g), theme)} dot={genderPair(g).light[1]}>
                    {g}
                  </Chip>
                ))}
              </div>
            </FilterBox>
          </div>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <FilterBox>
              <FilterLabel>Boarding</FilterLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <Chip active={filters.boarding === "any"} onClick={() => set({ boarding: "any" })}>Any</Chip>
                {boardingChip("day", "100% Day", false)}
              </div>
              <FilterLabel>Boarding %</FilterLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {BOARDING_BANDS.slice(0, 2).map((b) => boardingChip(b.id, b.label, true))}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {BOARDING_BANDS.slice(2).map((b) => boardingChip(b.id, b.label, true))}
              </div>
            </FilterBox>
          </div>
        </div>

        {phase === "ks5" && (
          <FilterBox>
            <FilterLabel>Qualification</FilterLabel>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <Chip active={filters.qualification === null} onClick={() => set({ qualification: null })}>All</Chip>
              {RANKING_QUALIFICATIONS.map((q) => (
                <Chip key={q.bucket} active={filters.qualification === q.bucket} onClick={() => set({ qualification: filters.qualification === q.bucket ? null : q.bucket })} ariaLabel={q.name}>
                  {q.chip}
                </Chip>
              ))}
            </div>
            {filters.qualification && (
              <Hint>Saved with the ranking, but the count doesn&apos;t narrow by qualification yet.</Hint>
            )}
          </FilterBox>
        )}

        <FilterBox>
          <FilterLabel>Scope</FilterLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", position: "relative" }}>
            <Chip active={filters.scope.kind === "nation"} onClick={() => set({ scope: { kind: "nation", nation: "england" } })}>All England</Chip>
            {ownRegion && ownRegion.kind === "region" && (
              <Chip active={filters.scope.kind === "region" && filters.scope.code === ownRegion.code} onClick={() => set({ scope: ownRegion })}>{ownRegion.name}</Chip>
            )}
            {scopeIsOther && filters.scope.kind === "region" && <Chip active onClick={() => setMoreOpen(true)}>{filters.scope.name}</Chip>}
            <Chip active={false} onClick={() => setMoreOpen(!moreOpen)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                More
                <ChevronDownIcon size={10} stroke="var(--cc-label)" width={2.5} />
              </span>
            </Chip>
            {moreOpen && (
              <div role="menu" style={{ position: "absolute", left: 0, top: "calc(100% + 4px)", zIndex: 5, background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, boxShadow: "0 8px 20px rgba(20,20,19,0.14)", padding: 4, maxHeight: 220, overflowY: "auto" }}>
                {otherRegions.map((r) => (
                  <button key={r.code} type="button" role="menuitem" onClick={() => { set({ scope: { kind: "region", code: r.code, name: r.name } }); setMoreOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 10px", fontSize: 12.5, borderRadius: 6, cursor: "pointer", color: "var(--cc-ink)", whiteSpace: "nowrap" }}>
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FilterBox>

        <FilterBox>
          <FilterLabel>
            Size <span style={{ textTransform: "none", fontWeight: 500, color: "var(--cc-faint)" }}>— {bandLabel}</span>
          </FilterLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Chip active={filters.sizes.length === 0} onClick={() => set({ sizes: [] })}>Any</Chip>
            <div style={{ display: "flex", gap: 4 }}>
              {SIZE_BADGES.map((b) => (
                <SizeSquare key={b} label={b} active={filters.sizes.includes(b)} onClick={() => set({ sizes: toggleIn(filters.sizes, b) })} />
              ))}
            </div>
          </div>
        </FilterBox>

        {save}
        {!custom && <Hint>Changing any filter above turns this into a custom ranking, which you can save to reuse</Hint>}
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

export { plural };
