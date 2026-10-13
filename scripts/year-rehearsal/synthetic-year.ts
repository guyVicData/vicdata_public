// VicData 0.7 year rules, Y3: rehearse a new year's arrival before DfE publishes it.
//
// installSyntheticYear() wraps fetch so every read of the vicdata reference API answers as if
// one more year of one key stage had been published: each row of that key stage in the year
// before (`from`) is copied into the new year (`to`), its figures nudged a few per cent (a
// fixed, per-row amount, so two runs give the same picture), and the measures DfE won't publish
// for it dropped (Progress 8 for 2025/26: that cohort sat no KS2 tests in 2021).
// academic_current_periods then says the key stage's latest is `to` (provisional when asked),
// and every other key stage stays where the data has it -- the arrival of GCSE 2025/26 with
// Post-16 still at 2024/25.
//
// The app's own code then does the rest (its routes' fetchers, server-side), so what renders
// is what the app would draw from such data: nothing here knows any view. Load it before the
// app's modules in a capture process (read-only: it only reads, and only ever adds rows):
//
//   npx -y tsx --env-file=.env --import ./scripts/year-rehearsal/install-ks4-2025.ts <capture script> ...
//
// Two database-side functions compute their answer from the stored years and can't be given a
// synthetic one (academic_subject_rank_lookup, academic_subject_grade_rollup_lookup); they
// answer "not applied" here, which sends the app to its own fallback reads (the same figures,
// computed app-side from the rows above). Next year: change `to` and `from`.

export type SyntheticYearOptions = {
  stage: "ks2" | "ks4" | "ks5";
  from: number; // the year copied (2024 = 2024/25)
  to: number; // the year added (2025 = 2025/26)
  provisional: boolean; // what academic_current_periods says about `to`
  // Measure names not published for `to` (dropped from the copies), as substrings.
  notPublished?: string[];
  // Log each rewritten call (to stderr).
  verbose?: boolean;
};

// Database-side computations that can't see a synthetic year: answered "not applied".
const COMPUTED_IN_DATABASE = new Set(["academic_subject_rank_lookup", "academic_subject_grade_rollup_lookup"]);

// Fields that identify a row or count schools, never nudged.
const KEEP = /^(period|time_period|entity_id|urn|ks_stage|subject|family_id|family_label|grouping_type|grouping_key|qualification_type|grade|breakdown|bucket|measure|period_basis|value_text|value_category|school_count|la_code|region_code)$/;

// A fixed factor in [0.97, 1.05] from a string: the same row gets the same nudge every run.
function factorOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return 0.97 + ((h >>> 0) % 1000) / 1000 * 0.08;
}

function nudge(v: number, key: string, seed: string): number {
  const f = factorOf(`${seed}|${key}`);
  const out = v * f;
  if (Number.isInteger(v)) return Math.max(0, Math.round(out));
  const capped = /percent/.test(key) ? Math.min(100, out) : out;
  return Math.round(capped * 100) / 100;
}

type Row = Record<string, unknown>;

function copyRow(r: Row, to: number, drop: string[]): Row | null {
  const breakdown = typeof r.breakdown === "string" ? r.breakdown : "";
  if (drop.some((d) => breakdown.toLowerCase().includes(d))) return null;
  const seed = JSON.stringify([r.entity_id ?? r.grouping_key ?? "", r.subject ?? "", r.family_id ?? "", r.qualification_type ?? "", r.grade ?? "", breakdown]);
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === "period" || k === "time_period") out[k] = to;
    else if (k === "measures" && v && typeof v === "object") {
      const m: Row = {};
      for (const [mk, mv] of Object.entries(v as Row)) {
        if (drop.some((d) => mk.toLowerCase().includes(d))) continue;
        m[mk] = typeof mv === "number" ? nudge(mv, mk, seed) : mv;
      }
      out[k] = m;
    } else if (typeof v === "number" && !KEEP.test(k)) out[k] = nudge(v, k, seed);
    else out[k] = v;
  }
  return out;
}

function stageOfCall(name: string, body: Row): string | null {
  if (typeof body.p_ks_stage === "string") return body.p_ks_stage;
  const src = typeof body.p_source_id === "string" ? body.p_source_id : "";
  const m = /(ks[245])/.exec(src);
  if (m) return m[1];
  return name.startsWith("academic_") ? "any" : null;
}

export function installSyntheticYear(o: SyntheticYearOptions): () => void {
  const api = process.env.VICDATA_API_URL;
  if (!api) throw new Error("VICDATA_API_URL is not set");
  const real = globalThis.fetch;
  const drop = (o.notPublished ?? []).map((d) => d.toLowerCase());
  const log = (m: string) => o.verbose && process.stderr.write(`[synthetic ${o.stage} ${o.to}] ${m}\n`);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = url.startsWith(api) ? /\/rest\/v1\/rpc\/([a-z0-9_]+)/.exec(url) : null;
    if (!m || init?.method !== "POST" || typeof init.body !== "string") return real(input, init);
    const name = m[1];

    if (COMPUTED_IN_DATABASE.has(name)) {
      log(`${name}: not applied (app-side fallback)`);
      return new Response(JSON.stringify({ code: "PGRST202", message: `synthetic year: ${name} answers not applied` }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (name === "academic_current_periods") {
      const rows = (await (await real(input, init)).json()) as Row[];
      const out = rows.map((r) => (r.ks_stage === o.stage ? { ...r, latest_period: o.to, provisional: o.provisional } : r));
      return Response.json(out);
    }

    const body = JSON.parse(init.body) as Row;
    const stage = stageOfCall(name, body);
    if (stage === null || (stage !== "any" && stage !== o.stage)) return real(input, init);

    // Does the call ask for `to`? Then read `from` too, to copy it.
    const min = typeof body.p_period_min === "number" ? body.p_period_min : null;
    const max = typeof body.p_period_max === "number" ? body.p_period_max : null;
    const one = typeof body.p_period === "number" ? body.p_period : null;
    const wantsTo = one !== null ? one === o.to : (min === null || min <= o.to) && (max === null || max >= o.to);
    if (!wantsTo) return real(input, init);
    const asked = { ...body };
    if (one !== null) asked.p_period = o.from;
    if (min !== null && min > o.from) asked.p_period_min = o.from;
    if (max !== null && max < o.from) asked.p_period_max = o.from;
    const res = await real(input, { ...init, body: JSON.stringify(asked) });
    if (!res.ok) return res;
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return Response.json(rows);
    const inRange = (p: unknown) => typeof p !== "number" || (one !== null ? p === one : (min === null || p >= min) && (max === null || p <= max));
    const isStage = (r: Row) => stage !== "any" || r.ks_stage === undefined || r.ks_stage === o.stage;
    const copies = (rows as Row[]).filter((r) => isStage(r) && (r.period ?? r.time_period) === o.from).map((r) => copyRow(r, o.to, drop)).filter((r): r is Row => r !== null);
    const kept = (rows as Row[]).filter((r) => inRange(r.period ?? r.time_period));
    log(`${name}: ${kept.length} rows + ${copies.length} copied into ${o.to}`);
    return Response.json([...kept, ...copies]);
  };
  return () => {
    globalThis.fetch = real;
  };
}
