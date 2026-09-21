"use client";

import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import type { TeacherPhase } from "@/lib/teacher-view-phases";

// Home.dc.html's cards, literally: a stacked single column (not a grid), each card a
// 14px-radius panel with a 1.5px border, a 38px icon square tinted at 14% of the card's
// own colour, title and one-line description, and -- for phases -- the tour/open line
// in that colour underneath. On hover the border takes the colour and the card a 10%
// tint of it. The colour arrives as --tile / --tile-rgb so one card component serves
// every phase and feature.
export type TileColour = { hex: string; rgb: string };

// KS2 is not in the mockups, so it has no colour of its own; it gets the neutral muted
// tone rather than a borrowed accent that would read as meaning something.
export const NEUTRAL_TILE: TileColour = { hex: "var(--muted)", rgb: "138,138,144" };

export function PhaseGlyph({ phase }: { phase: TeacherPhase }) {
  if (phase === "ks4") {
    return (
      <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
        <g transform="matrix(1,0,0,1,-1836,0)">
          <g transform="matrix(1,0,0,1,1836,0)">
            <g transform="matrix(3.925511,0,0,2.731409,-25.25031,-68.515531)">
              <path d="M22.987,54.357C22.987,51.636 23.462,49.231 24.411,47.143C25.36,45.054 26.626,43.314 28.208,41.921C29.727,40.592 31.452,39.58 33.382,38.884C35.312,38.188 37.258,37.839 39.22,37.839C41.182,37.839 43.128,38.188 45.059,38.884C46.989,39.58 48.745,40.592 50.327,41.921C51.846,43.314 53.08,45.054 54.03,47.143C54.979,49.231 55.454,51.636 55.454,54.357L55.454,57.775L45.771,57.775L45.771,54.357C45.771,52.016 45.122,50.291 43.824,49.184C42.527,48.076 40.992,47.522 39.22,47.522C37.448,47.522 35.914,48.076 34.616,49.184C33.319,50.291 32.67,52.016 32.67,54.357L32.67,90.052C32.67,92.393 33.319,94.118 34.616,95.225C35.914,96.333 37.448,96.887 39.22,96.887C40.992,96.887 42.527,96.333 43.824,95.225C45.122,94.118 45.771,92.393 45.771,90.052L45.771,77.331L38.081,77.331L38.081,68.787L55.454,68.787L55.454,90.052C55.454,92.9 54.979,95.336 54.03,97.361C53.08,99.386 51.846,101.064 50.327,102.393C48.745,103.785 46.989,104.829 45.059,105.525C43.128,106.222 41.182,106.57 39.22,106.57C37.258,106.57 35.312,106.222 33.382,105.525C31.452,104.829 29.727,103.785 28.208,102.393C26.626,101.064 25.36,99.386 24.411,97.361C23.462,95.336 22.987,92.9 22.987,90.052L22.987,54.357Z" />
            </g>
          </g>
        </g>
      </svg>
    );
  }
  if (phase === "ks5") {
    return (
      <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
        <g transform="matrix(1,0,0,1,0,-3.395208)">
          <g transform="matrix(3.244681,0,0,2.257681,-67.887782,-33.320102)">
            <path d="M33.714,106L33.714,48.662L24.031,55.781L24.031,45.529L33.714,38.409L43.397,38.409L43.397,106L33.714,106Z" />
            <path d="M73.396,38.409L62.384,66.793L62.573,66.983C62.89,66.73 63.38,66.524 64.045,66.366C64.709,66.208 65.58,66.129 66.655,66.129C68.364,66.129 69.946,66.54 71.402,67.363C72.858,68.186 73.997,69.23 74.82,70.496C75.263,71.192 75.611,71.888 75.864,72.584C76.117,73.28 76.338,74.198 76.528,75.337C76.655,76.476 76.75,77.916 76.813,79.657C76.876,81.397 76.908,83.596 76.908,86.254C76.908,88.469 76.876,90.289 76.813,91.713C76.75,93.137 76.655,94.323 76.528,95.273C76.338,96.285 76.101,97.14 75.816,97.836C75.532,98.532 75.168,99.26 74.725,100.019C73.459,102.108 71.766,103.722 69.646,104.861C67.526,106 65.137,106.57 62.478,106.57C59.82,106.57 57.447,105.984 55.359,104.813C53.27,103.643 51.593,102.045 50.327,100.019C49.821,99.26 49.425,98.532 49.141,97.836C48.856,97.14 48.65,96.285 48.524,95.273C48.334,94.323 48.207,93.137 48.144,91.713C48.081,90.289 48.049,88.469 48.049,86.254C48.049,84.166 48.081,82.441 48.144,81.081C48.207,79.72 48.302,78.533 48.429,77.521C48.555,76.571 48.745,75.701 48.998,74.91C49.251,74.119 49.536,73.28 49.853,72.394L62.573,38.409L73.396,38.409ZM67.225,79.514C67.225,78.059 66.75,76.888 65.801,76.002C64.852,75.116 63.744,74.673 62.478,74.673C61.213,74.673 60.105,75.116 59.156,76.002C58.207,76.888 57.732,78.059 57.732,79.514L57.732,92.045C57.732,93.501 58.207,94.672 59.156,95.558C60.105,96.444 61.213,96.887 62.478,96.887C63.744,96.887 64.852,96.444 65.801,95.558C66.75,94.672 67.225,93.501 67.225,92.045L67.225,79.514Z" />
          </g>
          <g transform="matrix(1.372534,0,0,1.372534,13.667421,-49.625185)">
            <path d="M146.689,128.685L146.689,111.735L153.055,111.735L153.055,128.685L170.005,128.685L170.005,135.051L153.055,135.051L153.055,152L146.689,152L146.689,135.051L129.74,135.051L129.74,128.685L146.689,128.685Z" />
          </g>
        </g>
      </svg>
    );
  }
  return <span className="text-[11px] font-extrabold">KS2</span>;
}

export const RecruitmentGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const MeetingsGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
  </svg>
);

export function HomeCard({
  href,
  colour,
  icon,
  title,
  description,
  footer,
}: {
  href: string;
  colour: TileColour;
  icon: ReactNode;
  title: string;
  description: string;
  footer?: string;
}) {
  return (
    <Link
      href={href}
      style={{ "--tile": colour.hex, "--tile-rgb": colour.rgb } as CSSProperties}
      className="block rounded-[14px] border-[1.5px] border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 transition-colors duration-100 hover:border-[var(--tile)] hover:bg-[rgba(var(--tile-rgb),0.10)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--tile-rgb),0.14)] text-[var(--tile)]">
          {icon}
        </div>
        <div className="min-w-0 flex-grow">
          <p className="text-[15px] font-bold">{title}</p>
          <p className="mt-0.5 text-[13px] text-[var(--muted2)]">{description}</p>
        </div>
      </div>
      {footer && <p className="mt-2.5 text-[12.5px] font-semibold text-[var(--tile)]">{footer} &rarr;</p>}
    </Link>
  );
}
