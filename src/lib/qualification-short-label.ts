// Trims the DfE band/grade-structure suffix off a qualification label so a
// disambiguating row label stays readable: "BTEC National Foundation Diploma L3 -
// Band H - P-D*" becomes "BTEC National Foundation Diploma L3". Purely cosmetic.
//
// A plain module, not the "use client" SubjectAreaSection it used to live in: server code
// (the Teacher home's model, via teacher-view-theme's qualificationShortLabel) calls it too,
// and a production build refuses a server call into a client module ("Attempted to call
// shortQualificationLabel() from the server"), which failed every GCSE Teacher home whose
// school offers a qualification other than GCSE, Double Award, Cambridge National or BTEC.
export function shortQualificationLabel(qualificationType: string): string {
  return qualificationType.split(" - Band ")[0].replace(/\s*\(any AO and grade structure\)/i, "").trim();
}
