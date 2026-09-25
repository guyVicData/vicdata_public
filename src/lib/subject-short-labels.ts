// Teacher view, Trend & % Change redesign step 8: the ONE subject-name shortener.
//
// It replaces two identical copies of "first 4 characters + a full stop" (page.tsx's
// shortSubject and CandidatesPanels' own), which collided on real pairs -- "English
// Language"/"English Literature" both "Engl.", "Physics"/"Physical Education" both
// "Phys.", and "Combined Science" against the "Sciences & Maths average" bar, both "Scie.".
//
// In priority order:
//   1. SUBJECT_ABBREVIATIONS, the curated table (Guy, 2026-09-25) -- checked first.
//   2. A word-initial fallback for anything the table does not cover.
//   3. A collision check over whatever is shown together: if two labels still match, the
//      clashing ones are lengthened until they do not.
// At Post-16 a subject offered under more than one qualification bucket is suffixed with
// the bucket (KS5_BUCKET_SUFFIX) -- "Bio (AL)" / "Bio (IB)".
import type { Ks5Bucket } from "./dfe-qualification-buckets";

// First pass, drafted 2026-09-25 -- standard UK subject-teacher shorthand. Kept exactly as
// supplied; SUBJECT_ABBREVIATION_ALIASES below maps the real stored subject names onto it.
export const SUBJECT_ABBREVIATIONS: Record<string, string> = {
  "English Language": "Eng Lang",
  "English Literature": "Eng Lit",
  "Mathematics": "Maths",
  "Further Mathematics": "Fur Maths",
  "Combined Science": "Comb Sci",
  "Biology": "Bio",
  "Chemistry": "Chem",
  "Physics": "Phys",
  "Additional Science": "Add Sci",
  "Computer Science": "Comp Sci",
  "Statistics": "Stats",
  "History": "History",
  "Geography": "Geog",
  "Religious Studies": "RS",
  "Citizenship Studies": "Citizenship",
  "Philosophy": "Philosophy",
  "Sociology": "Sociol",
  "Psychology": "Psych",
  "Economics": "Econ",
  "Government and Politics": "Gov & Pol",
  "Law": "Law",
  "Classical Civilisation": "Classics",
  "French": "French",
  "German": "German",
  "Spanish": "Spanish",
  "Italian": "Italian",
  "Mandarin Chinese": "Mandarin",
  "Latin": "Latin",
  "Ancient Greek": "Anc Greek",
  "Welsh": "Welsh",
  "Urdu": "Urdu",
  "Polish": "Polish",
  "Arabic": "Arabic",
  "Art and Design": "Art",
  "Photography": "Photog",
  "Music": "Music",
  "Music Technology": "Music Tech",
  "Drama": "Drama",
  "Dance": "Dance",
  "Media Studies": "Media",
  "Film Studies": "Film",
  "Design and Technology": "D&T",
  "Product Design": "Prod Design",
  "Food Preparation and Nutrition": "Food Prep",
  "Textiles": "Textiles",
  "Engineering": "Engineering",
  "Information and Communication Technology": "ICT",
  "Business Studies": "Business",
  "Health and Social Care": "H&SC",
  "Construction": "Construction",
  "Hospitality and Catering": "Hosp & Catering",
  "Travel and Tourism": "Travel & Tourism",
  "Physical Education": "PE",
  "General Studies": "Gen Studies",
  "Critical Thinking": "Crit Thinking",
  "Extended Project Qualification": "EPQ",
  "Core Maths": "Core Maths",
};

// The real subject names as stored (academic_subject_rollup, 2024/25, checked 2026-09-25),
// where they differ from a table key for the SAME subject. Most of the table's keys are
// the qualification's marketing name; DfE's subject list spells many of them differently
// ("Maths (General)", "Science Double Award", "D & T"). Only same-subject matches are
// aliased -- a DfE name that is a different subject (e.g. "Food Technology" is not "Food
// Preparation and Nutrition") is left to the fallback rather than mislabelled.
export const SUBJECT_ABBREVIATION_ALIASES: Record<string, string> = {
  "Maths (General)": "Mathematics",
  "Maths (Further)": "Further Mathematics",
  "Mathematics (Further)": "Further Mathematics",
  "Mathematics (Statistics)": "Statistics",
  "Science Double Award": "Combined Science",
  "Chemistry (General)": "Chemistry",
  "Physics (General)": "Physics",
  "Psychology (General)": "Psychology",
  "Art & Design": "Art and Design",
  "French Language": "French",
  "Music Studies (General)": "Music",
  "Music Technology (Electronic)": "Music Technology",
  "Speech & Drama": "Drama",
  "Speech and Drama": "Drama",
  "Drama and Theatre Studies": "Drama",
  "Dance: General": "Dance",
  "D & T": "Design and Technology",
  "D & T Product Design": "Product Design",
  "Design and Technology (Product Design)": "Product Design",
  "Hospitality / Catering Studies": "Hospitality and Catering",
  "Engineering Studies": "Engineering",
  "Government / Politics Studies": "Government and Politics",
  "Law / Legal Studies": "Law",
  "Media / Film / TV Studies": "Media Studies",
  "Physical Education / Sports Studies": "Physical Education",
  "Greek (Classic)": "Ancient Greek",
  "Classical Greek": "Ancient Greek",
  // Deliberately NOT aliased: DfE's "Chinese" to "Mandarin Chinese" -- a Chinese GCSE is not
  // necessarily Mandarin, so it keeps its own name through the fallback.
};

