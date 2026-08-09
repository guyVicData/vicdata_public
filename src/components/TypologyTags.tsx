import type { SchoolTypology } from "@/lib/typology";

// Tag pill colors -- chart palette doc's "first pass," deliberately a different
// family from the pupil-count gender chart (this tag means the school's own type,
// not an individual pupil). Six of twelve were named in the doc (Independent/
// Boarding & day/Boarding/Senior/Girls/Co-ed); the rest (State/Day/Junior/Prep/
// Sixth/Boys) are filled in here from the same standard hue families, chosen to stay
// visually distinct from their siblings. Every pill always carries its own text
// label, never color alone, so this hasn't been run through the colourblind
// validator the way the pupil-count chart colors were (identity isn't color-coded
// here) -- logged as provisional in docs/OPEN_QUESTIONS.md, same as the boarding
// threshold above it.
const TAG_STYLES: Record<string, { light: [string, string]; dark: [string, string] }> = {
  Independent: { light: ["#eff6ff", "#1e40af"], dark: ["#1e3a5f", "#93c5fd"] }, // blue
  State: { light: ["#f8fafc", "#1e293b"], dark: ["#293548", "#cbd5e1"] }, // slate
  Boarding: { light: ["#fff1ee", "#9a3324"], dark: ["#4a241d", "#f4a58f"] }, // coral
  Day: { light: ["#f0f9ff", "#075985"], dark: ["#173a4d", "#7dd3fc"] }, // sky
  "Boarding & day": { light: ["#f0fdfa", "#115e59"], dark: ["#14403c", "#5eead4"] }, // teal
  Junior: { light: ["#f7fee7", "#3f6212"], dark: ["#33400f", "#bef264"] }, // lime
  Prep: { light: ["#f5f3ff", "#5b21b6"], dark: ["#332355", "#c4b5fd"] }, // violet
  Senior: { light: ["#fffbeb", "#92400e"], dark: ["#4d3410", "#fcd34d"] }, // amber
  Sixth: { light: ["#fff7ed", "#9a3412"], dark: ["#4a2b14", "#fdba74"] }, // orange
  Boys: { light: ["#ecfeff", "#155e75"], dark: ["#173d45", "#67e8f9"] }, // cyan
  Girls: { light: ["#fdf2f8", "#9d174d"], dark: ["#4a2237", "#f9a8d4"] }, // pink
  "Co-ed": { light: ["#f9fafb", "#1f2937"], dark: ["#2a2d33", "#d1d5db"] }, // gray
};

function Tag({ label }: { label: string }) {
  const style = TAG_STYLES[label];
  if (!style) return null;
  const [lightBg, lightFg] = style.light;
  const [darkBg, darkFg] = style.dark;
  return (
    <span
      className="tag-pill inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={
        {
          "--tag-bg": lightBg,
          "--tag-fg": lightFg,
          "--tag-bg-dark": darkBg,
          "--tag-fg-dark": darkFg,
          backgroundColor: "var(--tag-bg)",
          color: "var(--tag-fg)",
        } as React.CSSProperties
      }
    >
      {label}
    </span>
  );
}

export default function TypologyTags({ typology }: { typology: SchoolTypology }) {
  const tags: string[] = [];
  if (typology.sector) tags.push(typology.sector);
  if (typology.boarding) tags.push(typology.boarding);
  tags.push(...typology.phase);
  if (typology.gender) tags.push(typology.gender);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .tag-pill {
            background-color: var(--tag-bg-dark) !important;
            color: var(--tag-fg-dark) !important;
          }
        }
        :root[data-theme="dark"] .tag-pill {
          background-color: var(--tag-bg-dark) !important;
          color: var(--tag-fg-dark) !important;
        }
      `}</style>
      {tags.map((t) => (
        <Tag key={t} label={t} />
      ))}
    </div>
  );
}
