import Link from "next/link";
import ConsortiumMap, { type ConsortiumMapMember } from "./ConsortiumMap";
import ConsortiumMemberList, { type ConsortiumListedSchool } from "./ConsortiumMemberList";

// Group-page template (sixth-form consortium build): the page a consortium sixth-
// form-centre URN (e.g. LaSWAP, 132838) gets INSTEAD of the FE-college template --
// these 14 institutions hold none of the roll/census/ILR/shape/gender data that
// template is built around (confirmed live, every round this feature's been
// touched), because their real activity lives on the constituent schools listed
// here instead. No roll card, no narrative, no charts for the group URN itself by
// design -- there's nothing real to chart.
export default function ConsortiumGroupPage({
  groupName,
  laName,
  members,
  mapMembers,
  syncedAt,
}: {
  groupName: string;
  laName: string | null;
  members: ConsortiumListedSchool[];
  mapMembers: ConsortiumMapMember[];
  syncedAt: string | null;
}) {
  const dateLabel = syncedAt
    ? new Date(syncedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16" style={{ fontFamily: "var(--font-plex-sans)" }}>
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] font-semibold text-stone-900 dark:text-stone-100">
          {groupName}
        </h1>
        <p className="mt-1 text-[14px] text-stone-500 dark:text-stone-400">
          Sixth-form consortium of {members.length} school{members.length === 1 ? "" : "s"}
          {laName ? ` — ${laName}` : ""}
        </p>
      </header>

      {mapMembers.length > 0 && (
        <div className="mb-8">
          <ConsortiumMap members={mapMembers} />
        </div>
      )}

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-newsreader)] text-[19px] font-medium text-stone-900 dark:text-stone-100">
          Constituent schools
        </h2>
        <ConsortiumMemberList schools={members} />
      </section>

      <p className="mt-8 text-[12.5px] italic leading-relaxed text-stone-500 dark:text-stone-400">
        Sixth-form provision at {groupName} is delivered jointly through the schools above. Source:{" "}
        <Link href="/sources" className="underline hover:text-stone-700 dark:hover:text-stone-300">
          GIAS establishment links data
        </Link>
        {dateLabel ? `, synced ${dateLabel}.` : "."}
      </p>
    </main>
  );
}
