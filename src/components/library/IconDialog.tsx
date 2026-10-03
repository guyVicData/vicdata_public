"use client";

// VicData 0.6 S6: "Dashboard icon" (docs/wireframes/v0.6/Icon.dc.html) -- a dashboard's
// coloured icon from one of its views (the view's standard rail glyph, data-free), from
// the icon set (the app's own glyphs), or uploaded (super-admin only in 0.6, decision D8),
// on a colour from the six real accents.
//
// Self-contained: the editor (S5) and the library open it with the dashboard's config and
// get back { icon, colour } to write into the config. Shell: TeacherModal "chooser" + the
// comparator chooser's Panel / Body / Footer, as the Add a view chooser uses.
import { useMemo, useRef, useState } from "react";
import type { DashboardConfig } from "@/catalogue/types";
import { dataviewById } from "@/catalogue";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import { Body, Footer, Panel, PrimaryButton } from "@/components/teacher/chooser/ui";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import {
  colourByKey,
  colourKeyOf,
  colourOf,
  DASHBOARD_COLOURS,
  ICON_BUCKET,
  ICON_SET,
  iconOf,
  resolveIcon,
  uploadPath,
  viewsOn,
  withColour,
  type ColourKey,
  type DashboardIconSpec,
  type IconSource,
  type TileColour,
} from "@/lib/dashboard-icons";
import { isMissingTable } from "@/lib/dashboards-store";
import { IconGlyph, SpecTile } from "./DashboardIcon";
import { CpvStyles, DialogHeader, Label, Note, Segmented } from "./dialog";
import { ICON_UI } from "./layout";

export type IconDialogProps = {
  open: boolean;
  onClose: () => void;
  dashboard: Pick<DashboardConfig, "id" | "name" | "kind" | "columns" | "panels" | "icon" | "colour">;
  superAdmin: boolean;
  onUse: (icon: DashboardIconSpec, colour: DashboardConfig["colour"]) => void;
};

export function IconDialog(props: IconDialogProps) {
  if (!props.open) return null;
  return <Dialog {...props} />;
}

