// VicData 0.8 feedback deploy gate: the server records the build it runs as, once per process, on its first
// feedback insert or inbox load -- and in the same call (record_app_build, the service role's only) every
// fixed item whose commit this build holds moves to deployed. Server-only: the service-role key never
// leaves the server, and no client can claim a build.
import { buildInfo, type BuildInfo } from "./build-info";

type Recorder = { fetch: typeof fetch; url?: string; key?: string; log?: (m: string) => void; now?: () => number };

let done = false;
let inflight: Promise<number | null> | null = null;
let lastFailure = 0;
const RETRY_MS = 10 * 60 * 1000;

/** Call record_app_build for this build. Returns how many items moved, or null if it couldn't. */
export async function recordBuild(info: BuildInfo, r: Recorder): Promise<number | null> {
  const log = r.log ?? ((m: string) => console.log(m));
  if (!info.commit) {
    log("[app-build] no commit for this build: not recorded");
    return null;
  }
  if (!r.url || !r.key) {
    log("[app-build] no Supabase URL or service key: not recorded");
    return null;
  }
  const res = await r.fetch(`${r.url}/rest/v1/rpc/record_app_build`, {
    method: "POST",
    headers: { apikey: r.key, Authorization: `Bearer ${r.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_commit: info.commit, p_commits: info.commits, p_built_at: info.built_at }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    log(`[app-build] record_app_build failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return null;
  }
  const moved = Number(await res.json());
  log(`[app-build] build ${info.commit} recorded (${info.commits ? `${info.commits.length} commits` : "no commit list"}); ${moved} fixed item(s) moved to deployed`);
  return Number.isFinite(moved) ? moved : 0;
}

/** Once per process (retried after 10 minutes if it failed, e.g. before the migration is applied). Never throws. */
export function recordBuildOnce(): Promise<number | null> {
  if (done) return Promise.resolve(0);
  if (inflight) return inflight;
  if (lastFailure && Date.now() - lastFailure < RETRY_MS) return Promise.resolve(null);
  inflight = recordBuild(buildInfo(), { fetch, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY })
    .catch((err) => {
      console.error("[app-build] record failed:", err);
      return null;
    })
    .then((moved) => {
      if (moved === null) lastFailure = Date.now();
      else done = true;
      inflight = null;
      return moved;
    });
  return inflight;
}
