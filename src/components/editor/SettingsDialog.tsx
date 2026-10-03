"use client";

// VicData 0.6 S5: dashboard Settings (scope brief §4.2-4.3). No board draws it, so it is
// New 1-2's controls in the editor's dialog shell: colour (follows main data unless
// changed), when a row opens, linked dashboards, and the number of columns.
import { useState } from "react";
import type { DashboardConfig } from "@/catalogue/types";
import { PrimaryButton, SecondaryButton } from "@/components/teacher/chooser/ui";
import { DASHBOARD_COLOURS, colourHex, colourValue } from "@/lib/editor-layout";
import { DLabel, Dialog, Note, Segmented, inputStyle } from "./bits";
import { DashboardIcon } from "@/components/library/DashboardIcon";
import { IconDialog } from "@/components/library/IconDialog";

export type SettingsValue = {
  colour: DashboardConfig["colour"];
  accordion: DashboardConfig["layout"]["accordion"];
  group: DashboardConfig["group"] | null;
  columns: number;
  // 0.6 integration: the dashboard's icon (S6's Icon dialog); undefined = unchanged.
  icon?: DashboardConfig["icon"];
};

export function SettingsDialog({ config, groups, superAdmin = true, onDone, onClose }: { config: DashboardConfig; groups: { id: string; label: string }[]; superAdmin?: boolean; onDone: (v: SettingsValue) => void; onClose: () => void }) {
  const [hex, setHex] = useState(colourHex(config.colour));
  const [icon, setIcon] = useState<DashboardConfig["icon"]>(config.icon);
  const [iconOpen, setIconOpen] = useState(false);
  const [accordion, setAccordion] = useState(config.layout.accordion);
  const [group, setGroup] = useState<{ id: string; label: string } | null>(config.group ? { id: config.group.id, label: config.group.label } : null);
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [columns, setColumns] = useState(config.columns.length);
  const allGroups = [...groups.filter((g) => g.id !== config.group?.id), ...(config.group ? [{ id: config.group.id, label: config.group.label }] : [])];
  const chip = (on: boolean) =>
    ({ border: `1px solid ${on ? "var(--cc-primary)" : "var(--cc-border2)"}`, background: on ? "var(--cc-primary)" : "var(--cc-panel)", color: on ? "var(--cc-on-primary)" : "var(--cc-label)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: on ? 700 : 600, cursor: "pointer" }) as const;
  return (
    <Dialog
      label="Dashboard settings"
      title="Settings"
      sub={config.name}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() =>
              onDone({
                colour: colourValue(hex),
                accordion,
                group: newGroup?.trim()
                  ? { id: `group.${newGroup.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: newGroup.trim(), order: 0 }
                  : group
                    ? { id: group.id, label: group.label, order: config.group?.id === group.id ? config.group.order : 99 }
                    : null,
                columns,
                icon,
              })
            }
          >
            Done
          </PrimaryButton>
        </>
      }
    >
      <DLabel>Colour</DLabel>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flex: "0 0 auto" }}>
        {DASHBOARD_COLOURS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={`${c.label} colour`}
            aria-pressed={c.hex === hex}
            onClick={() => setHex(c.hex)}
            style={{ width: c.hex === hex ? 30 : 24, height: c.hex === hex ? 30 : 24, borderRadius: "50%", border: c.hex === hex ? "2px solid var(--cc-ink)" : "none", background: c.hex, cursor: "pointer" }}
          />
        ))}
      </div>

      <DLabel top={6}>Icon</DLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
        <DashboardIcon config={{ ...config, icon, colour: colourValue(hex) }} size={38} />
        <SecondaryButton onClick={() => setIconOpen(true)}>Change icon&hellip;</SecondaryButton>
      </div>
      <IconDialog
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        dashboard={{ ...config, icon, colour: colourValue(hex) }}
        superAdmin={superAdmin}
        onUse={(spec, colour) => {
          setIcon(spec);
          setHex(colourHex(colour));
          setIconOpen(false);
        }}
      />

      <DLabel top={6}>When a row opens</DLabel>
      <Segmented
        label="When a row opens"
        value={accordion}
        onChange={setAccordion}
        pad="9px 8px"
        fontSize={12.5}
        options={[
          { id: "auto-close", label: "Close the others" },
          { id: "independent", label: "Leave them open" },
        ]}
      />

      <DLabel top={6}>Link with other dashboards</DLabel>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "0 0 auto" }}>
        <button type="button" onClick={() => { setGroup(null); setNewGroup(null); }} style={chip(!group && newGroup === null)}>
          On its own
        </button>
        {allGroups.map((g) => (
          <button key={g.id} type="button" onClick={() => { setGroup(g); setNewGroup(null); }} style={chip(group?.id === g.id && newGroup === null)}>
            Join &ldquo;{g.label}&rdquo;
          </button>
        ))}
        <button type="button" onClick={() => setNewGroup("")} style={chip(newGroup !== null)}>
          + New group
        </button>
      </div>
      {newGroup !== null && <input type="text" autoFocus placeholder="Group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} style={inputStyle} />}
      <Note>Linked dashboards share a switcher in the top bar, like Candidates &#8644; Results.</Note>

      <DLabel top={6}>Columns</DLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flex: "0 0 auto" }}>
        <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--cc-border2)", borderRadius: 999 }}>
          <button type="button" aria-label="Fewer columns" disabled={columns <= 1} onClick={() => setColumns(columns - 1)} style={{ width: 28, height: 28, border: "none", background: "none", color: "var(--cc-label)", cursor: "pointer" }}>
            &minus;
          </button>
          <span style={{ fontWeight: 700, minWidth: 14, textAlign: "center" }}>{columns}</span>
          <button type="button" aria-label="More columns" disabled={columns >= 4} onClick={() => setColumns(columns + 1)} style={{ width: 28, height: 28, border: "none", background: "none", color: "var(--cc-label)", cursor: "pointer" }}>
            +
          </button>
        </span>
      </div>
      <Note>{columns < config.columns.length ? `The last ${config.columns.length - columns === 1 ? "column" : `${config.columns.length - columns} columns`} and ${config.columns.length - columns === 1 ? "its" : "their"} panels will be removed.` : "Max 4 columns. A new column copies the last one's data; set it with Edit column."}</Note>
    </Dialog>
  );
}
