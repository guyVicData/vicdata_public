// Subject latest names round (vicdata docs/vicdata_subject_latest_names_report_v1.md,
// 2026-10-15): every GCSE subject shows under the name DfE uses in its latest release, for
// every year -- "Maths (General)" is "Mathematics" back to 2020/21.
//
// The ingest database keeps each subject under the label it was stored with and holds the map
// (subject_label_map, vicdata migration 20261015120000_subject_latest_names.sql); its rollups
// are rebuilt under the latest names. This is the same map, as a constant: saved choices are
// read in places that cannot reach the ingest database, and these names never change once
// DfE has moved on. A future rename adds a row both there and here (vicdata's
// check_subject_latest_names.py compares the two).
//
// Every subject the app reads goes through here: the raw facts and rollup rows
// (vicdata-reference.ts), saved choices (Teacher's ticked subjects and pinned views, dashboard
// and meeting configs, dashboard state, recruitment subjects) and links. None of the old names
// is a KS5 subject (checked against every KS5 label, 2026-10-15), so a stage-blind swap is safe.
//
// One rename depends on the qualification: in 2025/26 DfE gave the BTEC / vocational
// Construction subject the name the small VRQ subject had until 2024/25, "Construction and the
// Built Environment", and renamed the VRQ one. Stored, both sit under that name; only VRQ Level
// 2 rows are the VRQ subject. Where no qualification is known (a saved choice, a link), the
// name stays the BTEC subject's, which is what nearly every school means by it.

export const CONSTRUCTION_VRQ = { stored: "Construction and the Built Environment", qualification: "VRQ Level 2", latest: "Constructing and Maintaining the Built Environment" } as const;

// Stored label -> latest name, for every qualification. KS4.
export const SUBJECT_LATEST_NAMES: Readonly<Record<string, string>> = {
  "Additional Maths (FSMQ)": "Mathematics (Additional)",
  "Art & Design": "Art and Design",
  "Business/Finance": "Business / Finance",
  "Chemistry (General)": "Chemistry",
  "Computer Appreciation / Introduction": "Computer Appreciation (Introduction)",
  "Computer Appreciation/Introduction": "Computer Appreciation (Introduction)",
  "Construction and the Built Environment (Construction)": "Construction and the Built Environment",
  "D & T": "Design and Technology",
  "D & T Product Design": "Design and Technology (Product Design)",
  "Dance: General": "Dance",
  "Electronics (Physics)": "Electronics",
  "Food Science/Technology": "Food Science / Technology",
  "French Language": "French",
  "Government / Politics Studies": "Government and Politics",
  "Government/Politics Studies": "Government and Politics",
  "Greek": "Modern Greek",
  "Greek (Classic)": "Classical Greek",
  "Hebrew Language": "Modern Hebrew",
  "Hospitality / Catering Studies": "Hospitality and Catering",
  "Hospitality/Catering Studies": "Hospitality and Catering",
  "Japanese Language": "Japanese",
  "Land based Studies": "Land Based Studies",
  "Maths (General)": "Mathematics",
  "Music Performance: Group": "Music Performance (Group)",
  "Music Studies (General)": "Music Studies",
  "Persian Language": "Persian",
  "Physics (General)": "Physics",
  "Psychology (General)": "Psychology",
  "Science Double Award": "Combined Science",
  "Speech & Drama": "Speech and Drama",
  "Tourism": "Travel and Tourism",
};

// A subject's latest name. `qualification` (DfE's qualification_detailed) only matters for the
// Construction pair above; without it the name is read as the BTEC subject's.
export function latestSubjectName(subject: string, qualification?: string | null): string {
  if (qualification === CONSTRUCTION_VRQ.qualification && subject === CONSTRUCTION_VRQ.stored) return CONSTRUCTION_VRQ.latest;
  return SUBJECT_LATEST_NAMES[subject] ?? subject;
}

export function latestSubjectNameOrNull<T extends string | null | undefined>(subject: T): T {
  return (typeof subject === "string" ? latestSubjectName(subject) : subject) as T;
}

// Every name a subject has had, latest first: what a request in either name must match while
// a table may still hold the old one.
export function subjectNameVariants(subject: string): string[] {
  const latest = latestSubjectName(subject);
  const olds = Object.keys(SUBJECT_LATEST_NAMES).filter((old) => SUBJECT_LATEST_NAMES[old] === latest);
  return [latest, ...olds.filter((o) => o !== latest)];
}

// A raw subject fact's breakdown, "{qualification}::{subject}::...", with the subject segment
// read as its latest name. Any other shape is returned as it is.
export function latestBreakdown(breakdown: string): string {
  const parts = breakdown.split("::");
  if (parts.length < 3) return breakdown;
  const latest = latestSubjectName(parts[1], parts[0]);
  if (latest === parts[1]) return breakdown;
  parts[1] = latest;
  return parts.join("::");
}

// A saved key or id with old names in it: the whole string, or any segment between "|" and
// "::" (Teacher's "{subject}::{qualificationType}" keys, its view ids
// "{column}|{axis}|{subject}::{qual}|{now|trend}", meeting view ids, chart keys).
export function latestNamesInKey(key: string): string {
  if (SUBJECT_LATEST_NAMES[key]) return SUBJECT_LATEST_NAMES[key];
  if (!key.includes("|") && !key.includes("::")) return key;
  return key
    .split("|")
    .map((part) => part.split("::").map((seg) => SUBJECT_LATEST_NAMES[seg] ?? seg).join("::"))
    .join("|");
}

// A saved config or state, walked: every string value and every object key read through
// latestNamesInKey. Returns the same object when nothing changes, so callers can tell.
export function latestNamesInSaved<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return latestNamesInKey(v);
    if (Array.isArray(v)) {
      let changed = false;
      const out = v.map((x) => {
        const y = walk(x);
        if (y !== x) changed = true;
        return y;
      });
      return changed ? out : v;
    }
    if (v && typeof v === "object") {
      let changed = false;
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const k2 = latestNamesInKey(k);
        const y = walk(x);
        if (k2 !== k || y !== x) changed = true;
        out[k2] = y;
      }
      return changed ? out : v;
    }
    return v;
  };
  return walk(value) as T;
}
