// VicData 0.8 SMT round 3 (R-SMT-YEARS): rehearse ONS publishing one more mid-year of LSOA estimates.
// Preload into a capture process:
//   npx -y tsx --env-file=.env --import ./scripts/year-rehearsal/install-lsoa-next.ts <script> ...
//
// Wraps fetch so the ingest's small-area lookups answer as if the next mid-year were held:
// school_context_lookup gains a row for (latest + 1), a copy of the latest with each age nudged a few
// per cent (fixed per row, so two runs agree), and lsoa_context_lookup answers a request for that year
// with the latest year's rows relabelled. 0.8 SMT r4: area_context (any radius) gains the same year in
// `years`, and its lsoa_year moves on. Nothing else changes. The app's code does the rest, so Context
// should move to the new year with no code change. Read-only.

const factorOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return 0.97 + (((h >>> 0) % 1000) / 1000) * 0.08;
};

type Row = Record<string, unknown> & { year: number; children?: number[] };

export function installLsoaNext(): () => void {
  const api = process.env.VICDATA_API_URL;
  if (!api) throw new Error("VICDATA_API_URL is not set");
  const real = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = url.startsWith(api) ? /\/rest\/v1\/rpc\/(school_context_lookup|lsoa_context_lookup|area_context)\b/.exec(url) : null;
    if (!m || typeof init?.body !== "string") return real(input, init);
    if (m[1] === "area_context") {
      const j = (await (await real(input, init)).json()) as { urn: string; lsoa_year: number | null; years: { year: number; children: (number | null)[] }[] } | null;
      if (!j || !j.years.length) return Response.json(j);
      const last = j.years[j.years.length - 1];
      const next = { year: last.year + 1, children: last.children.map((v, a) => (v === null ? null : Math.round(v * factorOf(`${j.urn}|${a}`)))) };
      return Response.json({ ...j, lsoa_year: next.year, years: [...j.years, next] });
    }
    if (m[1] === "school_context_lookup") {
      const rows = (await (await real(input, init)).json()) as Row[];
      const byUrn = new Map<string, Row>();
      for (const r of rows) if (!byUrn.has(String(r.urn)) || (byUrn.get(String(r.urn))!.year as number) < r.year) byUrn.set(String(r.urn), r);
      const added = [...byUrn.values()].map((r) => ({ ...r, year: r.year + 1, children: (r.children ?? []).map((v, a) => Math.round(v * factorOf(`${r.urn}|${a}`))) }));
      return Response.json([...rows, ...added]);
    }
    const body = JSON.parse(init.body) as { p_lsoas: string[]; p_year: number };
    // A year the ingest doesn't hold yet answers with the year below's rows, relabelled.
    const probe = async (y: number) => (await (await real(input, { ...init, body: JSON.stringify({ ...body, p_year: y }) })).json()) as Row[];
    const direct = await probe(body.p_year);
    if (direct.length) return Response.json(direct);
    const prev = await probe(body.p_year - 1);
    return Response.json(prev.map((r) => ({ ...r, year: body.p_year, children: (r.children ?? []).map((v, a) => Math.round(v * factorOf(`${r.lsoa21_code}|${a}`))) })));
  };
  return () => {
    globalThis.fetch = real;
  };
}

installLsoaNext();
