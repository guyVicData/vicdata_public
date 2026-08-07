import SchoolSearch from "@/components/SchoolSearch";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">VicData</h1>
        <p className="mt-2 text-sm text-neutral-500">
          School roll data, decision-ready.
        </p>
      </div>
      <SchoolSearch />
    </main>
  );
}
