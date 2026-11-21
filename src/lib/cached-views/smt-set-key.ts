// The SMT views' set, as keyed: its kind, label and URNs, in the order given (the order can show in the answer).
import type { SmtSet } from "../smt/overview";

export const setKey = (s: SmtSet) => ({ kind: s.kind, label: s.label, urns: s.urns });
