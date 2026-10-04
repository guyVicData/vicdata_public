"use client";

// Customise (Ch3Adjust.dc.html; scope brief §3): one screen, borrowing the comparator
// chooser's "adjust ranking" screen -- a live preview, three filter boxes (Numbers, Years,
// Look) and the title with placeholder chips, plus roll forward. Touching anything forks
// the ready-made view into a custom one (the same banner as a ranking forking into a
// custom ranking); "Back to ready-made" undoes it.
//
// 0.6 snag 4 / 01 (the Customise audit): a choice the page can't honour yet is shown dotted
// and tagged "Coming soon", never saved and ignored. Years' "from" year isn't drawn anywhere
// yet (the hosts' own From menus start each trend), and Roll forward is honoured in a
// meeting slot (its pin) but not on a dashboard, which always shows the newest data.
//
// Every option is a structural filter over the registry: a Numbers type is offered only
// when the measure declares it honest AND a matching view has it; a Look or Years choice
// only when a matching view exists. The rest stay dotted. Picking moves to the matching
// view closest to the other two choices.
import { useState } from "react";
import type { CustomViewParams, PickPanelContext } from "@/catalogue/pick";
import {
  LOOK_ORDER,
  NUMBER_TYPE_LABEL,
  TITLE_PLACEHOLDERS,
  VIEW_TYPE_LABEL,
  defaultFromYear,
  honestTypesOf,
  latestYear,
  measureFor,
  numbersOptions,
  resolveTitle,
  titleTemplateOf,
  yearsOf,
} from "@/catalogue/pick";
import type { Dataview, DateMode, NumberType, TileFigureSpec, ViewType } from "@/catalogue/types";
import { readTileParams, tileViewDef, writeTileParams } from "@/lib/tile-figures";
import { FiguresBox } from "./FiguresBox";
import { Banner, Body, FilterBox, FilterLabel, Footer, PrimaryButton, SecondaryButton } from "@/components/teacher/chooser/ui";
import { MenuRow, PanelMenu, useDismiss } from "@/components/teacher/PanelMenu";
import { AvHeader, BoardChip, Toggle } from "./bits";
import { PickPreview } from "./PickPreview";
import { accentFor } from "./PickScreen";
import { L } from "./layout";
import { useChooserWords } from "./words";

// `tiles` / `mainLabel` (snag 3 / 01): a number-tiles view's Figures; null = as the host
// builds them.
type State = { dv: Dataview; numberType: NumberType; dateMode: DateMode; look: ViewType; fromYear: string | null; rollForward: boolean; title: string; titleEdited: boolean; tiles: TileFigureSpec[] | null; mainLabel: string | null };

const templateOf = titleTemplateOf;

// The audit's tag for a choice that isn't wired yet.
function ComingSoon() {
  return (
    <span data-coming-soon="" style={{ borderRadius: 999, border: "1px dashed var(--cc-border2)", color: "var(--cc-faint)", fontSize: 10.5, fontWeight: 600, padding: "1px 7px", whiteSpace: "nowrap" }}>
      Coming soon
    </span>
  );
}

function initial(base: Dataview, ctx: PickPanelContext): State {
  return {
    dv: base,
    numberType: honestTypesOf(base, ctx)[0] ?? base.supports.numberType[0],
    dateMode: base.supports.dateMode,
    look: base.supports.viewType,
    fromYear: defaultFromYear(ctx),
    rollForward: true,
    title: templateOf(base),
    titleEdited: false,
    tiles: null,
    mainLabel: null,
  };
}

// Snag 1 / 03: "Edit this view…" re-opens a custom view with the choices it was saved with.
function fromParams(base: Dataview, ctx: PickPanelContext, p: CustomViewParams): State {
  const t = readTileParams(p);
  return { ...initial(base, ctx), numberType: p.numberType, dateMode: p.fromYear ? "trend" : base.supports.dateMode, look: p.look, fromYear: p.fromYear ?? defaultFromYear(ctx), rollForward: p.rollForward, title: p.title, titleEdited: p.title !== templateOf(base), tiles: t.tiles ?? null, mainLabel: t.mainLabel ?? null };
}

