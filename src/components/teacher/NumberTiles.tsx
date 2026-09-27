"use client";

// Snagging round 1 Part 2: the number-tiles view. One main figure -- the panel's own
// headline value, labelled as the card labels it -- then a row of subsidiary tiles, each
// an icon BESIDE one larger core figure ("2nd", "+8%", "5.3") with its scope in a single
// line underneath ("of 5 in Humanities & Social Sciences"). Generic on purpose: Column 1's
// Current panel (Candidates and Results) and Column 3's ranking-set view (Part 4) fill it
// with different figures, one visual language.
import type { ReactNode } from "react";
import { DIRECTION_TEXT, type Direction } from "@/lib/teacher-view-trend-styles";

export type NumberTile = {
  key: string;
  icon: ReactNode;
  figure: string;
  detail: string;
  // Colours the figure in the app's direction tones (a change, a gap to England).
  direction?: Direction;
};

// 1 -> "1st", 2 -> "2nd", 11 -> "11th", 22 -> "22nd".
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n.toLocaleString()}${suffix}`;
}

export function NumberTiles({
  main,
  tiles,
  fullscreen = false,
}: {
  main: { figure: string; label: string } | null;
  tiles: NumberTile[];
  fullscreen?: boolean;
}) {
  return (
    <div className={`flex flex-col ${fullscreen ? "gap-6 py-4" : "gap-4 py-1"}`}>
      {main && (
        // The hero: a centred, fit-content box (a theme-aware --fg border) floating over a
        // soft glow in the app's own teal "up" tone (DIRECTION_FILL.up, #2dd4bf in dark).
        <div className="relative isolate self-center">
          <div aria-hidden="true" className="absolute inset-0 -z-10 rounded-[18px] bg-[#14b8a6] opacity-25 blur-xl dark:bg-[#2dd4bf]" />
          <div className={`w-fit rounded-[14px] border border-[var(--fg)]/25 bg-[var(--panel-bg)] text-center ${fullscreen ? "px-8 py-5" : "px-5 py-3"}`}>
            <p className={`font-bold leading-none tabular-nums text-[var(--fg)] ${fullscreen ? "text-[112px]" : "text-[80px]"}`}>{main.figure}</p>
            <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">{main.label}</p>
          </div>
        </div>
      )}
      {tiles.length > 0 && (
        // Guy's "subsidiary figures in a row": three across a ~400px card (each ~5.5rem),
        // wrapping to fewer only on a narrower one rather than squeezing a detail line to
        // a word per line.
        <ul className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${fullscreen ? "11rem" : "5.5rem"}, 1fr))` }}>
          {tiles.map((t) => (
            <li key={t.key} className={`flex min-w-0 flex-col gap-1 rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] ${fullscreen ? "px-3.5 py-3" : "px-2 py-2"}`}>
              <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-[var(--muted)] ${fullscreen ? "[&_svg]:h-5 [&_svg]:w-5" : ""}`}>{t.icon}</span>
                <span className={`font-bold leading-tight tabular-nums ${fullscreen ? "text-[26px]" : "text-[19px]"} ${t.direction ? DIRECTION_TEXT[t.direction] : "text-[var(--fg)]"}`}>
                  {t.figure}
                </span>
              </div>
              <p className={`leading-snug text-[var(--muted)] ${fullscreen ? "text-[13px]" : "text-[11px]"}`}>{t.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
