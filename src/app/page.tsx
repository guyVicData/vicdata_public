import Link from "next/link";

// The public home. Private beta (Guy, 21 Nov): the public school pages are hidden
// (next.config.ts redirects /schools/** -- R-NO-PUBLIC-SCHOOL-LINKS), so the school
// search that opened them is gone from here; SchoolSearch stays as the picker the
// walks, sets, View as and join flow use.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">VicData</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Roll data and catchment context for school leaders, governors, and
          admissions teams.
        </p>
        <p className="mt-6 text-sm text-neutral-500">
          VicData is in private beta.{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