// The matching view closest to the wanted choices, with `strict` held exactly.
function nearest(candidates: Dataview[], want: { numberType: NumberType; dateMode: DateMode; look: ViewType }, strict: "numberType" | "dateMode" | "look", prefer: Dataview): Dataview | null {
  const ok = candidates.filter((dv) =>
    strict === "numberType" ? dv.supports.numberType.includes(want.numberType) : strict === "dateMode" ? dv.supports.dateMode === want.dateMode : dv.supports.viewType === want.look,
  );
  let best: Dataview | null = null;
  let bestScore = -1;
  for (const dv of ok) {
    const score = (dv.supports.viewType === want.look ? 4 : 0) + (dv.supports.dateMode === want.dateMode ? 2 : 0) + (dv.supports.numberType.includes(want.numberType) ? 1 : 0) + (dv.id === prefer.id ? 0.5 : 0);
    if (score > bestScore) {
      best = dv;
      bestScore = score;
    }
  }
  return best;
}

function TitleTokens({ template }: { template: string }) {
  const parts = template.split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") ? (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", borderRadius: 6, background: "var(--cc-blue-badge)", color: "var(--cc-blue)", fontSize: 12, fontWeight: 700, padding: "1px 6px" }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function CustomiseScreen({
  ctx,
  base,
  initialParams = null,
  candidates: offered,
  where = "dashboard",
  onBack,
  onClose,
  onAdd,
}: {
  ctx: PickPanelContext;
  base: Dataview;
  initialParams?: CustomViewParams | null;
  candidates: Dataview[];
  // Where the view goes: Roll forward is honoured in a meeting slot only (0.6 snag 4 / 01).
  where?: "dashboard" | "meeting";
  onBack: () => void;
  onClose: () => void;
  onAdd: (dv: Dataview, params: CustomViewParams | null) => void;
}) {
  const words = useChooserWords();
  // 0.6 snag 4 / 01: on a dashboard a panel's host draws its own views in its own panel
  // (Current or Trends), so Numbers, Years and Look move only among those -- a choice that
  // lands on a view the page can't draw there would be saved and ignored. A meeting slot
  // draws any view by itself.
  const candidates = where === "meeting" ? offered : offered.filter((dv) => dv.id === base.id || (dv.host.id === base.host.id && dv.host.panel === base.host.panel));
  const otherMode = (m: DateMode) => where === "dashboard" && !candidates.some((dv) => dv.supports.dateMode === m) && offered.some((dv) => dv.supports.dateMode === m);
  const [s, setS] = useState<State>(() => (initialParams ? fromParams(base, ctx, initialParams) : initial(base, ctx)));
  const [forked, setForked] = useState(!!initialParams);
  const [editingTitle, setEditingTitle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));

  const fork = (next: State) => {
    setS(next);
    setForked(true);
  };
  // Move along one dimension, landing on the nearest matching view for the others.
  const move = (strict: "numberType" | "dateMode" | "look", want: { numberType: NumberType; dateMode: DateMode; look: ViewType }) => {
    const dv = nearest(candidates, want, strict, s.dv);
    if (!dv) return;
    const honest = honestTypesOf(dv, ctx);
    const numberType = dv.supports.numberType.includes(want.numberType) ? want.numberType : (honest[0] ?? dv.supports.numberType[0]);
    fork({ ...s, dv, numberType, dateMode: dv.supports.dateMode, look: dv.supports.viewType, title: s.titleEdited ? s.title : templateOf(dv) });
  };
  const want = { numberType: s.numberType, dateMode: s.dateMode, look: s.look };

  const numbers = numbersOptions(ctx, candidates);
  const hasDate = (m: DateMode) => candidates.some((dv) => dv.supports.dateMode === m);
  const hasLook = (v: ViewType) => candidates.some((dv) => dv.supports.viewType === v);
  const years = yearsOf(measureFor(ctx));
  const fromChoices = years.slice(0, -1);
  const latest = latestYear(ctx);
  const trend = s.dateMode === "trend";
  const dottedNote =
    numbers.some((n) => !n.enabled) && ctx.data === "academic.results"
      ? `Dotted: count-only options, not offered for ${ctx.results === "threshold" || ctx.results === "bands" ? "a rate" : "an average"}.`
      : numbers.some((n) => !n.enabled)
        ? "Dotted: not honest for this measure, or no view offers it yet."
        : null;

  const subtitle = [NUMBER_TYPE_LABEL[s.numberType], trend ? `${s.fromYear ?? "first year"} → latest` : (latest ?? "latest"), VIEW_TYPE_LABEL[s.look]].join(" · ");
  const params: CustomViewParams = {
    numberType: s.numberType,
    fromYear: trend ? s.fromYear : null,
    look: s.look,
    title: s.title,
    // A dashboard always rolls forward (its toggle is "Coming soon").
    rollForward: where === "meeting" ? s.rollForward : true,
    // Only on a tiles view, and only what differs from the host's own tiles.
    ...(tileViewDef(s.dv.id) ? writeTileParams(s.dv.id, s.tiles, s.mainLabel) : {}),
  };

  return (
    <>
      <AvHeader title="Customise view" subtitle={subtitle} segs={null} onBack={onBack} onClose={onClose} />
      <Body gap={10}>
        <div style={{ background: "var(--av-thumb-bg)", border: "1px solid var(--av-thumb-border)", borderRadius: 10, padding: "8px 10px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--cc-faint)" }}>Live preview &middot; {ctx.labels.school ?? "this school"}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <PickPreview dataview={s.dv} look={s.look} numberType={s.numberType} accent={accentFor(ctx)} height={L.livePreviewHeight} />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cc-ink)", lineHeight: 1.35 }}>{resolveTitle(s.title, s.dv, ctx, { fromYear: s.fromYear })}</div>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <Banner>
            {forked ? "This is now your own custom view. The ready-made one stays as it was." : "Change anything below and this becomes your own custom view. The ready-made one stays as it was."}
          </Banner>
        </div>

        <FilterBox>
          <FilterLabel>Numbers</FilterLabel>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
            {numbers.map((n) => (
              <BoardChip key={n.type} size="xs" active={n.enabled && s.numberType === n.type} off={!n.enabled} onClick={() => move("numberType", { ...want, numberType: n.type })}>
                {NUMBER_TYPE_LABEL[n.type]}
              </BoardChip>
            ))}
          </div>
          {dottedNote && <div style={{ fontSize: 11, color: "var(--cc-faint)", marginTop: 7 }}>{dottedNote}</div>}
        </FilterBox>

        <FilterBox>
          <FilterLabel>Years</FilterLabel>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginTop: 5 }}>
            <BoardChip size="xs" active={!trend} off={!hasDate("single")} title={otherMode("single") ? "Coming soon" : undefined} onClick={() => move("dateMode", { ...want, dateMode: "single" })}>
              Single year
            </BoardChip>
            <BoardChip size="xs" active={trend} off={!hasDate("trend")} title={otherMode("trend") ? "Coming soon" : undefined} onClick={() => move("dateMode", { ...want, dateMode: "trend" })}>
              Trend
            </BoardChip>
            <span style={{ width: 1, height: 18, background: "var(--cc-border2)" }} />
            {trend ? (
              <>
                {/* 0.6 snag 4 / 01: not drawn yet -- each trend starts where its panel's own
                    From menu says -- so dotted, never saved as a choice. */}
                <span style={{ fontSize: 11.5, color: "var(--cc-faint)" }}>from</span>
                {fromChoices.map((y) => (
                  <BoardChip key={y} size="xs" off title="Coming soon">
                    {y}
                  </BoardChip>
                ))}
                <span style={{ fontSize: 11.5, color: "var(--cc-faint)" }}>&rarr; latest</span>
              </>
            ) : (
              <span style={{ fontSize: 11.5, color: "var(--cc-label)" }}>latest{latest ? ` (${latest})` : ""}</span>
            )}
            {/* One tag for the row: a trend's "from" year, or (on a dashboard) a view of the
                other kind in this panel, isn't drawn yet. */}
            {(trend || otherMode("single") || otherMode("trend")) && <ComingSoon />}
          </div>
          {where === "meeting" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--cc-label)", marginTop: 7 }}>
              <Toggle on={s.rollForward} onChange={(v) => fork({ ...s, rollForward: v })} label="Roll forward" />
              {s.rollForward ? "Roll forward to the newest year when new data lands" : `Pinned to ${latest ?? "this year"}: new data won't move it`}
            </label>
          ) : (
            // A dashboard always shows the newest data: pinning a view to a year isn't drawn
            // there yet (0.6 snag 4 / 01).
            <div data-roll-forward="coming-soon" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--cc-faint)", marginTop: 7 }}>
              <Toggle on disabled onChange={() => {}} label="Roll forward" />
              Roll forward to the newest year when new data lands
              <ComingSoon />
            </div>
          )}
        </FilterBox>

        <FilterBox>
          <FilterLabel>Look</FilterLabel>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
            {LOOK_ORDER.map((v) => (
              <BoardChip key={v} size="xs" active={s.look === v} off={!hasLook(v)} onClick={() => move("look", { ...want, look: v })}>
                {VIEW_TYPE_LABEL[v]}
              </BoardChip>
            ))}
          </div>
        </FilterBox>

        {tileViewDef(s.dv.id) && <FiguresBox dv={s.dv} ctx={ctx} tiles={s.tiles} mainLabel={s.mainLabel} onChange={(tiles, mainLabel) => fork({ ...s, tiles, mainLabel })} />}

        <div style={{ border: "1px solid var(--cc-border)", borderRadius: 10, padding: 10, background: "var(--cc-panel)", display: "flex", flexDirection: "column", gap: 7 }}>
          <FilterLabel>Title</FilterLabel>
          {editingTitle ? (
            <input
              autoFocus
              type="text"
              value={s.title}
              aria-label="Title, with placeholders in square brackets"
              onChange={(e) => fork({ ...s, title: e.target.value, titleEdited: true })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingTitle(false);
              }}
              style={{ fontSize: 12.5, color: "var(--cc-ink)", lineHeight: 1.8, border: "1px solid var(--cc-blue)", borderRadius: 8, padding: "6px 9px", background: "var(--cc-panel)", outline: "none", fontFamily: "inherit" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              aria-label="Edit the title"
              style={{ fontSize: 12.5, color: "var(--cc-ink)", lineHeight: 1.8, border: "1px solid var(--cc-border2)", borderRadius: 8, padding: "6px 9px", background: "var(--cc-panel)", textAlign: "left", cursor: "text", fontFamily: "inherit" }}
            >
              <TitleTokens template={s.title} />
            </button>
          )}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} style={{ fontSize: 11, color: "var(--cc-blue)", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              + Insert placeholder
            </button>
            {menuOpen && (
              <PanelMenu label="Insert placeholder" width={220}>
                {TITLE_PLACEHOLDERS.map((t) => (
                  <MenuRow
                    key={t}
                    label={`${t} — ${resolveTitle(t, s.dv, ctx, { fromYear: s.fromYear })}`}
                    onClick={() => {
                      fork({ ...s, title: `${s.title.trimEnd()} ${t}`, titleEdited: true });
                      setMenuOpen(false);
                    }}
                  />
                ))}
              </PanelMenu>
            )}
          </div>
        </div>
      </Body>
      <Footer>
        <SecondaryButton
          onClick={() => {
            if (!forked) return onBack();
            setS(initial(base, ctx));
            setForked(false);
          }}
        >
          Back to ready-made
        </SecondaryButton>
        <PrimaryButton onClick={() => onAdd(s.dv, forked ? params : null)}>{words.add}</PrimaryButton>
      </Footer>
    </>
  );
}
