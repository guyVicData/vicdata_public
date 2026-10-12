// VicData 0.7 admissions r3 (F2): what counts as a boarding school -- GIAS's boarders field
// (schools.boarders_name, the field the public school page reads), when the school has any
// boarding provision: "Boarding school". "No boarders" and "Not applicable" (393 open state
// schools carry it, none of them boarding) are day schools, as is a school with no value.
// Client-safe: the Admissions page, setup and the routes all decide by this one test, so a day
// school never has to think about boarders and a boarding school always can
// (R-ADM-BOARDING-ONLY-WHERE-BOARDERS).
export const BOARDING_SCHOOL_VALUE = "Boarding school";

export function isBoardingSchool(boardersName: string | null | undefined): boolean {
  return boardersName === BOARDING_SCHOOL_VALUE;
}
