"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type SearchResult = {
  urn: string;
  current_name: string;
  town: string | null;
  postcode: string | null;
  establishment_type_group: string | null;
  phase: string | null;
  boarding_establishment: string | null;
};

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

function describeSchool(r: SearchResult): string {
  const parts = [r.town, r.postcode].filter(Boolean);
  const boards = r.boarding_establishment === "Has boarders" ? "boarding" : null;
  const tag = [r.establishment_type_group, boards].filter(Boolean).join(" · ");
  return [parts.join(", "), tag].filter(Boolean).join(" — ");
}

export default function SchoolSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const supabase = useRef(createBrowserSupabaseClient()).current;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_schools", {
        p_query: query.trim(),
        p_limit: 20,
      });
      setLoading(false);
      if (!error && data) {
        setResults(data as SearchResult[]);
        setOpen(true);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, supabase]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search for a school by name, town, or postcode"
        className="w-full rounded-md border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        aria-label="Search for a school"
      />

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {loading && (
            <div className="px-4 py-3 text-sm text-neutral-500">Searching…</div>
          )}

          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-neutral-500">
              No schools found for &ldquo;{query.trim()}&rdquo;.
            </div>
          )}

          {!loading &&
            results.map((r) => (
              <button
                key={r.urn}
                type="button"
                className="block w-full border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                onClick={() => {
                  setOpen(false);
                  router.push(`/schools/${r.urn}`);
                }}
              >
                <div className="font-medium">{r.current_name}</div>
                <div className="text-sm text-neutral-500">{describeSchool(r)}</div>
              </button>
            ))}

          {!loading && (
            <button
              type="button"
              className="block w-full px-4 py-3 text-left text-sm text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              onClick={() => {
                setShowFallback(true);
                setOpen(false);
              }}
            >
              Can&rsquo;t find your school?
            </button>
          )}
        </div>
      )}

      {showFallback && (
        <ManualSchoolRequestForm
          initialName={query}
          onDone={() => setShowFallback(false)}
        />
      )}
    </div>
  );
}

function ManualSchoolRequestForm({
  initialName,
  onDone,
}: {
  initialName: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [town, setTown] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const supabase = useRef(createBrowserSupabaseClient()).current;

  if (submitted) {
    return (
      <div className="mt-3 rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        Thanks — we&rsquo;ve logged your school and will follow up.
        <button type="button" className="ml-2 underline" onClick={onDone}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-3 space-y-2 rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        await supabase.from("pending_school_requests").insert({
          school_name: name,
          town: town || null,
          postcode: postcode || null,
          notes: notes || null,
        });
        setSubmitting(false);
        setSubmitted(true);
      }}
    >
      <p className="text-sm text-neutral-500">
        Tell us the school and we&rsquo;ll add it.
      </p>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="School name"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        value={town}
        onChange={(e) => setTown(e.target.value)}
        placeholder="Town (optional)"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        value={postcode}
        onChange={(e) => setPostcode(e.target.value)}
        placeholder="Postcode (optional)"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button type="button" className="text-sm underline" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
