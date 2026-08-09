"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

// Map component (map spec, "Public View rebuild"). Viewed school gets a distinct
// marker, always shown, with a place-name label. The Local Authority is coloured and
// labelled -- only the viewed school's own LA, not every LA the surrounding schools
// happen to span, deliberately: the contrast between the single coloured region and
// where the surrounding-school markers actually fall is itself the useful context.
// Surrounding schools are tier-split: free tier gets unlabelled dots (position only,
// safe to render for everyone -- no names), member tier gets labelled, clickable
// markers with names, fetched the same authenticated way as the named list.
//
// Real ONS boundary data (la-boundary.ts) and real school easting/northing, both in
// British National Grid -- plotted with one shared affine projection, no basemap
// tiles or map library dependency (consistent with this project's other charts,
// which are all hand-rolled SVG, not a charting library).

type Point = { easting: number; northing: number };

type ViewedSchool = { name: string; town: string | null; easting: number; northing: number };

type LaBoundary = { name: string; rings: [number, number][][] } | null;

type FreeSurroundingPoint = Point;

type MemberSurroundingSchool = {
  urn: string;
  currentName: string;
  town: string | null;
  easting: number | null;
  northing: number | null;
};

const WIDTH = 640;
const HEIGHT = 480;
const PAD = 24;

function computeProjection(points: Point[]) {
  const xs = points.map((p) => p.easting);
  const ys = points.map((p) => p.northing);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bboxW = Math.max(maxX - minX, 1);
  const bboxH = Math.max(maxY - minY, 1);
  const innerW = WIDTH - PAD * 2;
  const innerH = HEIGHT - PAD * 2;
  const scale = Math.min(innerW / bboxW, innerH / bboxH);
  const offsetX = PAD + (innerW - bboxW * scale) / 2;
  const offsetY = PAD + (innerH - bboxH * scale) / 2;
  return (p: Point) => ({
    x: offsetX + (p.easting - minX) * scale,
    y: offsetY + (maxY - p.northing) * scale, // northing increases north -- SVG y increases down
  });
}

export default function SchoolMap({
  school,
  urn,
  laBoundary,
  freeSurroundingPoints,
}: {
  school: ViewedSchool;
  urn: string;
  laBoundary: LaBoundary;
  freeSurroundingPoints: FreeSurroundingPoint[];
}) {
  const supabase = createBrowserSupabaseClient();
  const [memberSchools, setMemberSchools] = useState<MemberSurroundingSchool[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/surrounding-schools-list?urn=${urn}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setMemberSchools(body.schools ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn]);

  const allPoints: Point[] = [{ easting: school.easting, northing: school.northing }, ...freeSurroundingPoints];
  if (laBoundary) {
    for (const ring of laBoundary.rings) {
      for (const [e, n] of ring) allPoints.push({ easting: e, northing: n });
    }
  }
  const project = computeProjection(allPoints);
  const schoolXY = project({ easting: school.easting, northing: school.northing });

  // Member markers replace the plain dots once loaded/authorized -- same schools,
  // just with names attached, never a different pool.
  const showMemberMarkers = memberSchools !== null && memberSchools.length > 0;

  return (
    <div className="map-root">
      <style>{`
        .map-root {
          color-scheme: light;
          --la-fill: #e0ecff; --la-stroke: #6f9ceb; --la-label: #1e3a5f;
          --dot: #9ca3af; --school-marker: #171717; --label: #171717; --member-dot: #1e40af;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .map-root {
            color-scheme: dark;
            --la-fill: #1b2a42; --la-stroke: #5b86c9; --la-label: #93c5fd;
            --dot: #6b7280; --school-marker: #ededed; --label: #ededed; --member-dot: #93c5fd;
          }
        }
        :root[data-theme="dark"] .map-root {
          color-scheme: dark;
          --la-fill: #1b2a42; --la-stroke: #5b86c9; --la-label: #93c5fd;
          --dot: #6b7280; --school-marker: #ededed; --label: #ededed; --member-dot: #93c5fd;
        }
      `}</style>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {laBoundary &&
          laBoundary.rings.map((ring, i) => (
            <path
              key={i}
              d={ring.map(([e, n], j) => {
                const { x, y } = project({ easting: e, northing: n });
                return `${j === 0 ? "M" : "L"}${x},${y}`;
              }).join(" ") + " Z"}
              fill="var(--la-fill)"
              stroke="var(--la-stroke)"
              strokeWidth={1.5}
              fillOpacity={0.5}
            />
          ))}

        {laBoundary && (
          <text x={PAD + 4} y={PAD + 14} fontSize={11} fill="var(--la-label)" fontWeight={600}>
            {laBoundary.name}
          </text>
        )}

        {!showMemberMarkers &&
          freeSurroundingPoints.map((p, i) => {
            const { x, y } = project(p);
            return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--dot)" />;
          })}

        {showMemberMarkers &&
          memberSchools!
            .filter((s) => s.easting !== null && s.northing !== null)
            .map((s) => {
              const { x, y } = project({ easting: s.easting!, northing: s.northing! });
              return (
                <a key={s.urn} href={`/schools/${s.urn}`}>
                  <circle cx={x} cy={y} r={4.5} fill="var(--member-dot)" stroke="var(--surface-1, #fff)" strokeWidth={1} />
                  <text x={x + 7} y={y + 3} fontSize={10} fill="var(--label)">
                    {s.currentName}
                  </text>
                </a>
              );
            })}

        {/* Viewed school: distinct marker, always shown, always labelled */}
        <circle cx={schoolXY.x} cy={schoolXY.y} r={7} fill="none" stroke="var(--school-marker)" strokeWidth={2.5} />
        <circle cx={schoolXY.x} cy={schoolXY.y} r={2.5} fill="var(--school-marker)" />
        <text
          x={schoolXY.x + 11}
          y={schoolXY.y + 4}
          fontSize={12}
          fontWeight={600}
          fill="var(--label)"
        >
          {school.name}
          {school.town ? ` (${school.town})` : ""}
        </text>
      </svg>
      <p className="mt-1 text-xs text-neutral-400">
        {showMemberMarkers
          ? "Surrounding schools shown with names and location."
          : "Surrounding schools shown as unlabelled markers — verified members see names and tags."}
      </p>
    </div>
  );
}
