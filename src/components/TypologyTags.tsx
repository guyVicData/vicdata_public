import type { SchoolTypology } from "@/lib/typology";
import { TAG_COLOURS } from "@/lib/tag-colours";

function Tag({ label }: { label: string }) {
  const style = TAG_COLOURS[label];
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