function Dialog({ onClose, dashboard, superAdmin, onUse }: IconDialogProps) {
  const start = iconOf(dashboard);
  const views = useMemo(() => viewsOn(dashboard), [dashboard]);
  const [tab, setTab] = useState<IconSource>(start.source === "upload" && !superAdmin ? "set" : start.source === "view" && !views.length ? "set" : start.source);
  const [spec, setSpec] = useState<DashboardIconSpec>(start);
  const [colour, setColour] = useState<ColourKey | "neutral">(colourKeyOf(dashboard.colour));
  const tile: TileColour = colour === "neutral" ? colourOf({ key: "neutral" }) : colourByKey(colour)!;
  const phaseKey = dashboard.colour.key === "ks5" ? "ks5" : "ks4";
  const swatches = [colourByKey(phaseKey)!, ...DASHBOARD_COLOURS.filter((c) => c.key !== phaseKey)];

  const use = () => onUse(spec, colour === "neutral" ? dashboard.colour : withColour(dashboard.colour, colour));

  return (
    <TeacherModal label="Dashboard icon" backdropLabel="Close Dashboard icon" size="chooser" onClose={onClose}>
      <Panel>
        <div className="cpv-root" style={{ display: "contents" }}>
        <CpvStyles />
        <DialogHeader title="Dashboard icon" subtitle={dashboard.name} onClose={onClose} />
        <Body gap={14}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--bg)", border: "1px solid var(--panel-border)", borderRadius: 12, padding: ICON_UI.previewPad, flex: "0 0 auto" }}>
            <SpecTile spec={spec} colour={tile} size={ICON_UI.previewTile} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>{dashboard.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>How it shows in your library</div>
            </div>
          </div>

          <Segmented<IconSource>
            pad="8px 6px"
            fontSize={12}
            value={tab}
            onChange={setTab}
            options={[
              { id: "view", label: "From a view", disabled: !views.length, title: views.length ? undefined : "This dashboard has no views yet" },
              { id: "set", label: "Icon set" },
              { id: "upload", label: "Upload", disabled: !superAdmin, title: superAdmin ? undefined : "Only super-admin can upload in 0.6" },
            ]}
          />

          {tab === "view" && (
            <>
              <Label>Pick a view on this dashboard</Label>
              <TileGrid>
                {views.map((id) => (
                  <PickTile
                    key={id}
                    on={spec.source === "view" && spec.ref === id}
                    label={dataviewById(id)?.label ?? id}
                    colour={tile.hex}
                    onClick={() => setSpec({ source: "view", ref: id })}
                  >
                    <IconGlyph drawing={resolveIcon({ source: "view", ref: id })} size={ICON_UI.viewGlyphHeight} />
                  </PickTile>
                ))}
              </TileGrid>
              <Note style={{ marginTop: -6 }}>Drawn as a simplified, data-free glyph &mdash; not a screenshot.</Note>
            </>
          )}

          {tab === "set" && (
            <>
              <Label>Pick from the icon set</Label>
              <TileGrid>
                {ICON_SET.map((i) => (
                  <PickTile key={i.ref} on={spec.source === "set" && spec.ref === i.ref} label={i.label} colour={tile.hex} onClick={() => setSpec({ source: "set", ref: i.ref })}>
                    <IconGlyph drawing={{ kind: "set", ref: i.ref }} size={ICON_UI.viewGlyphHeight} />
                  </PickTile>
                ))}
              </TileGrid>
              <Note style={{ marginTop: -6 }}>The same icons the dashboards use, one for each meaning.</Note>
            </>
          )}

          {tab === "upload" && superAdmin && <Uploader dashboardId={dashboard.id} current={spec.source === "upload" ? spec : null} onUploaded={(ref) => setSpec({ source: "upload", ref })} />}

          <Label>Colour</Label>
          <div style={{ display: "flex", gap: ICON_UI.swatchGap, alignItems: "center", flexWrap: "wrap", flex: "0 0 auto" }} role="radiogroup" aria-label="Colour">
            {swatches.map((c, i) => (
              <span key={c.key} style={{ display: "contents" }}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={colour === c.key}
                  aria-label={i === 0 ? `${c.label} (default)` : c.label}
                  title={i === 0 ? `${c.label} (default)` : c.label}
                  onClick={() => setColour(c.key)}
                  style={{
                    width: ICON_UI.swatch,
                    height: ICON_UI.swatch,
                    borderRadius: "50%",
                    border: "none",
                    background: c.hex,
                    outline: colour === c.key ? "2px solid var(--cc-ink)" : "none",
                    outlineOffset: 2,
                    cursor: "pointer",
                  }}
                />
                {i === 0 && <span aria-hidden="true" style={{ width: 1, height: 20, background: "var(--cc-border)" }} />}
              </span>
            ))}
          </div>

          <div style={{ border: "1px dashed var(--cc-radio)", borderRadius: 10, padding: 12, fontSize: 12, color: "var(--cc-label)", lineHeight: 1.45, flex: "0 0 auto" }}>
            <strong style={{ color: "var(--cc-ink)" }}>Upload</strong> takes a square PNG or SVG, shown on the colour tile. In 0.6 only super-admin can upload; everyone can use a view or the icon set.
          </div>
        </Body>
        <Footer>
          <span />
          <PrimaryButton onClick={use}>Use this icon</PrimaryButton>
        </Footer>
        </div>
      </Panel>
    </TeacherModal>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${ICON_UI.viewGridCols}, minmax(0, 1fr))`, gap: 8, flex: "0 0 auto" }}>{children}</div>;
}

// .vt: a pickable glyph tile (the glyph in the dashboard's colour, its name under it).
function PickTile({ on, label, colour, onClick, children }: { on: boolean; label: string; colour: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      style={{
        border: on ? "1.5px solid var(--cc-blue)" : "1px solid var(--cc-border)",
        borderRadius: 10,
        padding: on ? 7.5 : 8,
        background: on ? "var(--cc-blue-tint)" : "var(--cc-panel)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 6,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ display: "flex", justifyContent: "center", color: colour }}>{children}</span>
      <span style={{ fontSize: 10.5, color: "var(--cc-ink)", fontWeight: 600, lineHeight: 1.25 }}>{label}</span>
    </button>
  );
}

function Uploader({ dashboardId, current, onUploaded }: { dashboardId: string; current: DashboardIconSpec | null; onUploaded: (ref: string) => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const upload = async (file: File) => {
    const path = uploadPath(dashboardId, file.name);
    if (!path) return setMessage("Choose a PNG or SVG.");
    if (file.size > 512 * 1024) return setMessage("That file is over 512 KB. Use a smaller square image.");
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage.from(ICON_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) setMessage(/bucket not found|not found/i.test(error.message) || isMissingTable(error as { message?: string }) ? "Uploads arrive once the database update is applied." : error.message);
      else onUploaded(path);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "That didn't upload. Try again.");
    }
    setBusy(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto" }}>
      <Label>Upload an image</Label>
      <input ref={input} type="file" accept="image/png,image/svg+xml,.png,.svg" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        style={{ border: "1px solid var(--cc-border2)", borderRadius: 20, background: "var(--cc-panel)", color: "var(--cc-ink)", padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}
      >
        {busy ? "Uploading…" : current ? "Choose another PNG or SVG…" : "Choose a PNG or SVG…"}
      </button>
      {current && <Note>Uploaded. It shows on the colour tile above.</Note>}
      {message && <div style={{ fontSize: 12, color: "var(--cc-danger)" }}>{message}</div>}
    </div>
  );
}
