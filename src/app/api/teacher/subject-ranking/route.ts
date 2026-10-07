import { isPlatformAdmin } from "@/lib/view-as";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cachedReference } from "@/lib/server-cache";
import { cachedRankingPopulation } from "@/lib/chooser-sets";
import { matchesRanking, type RankingFilters } from "@/lib/comparator-chooser";
import { GRADE_SCALES } from "@/lib/subject-grades";
import { subjectRanking, type RankMeasure, type SubjectRanking } from "@/lib/subject-ranking";
import type { SubjectRankingBody, SubjectRankingPayload } from "@/lib/subject-ranking-view";

// VicData 0.6.6: a national or regional ranking on the measure in view -- the focused subject
// (the exact qualification at Post-16), points / entries / Grade 4+ / A*-E / a band or a
// Grade counts selection, one year -- across the whole filtered population
// (src/lib/subject-ranking.ts). POST, as chooser-set: the ranking's filters are the request.
//
// Computed on demand, one request at a time, and kept an hour per key (server-cache.ts: public
// data, the key holds no user). The database function answers in well under a second; until
// it is applied the app-side fallback reads that one subject's rows for the population, a few
// seconds cold. If an answer isn't ready within PENDING_AFTER_MS the route says so ({ pending:
// true }) rather than holding the column, keeps computing into the cache, and logs it; the page
// shows "Ranking will be available shortly" and asks again.
const PENDING_AFTER_MS = 8_000;

const MEASURES = new Set(["points", "entries", "threshold", "band"]);
function cleanMeasure(m: unknown): RankMeasure | null {
  if (!m || typeof m !== "object") return null;
  const x = m as Record<string, unknown>;
  if (typeof x.kind !== "string" || !MEASURES.has(x.kind)) return null;
  if (x.kind !== "band") return { kind: x.kind } as RankMeasure;
  const scale = typeof x.scaleIndex === "number" ? GRADE_SCALES[x.scaleIndex] : undefined;
  if (!scale || typeof x.top !== "string" || typeof x.bottom !== "string" || !scale.includes(x.top) || !scale.includes(x.bottom)) return null;
  return { kind: "band", scaleIndex: x.scaleIndex as number, top: x.top, bottom: x.bottom };
}

// The population's own key: its scope and filters (the same schools, whoever asks).
function populationKey(phase: string, f: RankingFilters): string {
  return JSON.stringify([
    phase,
    f.scope.kind === "region" ? f.scope.code : "england",
    [...(f.sectors ?? [])].sort(),
    f.gender ?? null,
    f.boarding ?? "any",
    [...(f.sizes ?? [])].sort(),
  ]);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const body = (await request.json().catch(() => null)) as SubjectRankingBody | null;
  const measure = cleanMeasure(body?.measure);
  if (
    !authHeader ||
    !body ||
    typeof body.urn !== "string" ||
    !/^\d{5,7}$/.test(body.urn) ||
    (body.phase !== "ks4" && body.phase !== "ks5") ||
    !body.filters?.scope ||
    typeof body.subject !== "string" ||
    !body.subject ||
    body.subject.length > 200 ||
    !measure ||
    (body.period !== null && body.period !== undefined && !Number.isInteger(body.period))
  ) {
    return NextResponse.json({ error: "urn, phase, filters, subject, measure and Authorization are required" }, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  // Same gate as every Teacher view route: approved staff of this school only.
  const { data: membership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", body.urn)
    .limit(1)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  if (!membership && !(await isPlatformAdmin(supabase))) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  const { urn, phase, filters } = body;
  const familyId = typeof body.familyId === "string" ? body.familyId : null;
  const qualificationType = typeof body.qualificationType === "string" ? body.qualificationType : null;
  const period = body.period ?? null;
  const popKey = populationKey(phase, filters);
  const key = `subject-ranking:${popKey}|${urn}|${body.subject}|${familyId ?? ""}|${qualificationType ?? ""}|${JSON.stringify(measure)}|${period ?? "latest"}`;

  const started = Date.now();
  const work = cachedReference<SubjectRankingPayload>(key, async () => {
    const population = await cachedRankingPopulation(filters.scope.kind === "region" ? filters.scope.code : null, phase, null);
    const matched = population.filter((r) => matchesRanking(r, filters));
    const ranking: SubjectRanking = await subjectRanking(
      { urns: matched.map((r) => r[0]), targetUrn: urn, phase, subject: body.subject, familyId, qualificationType, measure, period },
      popKey,
    );
    // The names (and sector) of every school the column draws.
    const wanted = new Set([...ranking.window.map((w) => w.urn), ...(ranking.change?.window ?? []).map((w) => w.urn), ...Object.keys(ranking.windowSeries)]);
    const names: SubjectRankingPayload["names"] = {};
    for (const r of population) {
      if (wanted.has(r[0])) names[r[0]] = { name: r[1], independent: r[2] === null ? null : r[2] === "Independent" };
    }
    console.info(`[subject-ranking] ${phase} ${body.subject}${qualificationType ? ` (${qualificationType})` : ""} ${JSON.stringify(measure)}: ${matched.length} schools, via the ${ranking.source}, ${Date.now() - started} ms`);
    return { ...ranking, names };
  });

  try {
    const pending = Symbol("pending");
    const out = await Promise.race([work, new Promise<typeof pending>((resolve) => setTimeout(() => resolve(pending), PENDING_AFTER_MS))]);
    if (out === pending) {
      console.warn(`[subject-ranking] not ready after ${PENDING_AFTER_MS / 1000} s; answering "available shortly" and computing on: ${key}`);
      return NextResponse.json({ pending: true });
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("[teacher/subject-ranking] failed:", err);
    return NextResponse.json({ error: "Could not rank these schools." }, { status: 502 });
  }
}
