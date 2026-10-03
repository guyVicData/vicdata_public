// /platform/chooser-lab only: a SAMPLE subject list so 2a (Choose a subject) and 2b (Custom
// area) can be clicked through without a school's data. On a dashboard the editor passes
// the school's real subjects. Labelled as a sample in the lab.
import type { PickerItem } from "@/components/teacher/CategorySubjectPicker";
import { QUALIFICATION_FAMILIES } from "@/lib/teacher-view-theme";
import type { SubjectSource } from "./StepScreens";

const CAT = {
  sci: { id: "sciences_maths", label: "Sciences & Maths" },
  hum: { id: "humanities_social", label: "Humanities & Social Sciences" },
  lang: { id: "languages_literature", label: "Languages & Literature" },
  art: { id: "arts_media_design", label: "Arts, Media & Design" },
  tech: { id: "technology_eng_construction", label: "Technology, Engineering & Construction" },
  biz: { id: "business_law", label: "Business & Law" },
};

const item = (label: string, familyId: string, category: { id: string; label: string }, entries: number): PickerItem => ({ key: `${familyId}:${label}`, label, entries, familyId, category });

const KS4: PickerItem[] = [
  item("Biology", "gcse", CAT.sci, 41),
  item("Chemistry", "gcse", CAT.sci, 40),
  item("Combined Science", "gcse", CAT.sci, 112),
  item("Maths (General)", "gcse", CAT.sci, 154),
  item("Physics", "gcse", CAT.sci, 39),
  item("Statistics", "gcse", CAT.sci, 22),
  item("Geography", "gcse", CAT.hum, 61),
  item("History", "gcse", CAT.hum, 70),
  item("Religious Studies", "gcse", CAT.hum, 48),
  item("Sociology", "gcse", CAT.hum, 19),
  item("English Language", "gcse", CAT.lang, 153),
  item("English Literature", "gcse", CAT.lang, 150),
  item("French", "gcse", CAT.lang, 33),
  item("Spanish", "gcse", CAT.lang, 41),
  item("Art & Design", "gcse", CAT.art, 28),
  item("Drama", "gcse", CAT.art, 17),
  item("Music", "gcse", CAT.art, 12),
  item("Computer Science", "gcse", CAT.tech, 30),
  item("Design & Technology", "gcse", CAT.tech, 21),
  item("Business", "gcse", CAT.biz, 26),
  item("Citizenship", "gcse", CAT.hum, 14),
  item("Sport (Technical Award)", "btec_ocr", CAT.biz, 18),
  item("Creative iMedia", "btec_ocr", CAT.art, 15),
  item("Engineering Design", "btec_ocr", CAT.tech, 11),
  item("Health & Social Care", "btec_ocr", CAT.biz, 9),
];

const KS5: PickerItem[] = [
  item("Biology", "alevel", CAT.sci, 31),
  item("Chemistry", "alevel", CAT.sci, 27),
  item("Mathematics", "alevel", CAT.sci, 44),
  item("Further Mathematics", "alevel", CAT.sci, 9),
  item("Physics", "alevel", CAT.sci, 20),
  item("Economics", "alevel", CAT.hum, 25),
  item("History", "alevel", CAT.hum, 18),
  item("Psychology", "alevel", CAT.hum, 33),
  item("English Literature", "alevel", CAT.lang, 16),
  item("Art & Design", "alevel", CAT.art, 10),
  item("Business", "btec_ocr", CAT.biz, 14),
  item("Applied Science", "btec_ocr", CAT.sci, 8),
];

export const LAB_SUBJECTS: Record<"ks4" | "ks5", SubjectSource> = {
  ks4: { items: KS4, families: QUALIFICATION_FAMILIES.ks4.filter((f) => KS4.some((i) => i.familyId === f.id)), mine: ["gcse:Maths (General)", "gcse:Statistics", "gcse:Physics"] },
  ks5: { items: KS5, families: QUALIFICATION_FAMILIES.ks5.filter((f) => KS5.some((i) => i.familyId === f.id)), mine: ["alevel:Mathematics", "alevel:Physics"] },
};
