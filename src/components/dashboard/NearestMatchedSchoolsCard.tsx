import { Card, Eyebrow, Caption } from "./Card";
import SurroundingRollBarChart from "@/components/SurroundingRollBarChart";
import SurroundingSchoolsMemberList from "@/components/SurroundingSchoolsMemberList";

// Extracted out of ShapeCard's own right-hand column (2026-09-25, Guy's own live
// layout call) into its own card, now sitting where BoardingCard used to (BoardingCard
// itself moved up alongside GenderSplitCard). The "combined shape of these local
// schools is X" icon+caption block that used to sit here is dropped entirely, not
// carried over -- Guy's own call: a pooled average across ten different schools'
// shapes doesn't mean anything on its own, unlike the per-school comparison
// (summary/bar chart/member list) which stays.
export function NearestMatchedSchoolsCard({
  urn,
  schoolName,
  schoolRoll,
  peerRolls,
  summary,
  found,
}: {
  urn: string;
  schoolName: string;
  schoolRoll: number;
  peerRolls: number[];
  summary: string | null;
  found: number;
}) {
  return (
    <Card size="full">
      <Eyebrow>Nearest matched schools</Eyebrow>
      {found > 0 && summary ? (
        <>
          <p className="text-[13.5px] leading-relaxed text-stone-700 dark:text-stone-300">{summary}</p>
          <SurroundingRollBarChart focusName={schoolName} focusRoll={schoolRoll} peerRolls={peerRolls} />
          <Caption className="mt-2.5">The {found} schools behind this comparison are visible to verified members.</Caption>
          <SurroundingSchoolsMemberList urn={urn} />
        </>
      ) : (
        <Caption className="mt-2">Not enough nearby comparable schools with roll data to show this yet.</Caption>
      )}
    </Card>
  );
}
