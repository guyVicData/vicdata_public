"use client";

import { useRouter } from "next/navigation";
import SchoolSearch from "@/components/SchoolSearch";

export default function JoinPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Join your school</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Find your school to sign up or request to join.
        </p>
      </div>
      <SchoolSearch
        placeholder="Search for your school"
        onSelect={(school) => router.push(`/join/${school.urn}`)}
      />
    </main>
  );
}
