"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { AdminSchool } from "./AdminChrome";

// 0.8 front door part 3 (E25, R-JOIN-DOMAIN): the school's own email domains, on People above Join requests. A request
// from an address on one of them (or a subdomain) is ordinary; anyone else's is an exception the School-Admin
// approves or declines explicitly. The first School-Admin's domain seeded the list; the School-Admin adds and
// removes domains here (a trust's domain, a second campus). Personal mail domains can't be added. Reads and
// writes school_email_domains with the admin's own session, so RLS decides. Hidden in View as (read-only) and
// before the migration.
type Domain = { id: string; domain: string };
const CLEAN = (v: string) => v.trim().toLowerCase().replace(/^.*@/, "").replace(/^www\./, "");

export function JoinDomains({ school, readOnly }: { school: AdminSchool; readOnly: boolean }) {
  const supabase = createBrowserSupabaseClient();
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("school_email_domains").select("id, domain").eq("school_account_id", school.schoolAccountId).order("domain");
    setDomains(e ? null : ((data as Domain[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.schoolAccountId]);
  useEffect(() => {
    if (readOnly) return;
    (async () => {
      await load();
    })();
  }, [load, readOnly]);

  if (readOnly || domains === null) return null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const domain = CLEAN(adding);
    if (!domain) return;
    setError(null);
    const { error: err } = await supabase.from("school_email_domains").insert({ school_account_id: school.schoolAccountId, domain, added_by: school.userId });
    if (err) return setError(/check constraint|violates/i.test(err.message) ? `${domain} can't be a school's domain (a personal mail domain, or not a domain).` : /duplicate/i.test(err.message) ? `${domain} is already on the list.` : err.message);
    setAdding("");
    await load();
  }
  async function remove(d: Domain) {
    setError(null);
    const { error: err } = await supabase.from("school_email_domains").delete().eq("id", d.id);
    if (err) return setError(err.message);
    await load();
  }

  return (
    <section data-join-domains="" className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3.5 py-3">
      <div className="text-[13px] font-bold">Who can join</div>
      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
        {domains.length
          ? "Addresses on these domains ask to join as usual. Anyone else is an exception: you approve or decline them yourself."
          : "No school email domain yet, so every request is an exception. Add your school's domain."}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {domains.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--edge-strong)] py-0.5 pl-2.5 pr-1 text-[12px]">
            {d.domain}
            <button type="button" onClick={() => remove(d)} aria-label={`Remove ${d.domain}`} className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--fg)]">
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a domain, e.g. school.org.uk" aria-label="Add a school email domain" className="min-h-9 min-w-0 flex-grow rounded-lg border border-[var(--edge-strong)] bg-transparent px-2.5 text-[13px]" />
        <button type="submit" className="rounded-full border border-[var(--edge-strong)] px-3 text-[12px] font-semibold">Add</button>
      </form>
      {error && <p role="alert" className="mt-1.5 text-[12px] text-red-500">{error}</p>}
    </section>
  );
}
