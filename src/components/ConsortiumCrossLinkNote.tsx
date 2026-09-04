import Link from "next/link";

// Constituent-school cross-link (sixth-form consortium build, item 3): a small note
// near the roll card on a school's own page pointing to the consortium it delivers
// sixth-form provision through -- not a full new dashboard Card, just a compact
// strip. Rendered once per real consortium_members row naming this URN as a member
// (almost always exactly one in practice, but page.tsx maps over every match rather
// than assuming that).
export default function ConsortiumCrossLinkNote({ groupName, groupUrn }: { groupName: string; groupUrn: string }) {
  return (
    <div className="col-span-12 -mt-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-600 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-400">
      Sixth-form provision at this school is delivered jointly through{" "}
      <Link href={`/schools/${groupUrn}`} className="font-medium text-stone-800 underline hover:text-stone-950 dark:text-stone-200 dark:hover:text-white">
        {groupName}
      </Link>
      .
    </div>
  );
}
