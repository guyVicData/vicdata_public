import Link from "next/link";
import TypologyTags from "./TypologyTags";
import type { SchoolTypology } from "@/lib/typology";

// Group-page constituent-school list (sixth-form consortium build): same row shape
// as SurroundingSchoolsMemberList.tsx (name, town/postcode, total roll, TypologyTags)
// but deliberately NOT that component -- this renders server-side with no membership
// gate and no client fetch. A consortium group page's own member list isn't the
// member-tier "verification" feature that component exists for; it's the group
// page's entire reason to exist, so it has to be visible to every visitor, always.
export type ConsortiumListedSchool = {
  urn: string;
  currentName: string;
  town: string | null;
  postcode: string | null;
  totalRoll: number | null;
  typology: SchoolTypology;
};

export default function ConsortiumMemberList({ schools }: { schools: ConsortiumListedSchool[] }) {
  if (schools.length === 0) return null;

  return (
    <ul className="space-y-2.5">
      {schools.map((s) => (
        <li key={s.urn}>
          <Link
            href={`/schools/${s.urn}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3.5 text-sm transition-colors hover:border-stone-300 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700 dark:hover:bg-stone-800/60"
          >
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100">{s.currentName}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {[s.town, s.postcode].filter(Boolean).join(", ")}
                {s.totalRoll !== null ? ` — ${s.totalRoll.toLocaleString()} pupils` : ""}
              </p>
            </div>
            <TypologyTags typology={s.typology} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
