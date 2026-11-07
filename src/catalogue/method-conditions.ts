// VicData 0.8 Sets round 1 (F24): the parts of a view's method -- its (i) -- that hold only for some
// schools. A method string (a note, a source, a step, a left-out line) may carry
//
//   {?flag}text{/flag}   kept unless the host says the flag is off;
//   {!flag}text{/flag}   kept only when the host says the flag is off (the wording for the other schools).
//
// The host says so through the method's vars (MethodNote's `vars`): 0, "0", "" or "no" is off, any
// other value is on, and no value (null / undefined, as in the catalogue docs and a host that doesn't
// know) keeps the {?…} text and drops the {!…} text, so the full wording is never lost. An item left
// empty is dropped. The one flag so far is `boarding`: the school has boarders (GIAS, isBoardingSchool),
// so a day school's (i) never mentions boarding (R-ADM-BOARDING-ONLY-WHERE-BOARDERS). Pure, no imports
// (methods-admissions.ts and methods-smt.ts import it without a cycle through methods.ts).

type Vars = Record<string, string | number | null | undefined>;

/** `s` only where `flag` holds (a whole item, or a part of one). */
export const onlyIf = (flag: string, s: string) => `{?${flag}}${s}{/${flag}}`;
/** `s` only where the host says `flag` doesn't hold. */
export const unless = (flag: string, s: string) => `{!${flag}}${s}{/${flag}}`;
/** `yes` where `flag` holds, else `no`. */
export const either = (flag: string, yes: string, no: string) => onlyIf(flag, yes) + unless(flag, no);

const COND = /\{([?!])(\w+)\}([\s\S]*?)\{\/\2\}/g;

/** The host's answer for a flag: true, false, or null (not said). */
export function flagOf(vars: Vars, flag: string): boolean | null {
  const v = vars[flag];
  if (v === null || v === undefined) return null;
  return !(v === 0 || v === "0" || v === "" || v === "no");
}

/** One string with its conditional parts kept or dropped. */
export function applyConditions(s: string, vars: Vars): string {
  return s.replace(COND, (_, sign: string, flag: string, text: string) => {
    const on = flagOf(vars, flag);
    const keep = sign === "?" ? on !== false : on === false;
    return keep ? text : "";
  });
}

/** A list of method strings with their conditional parts applied; an item left empty is dropped. */
export function applyConditionsAll(items: string[], vars: Vars): string[] {
  return items.map((s) => applyConditions(s, vars)).filter((s) => s.trim().length > 0);
}
