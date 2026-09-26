"use client";

// Teacher view onboarding, step 1 (GCSE/Post16-Step1.dc.html): "Which qualifications do
// you teach?" -- one tick-to-select tile per qualification family the school genuinely
// has entries under. The families come from real data (KS5_BUCKETS / displayBucketFor at KS5,
// ks4QualificationFamily at KS4); only their icons, colours and one-line descriptions are
// design. A family with nothing behind it is never offered.
import type { ReactNode } from "react";
import type { QualificationFamily } from "@/lib/teacher-view-theme";

const DOTS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
  </svg>
);

// Literal from the mockups (and the onboarding rebuild brief).
const FAMILY_ICONS: Record<string, ReactNode> = {
  "ks4:gcse": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10v6" /><path d="M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  "ks4:btec_ocr": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" />
    </svg>
  ),
  "ks4:other_vocational": DOTS,
  "ks5:alevel": (
    <svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <g transform="matrix(1,0,0,1,-306,0)"><g transform="matrix(1,0,0,1,306,0)"><g transform="matrix(1,0,0,1,12,0)"><g transform="matrix(3.925511,0,0,2.731409,-34.25031,-69.515531)">
        <path d="M43.113,82.362L38.366,57.87L38.176,57.87L33.43,82.362L43.113,82.362ZM19.19,106L34.284,38.409L42.353,38.409L57.447,106L47.764,106L44.916,91.476L31.721,91.476L28.873,106L19.19,106Z" />
      </g></g></g></g>
    </svg>
  ),
  "ks5:ib": (
    <svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <g transform="matrix(1,0,0,1,-918,0)"><g transform="matrix(1,0,0,1,918,0)"><g transform="matrix(1,0,0,1,12,0)"><g transform="matrix(1,0,0,1,0,-2)"><g transform="matrix(3.925511,0,0,2.731409,-77.25031,-66.515531)">
        <rect x="23.841" y="38.409" width="9.683" height="67.591" />
        <path d="M42.923,106L42.923,38.409L57.067,38.409C60.168,38.409 62.811,38.884 64.994,39.833C67.178,40.782 68.965,42.048 70.358,43.63C71.75,45.212 72.747,47.032 73.348,49.089C73.949,51.146 74.25,53.282 74.25,55.497L74.25,57.965C74.25,59.8 74.108,61.351 73.823,62.616C73.538,63.882 73.111,64.99 72.541,65.939C71.465,67.711 69.82,69.23 67.605,70.496C69.883,71.572 71.56,73.154 72.636,75.242C73.712,77.331 74.25,80.179 74.25,83.786L74.25,87.583C74.25,93.532 72.81,98.089 69.931,101.253C67.051,104.418 62.447,106 56.118,106L42.923,106ZM52.606,74.673L52.606,96.317L56.783,96.317C58.745,96.317 60.279,96.032 61.387,95.463C62.494,94.893 63.333,94.102 63.902,93.089C64.472,92.077 64.82,90.874 64.947,89.482C65.073,88.09 65.137,86.571 65.137,84.925C65.137,83.217 65.042,81.729 64.852,80.464C64.662,79.198 64.282,78.122 63.713,77.236C63.08,76.35 62.225,75.701 61.149,75.29C60.074,74.878 58.65,74.673 56.878,74.673L52.606,74.673ZM52.606,47.522L52.606,66.129L56.972,66.129C60.2,66.129 62.368,65.322 63.475,63.708C64.583,62.094 65.137,59.737 65.137,56.636C65.137,53.598 64.519,51.32 63.285,49.801C62.051,48.282 59.82,47.522 56.593,47.522L52.606,47.522Z" />
      </g></g></g></g></g>
    </svg>
  ),
  "ks5:btec_ocr": (
    <svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <g transform="matrix(1,0,0,1,-612,0)"><g transform="matrix(1,0,0,1,612,0)"><g transform="matrix(3.925511,0,0,2.731409,-22.25031,-68.515531)">
        <path d="M56.403,38.409L42.543,106L33.999,106L20.234,38.409L30.487,38.409L38.176,85.59L38.366,85.59L46.15,38.409L56.403,38.409Z" />
      </g></g></g>
    </svg>
  ),
  "ks5:tlevel": (
    <svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <g transform="matrix(1,0,0,1,-1224,0)"><g transform="matrix(1,0,0,1,1224,0)"><g transform="matrix(1,0,0,1,12,0)"><g transform="matrix(3.925511,0,0,2.731409,-20.25031,-69.515531)">
        <path d="M29.917,106L29.917,47.522L18.715,47.522L18.715,38.409L50.802,38.409L50.802,47.522L39.6,47.522L39.6,106L29.917,106Z" />
      </g></g></g></g>
    </svg>
  ),
  "ks5:other": DOTS,
};

export function familyIcon(phase: "ks4" | "ks5", familyId: string): ReactNode {
  return FAMILY_ICONS[`${phase}:${familyId}`] ?? DOTS;
}

export function QualificationFamilyTiles({
  phase,
  families,
  selected,
  onToggle,
  subjectCounts,
}: {
  phase: "ks4" | "ks5";
  families: QualificationFamily[];
  selected: string[];
  onToggle: (id: string) => void;
  // How many of the school's subjects sit under each family -- §14: a thing you are about
  // to pick should say how big it is while you are picking it.
  subjectCounts: Record<string, number>;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {families.map((f) => {
        const on = selected.includes(f.id);
        const n = subjectCounts[f.id] ?? 0;
        return (
          <button
            key={f.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(f.id)}
            // Mockup: selected = 1.5px border in the family colour over a 10% tint; not
            // selected = the ordinary 1px panel border and panel background.
            className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors"
            style={
              on
                ? { border: `1.5px solid ${f.hex}`, background: `rgba(${f.rgb},0.10)` }
                : { border: "1px solid var(--panel-border)", background: "var(--panel-bg)" }
            }
          >
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
              style={{ background: `rgba(${f.rgb},${on ? 0.18 : 0.14})`, color: f.hex }}
            >
              {familyIcon(phase, f.id)}
            </span>
            <span className="min-w-0 flex-grow">
              <span className="block text-[14.5px] font-bold">{f.label}</span>
              <span className="mt-px block text-xs text-[var(--muted2)]">
                {f.description} &middot; {n} subject{n === 1 ? "" : "s"} here
              </span>
            </span>
            {on ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px]" style={{ background: f.hex }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a0a0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            ) : (
              <span className="h-5 w-5 shrink-0 rounded-[5px] border-[1.5px] border-[var(--muted3)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
