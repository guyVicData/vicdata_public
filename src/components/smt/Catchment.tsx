"use client";

// VicData 0.8 SMT round 4 (R1, R3): Context's Area pill -- "Area: within 5 km · local authority". The
// miles of the prompt are km by Guy's decision (catchment.ts). The menu picks the area (within the
// radius, or the local authority), the radius (presets and a whole-km slider up to the school's cap),
// and, for the School-Admin, saves it as the school's usual catchment. Changing the radius without
// saving changes only this view (held in the address, ?km=); Copy this view and Edit keep it.
// R-SMT-RADIUS.
import { useState } from "react";
import { PillMenu } from "@/components/shell/PillMenu";
import { MenuDivider, MenuRow } from "@/components/shell/PanelMenu";
import { smtNote } from "@/catalogue/notes";
import { kmWord, type Catchment } from "@/lib/smt/catchment";
import type { ContextArea } from "@/lib/smt/context";
import { cx } from "@/components/admissions/ui";

export type CatchmentInfo = { savedKm: number | null; defaultKm: number; capKm: number; presets: number[]; canSave: boolean };

export function AreaPill({
  area,
  laName,
  catchment,
  info,
  independent,
  onArea,
  onKm,
  onSave,
}: {
  area: ContextArea;
  laName: string | null;
  catchment: Catchment | null; // what the board draws (from /api/smt/context)
  info: CatchmentInfo | null;
  independent: boolean;
  onArea: (a: ContextArea) => void;
  onKm: (km: number | null) => void; // null = back to the school's usual
  onSave: (km: number | null) => Promise<string | null>; // an error, or null
}) {
  const km = catchment?.km ?? info?.savedKm ?? info?.defaultKm ?? null;
  const cap = info?.capKm ?? catchment?.capKm ?? 15;
  const presets = info?.presets ?? [];
  const usual = info ? (info.savedKm !== null ? Math.min(info.savedKm, cap) : info.defaultKm) : null;
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? km;
  const kind = independent ? "an independent" : "a state";
  const value = area === "la" ? `${laName ?? "the LA"} · local authority` : km !== null ? `within ${kmWord(km)} · local authority` : "around the school";
  return (
    <PillMenu label="Area" value={value} menuLabel="Area" width={320} align="left" title={km !== null ? smtNote("aroundSchool", { radius: kmWord(km) }) : undefined}>
      {(close) => (
        <div data-area-pill="" className="flex flex-col">
          <MenuRow label={km !== null ? `Within ${kmWord(km)} of the school` : "Around the school"} selected={area === "around"} onClick={() => { onArea("around"); close(); }} />
          <MenuRow label={`Local authority: ${laName ?? "the LA"}`} selected={area === "la"} onClick={() => { onArea("la"); close(); }} />
          <MenuDivider />
          <div className="flex flex-col gap-2 px-3 pb-2 pt-1">
            <div className="text-[11px] font-semibold text-[var(--muted2)]">Radius</div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Radius presets">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  data-km-preset={p}
                  aria-pressed={p === km && area === "around"}
                  onClick={() => { setDraft(null); onKm(p === usual ? null : p); onArea("around"); }}
                  className={cx("h-[22px] rounded-full border px-2 text-[11px] font-semibold tabular-nums", p === km && area === "around" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--panel-border2)] text-[var(--chip-fg)] hover:text-[var(--fg)]")}
                >
                  {kmWord(p)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[11px] text-[var(--chip-fg)]">
              <input
                type="range"
                min={2}
                max={cap}
                step={1}
                value={shown ?? 2}
                aria-label="Radius in km"
                data-km-slider=""
                onChange={(e) => setDraft(Number(e.target.value))}
                onPointerUp={() => { if (draft !== null) { onKm(draft === usual ? null : draft); onArea("around"); setDraft(null); } }}
                onKeyUp={() => { if (draft !== null) { onKm(draft === usual ? null : draft); onArea("around"); setDraft(null); } }}
                className="grow accent-[var(--accent)]"
              />
              <span className="w-[42px] text-right font-semibold tabular-nums text-[var(--fg)]">{shown !== null ? kmWord(shown) : "—"}</span>
            </label>
            <div className="text-[10.5px] leading-snug text-[var(--muted)]">{smtNote("catchmentCap", { cap: kmWord(cap), kind })}</div>
          </div>
          <MenuDivider />
          <div className="flex flex-col gap-1.5 px-3 pb-2.5 pt-1 text-[11px] leading-snug text-[var(--chip-fg)]" data-catchment-usual="">
            {info && (
              <div>
                {info.savedKm !== null ? smtNote("catchmentSaved", { radius: kmWord(Math.min(info.savedKm, cap)) }) : smtNote("catchmentDefault", { kind, radius: kmWord(info.defaultKm) })}
                {catchment?.capped && <> {smtNote("catchmentCapped", { saved: kmWord(info.savedKm ?? 0), cap: kmWord(cap) })}</>}
              </div>
            )}
            {catchment?.from === "view" && usual !== null && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--muted2)]">{smtNote("catchmentView", { radius: kmWord(catchment.km), usual: kmWord(usual) })}</span>
                <button type="button" data-km-usual="" onClick={() => onKm(null)} className="ml-auto shrink-0 font-semibold text-[var(--accent)] hover:underline">
                  Back to {kmWord(usual)}
                </button>
              </div>
            )}
            {info?.canSave && km !== null && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-km-save=""
                  disabled={saving || (info.savedKm !== null && info.savedKm === km)}
                  onClick={async () => {
                    setSaving(true);
                    setError(await onSave(km));
                    setSaving(false);
                  }}
                  className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11.5px] font-semibold text-[#06120c] disabled:opacity-40"
                >
                  {saving ? "Saving…" : `Save ${kmWord(km)} as our usual catchment`}
                </button>
                {info.savedKm !== null && (
                  <button type="button" data-km-clear="" disabled={saving} onClick={async () => { setSaving(true); setError(await onSave(null)); setSaving(false); }} className="text-[11px] text-[var(--muted)] hover:text-[var(--fg)]">
                    Clear
                  </button>
                )}
              </div>
            )}
            {error && <div className="text-[var(--adm-orange)]">{error}</div>}
          </div>
        </div>
      )}
    </PillMenu>
  );
}