// Bucket suffix, appended after the subject abbreviation for KS5 -- e.g. "Bio (AL)"
// vs "Bio (IB)" -- matching dfe-qualification-buckets.ts's real KS5_BUCKETS/KS5_BUCKET_LABEL.
export const KS5_BUCKET_SUFFIX: Record<Ks5Bucket, string> = {
  alevel: "AL",
  ib: "IB",
  btec_ocr: "BTEC",
  tlevel: "TL",
  other: "Oth",
};

const STOP_WORDS = new Set(["and", "&", "the", "of", "/", "-", ":"]);

// The fallback: the significant words (parentheticals dropped), each kept whole when short
// and cut to four letters otherwise, at most two of them -- "Sports Studies" -> "Sports
// Stud", "Computer Appreciation / Introduction" -> "Comp Appr".
function fallback(subject: string): string {
  const words = subject
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s/:-]+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return subject;
  if (words.length === 1) return words[0].length <= 9 ? words[0] : `${words[0].slice(0, 6)}.`;
  return words
    .slice(0, 2)
    .map((w) => (w.length <= 6 ? w : w.slice(0, 4)))
    .join(" ");
}

export function shortSubject(subject: string): string {
  const key = SUBJECT_ABBREVIATION_ALIASES[subject] ?? subject;
  return SUBJECT_ABBREVIATIONS[key] ?? fallback(subject);
}

// Short labels for everything shown TOGETHER, so the collision check can see them all.
// `bucket` is the KS5 qualification bucket (null at GCSE).
// `detail` is a last resort for two items with the SAME subject name (a GCSE and a BTEC in
// one subject), which no amount of lengthening the name can tell apart.
export function shortSubjectLabels(
  items: { key: string; subject: string; bucket?: Ks5Bucket | string | null; detail?: string }[],
): Map<string, string> {
  const bucketsBySubject = new Map<string, Set<string>>();
  for (const it of items) {
    if (!it.bucket) continue;
    const set = bucketsBySubject.get(it.subject) ?? new Set<string>();
    set.add(it.bucket);
    bucketsBySubject.set(it.subject, set);
  }
  const base = (it: (typeof items)[number]) => {
    const short = shortSubject(it.subject);
    const multi = it.bucket && (bucketsBySubject.get(it.subject)?.size ?? 0) > 1;
    return multi ? `${short} (${KS5_BUCKET_SUFFIX[it.bucket as Ks5Bucket] ?? it.bucket})` : short;
  };
  const out = new Map(items.map((it) => [it.key, base(it)]));

  const clashes = () => {
    const groups = new Map<string, string[]>();
    for (const [k, v] of out) groups.set(v, [...(groups.get(v) ?? []), k]);
    return Array.from(groups.values()).filter((ks) => ks.length > 1);
  };
  const withSuffix = (it: (typeof items)[number], label: string) => {
    const multi = it.bucket && (bucketsBySubject.get(it.subject)?.size ?? 0) > 1;
    return multi ? `${label} (${KS5_BUCKET_SUFFIX[it.bucket as Ks5Bucket] ?? it.bucket})` : label;
  };
  // Collision safety net. First the word-based form, which keeps two words rather than a
  // table's single abbreviation ("Speech Drama" / "Drama Thea" where the table made both
  // "Drama"); then, if they still match, more of the real name each pass, cut at a word
  // edge where possible. Bounded by the longest name, so it always ends.
  for (const ks of clashes()) {
    for (const k of ks) {
      const it = items.find((i) => i.key === k)!;
      out.set(k, withSuffix(it, fallback(it.subject)));
    }
  }
  for (let len = 8; len <= 60 && clashes().length; len += 2) {
    for (const ks of clashes()) {
      for (const k of ks) {
        const it = items.find((i) => i.key === k)!;
        const cut = it.subject.length <= len ? it.subject : `${it.subject.slice(0, len).trimEnd()}.`;
        out.set(k, withSuffix(it, cut));
      }
    }
  }
  for (const ks of clashes()) {
    for (const k of ks) {
      const it = items.find((i) => i.key === k)!;
      if (it.detail) out.set(k, `${out.get(k)} (${it.detail})`);
    }
  }
  return out;
}
