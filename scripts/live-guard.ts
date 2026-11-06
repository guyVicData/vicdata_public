// VicData 0.8 feedback deploy gate: "is the local HEAD live yet?" -- read from the live site's /api/version and
// the local git history. The republish (scripts/dashboards-seed-sql.ts) refuses to run until it is, so a
// dashboard can never be republished onto code that can't draw it (0.8 Admissions feedback round 1: the
// republish went live on the old build, and its new views read "This view isn't drawn here yet").
//
// The live address comes from --live <url> or VICDATA_LIVE_URL. There is no default: a default could point
// at the wrong site.
import { execFileSync } from "node:child_process";

export type GuardResult = { ok: true; live: string; head: string } | { ok: false; reason: string };

/** The live address from the arguments or the environment; null when neither names one. */
export function liveUrlFrom(argv: string[], env: Record<string, string | undefined>): string | null {
  const i = argv.indexOf("--live");
  const raw = (i >= 0 ? argv[i + 1] : undefined) ?? env.VICDATA_LIVE_URL ?? "";
  const url = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+/.test(url) ? url : null;
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/** Does the live build hold the local HEAD (HEAD is the live commit or one of its ancestors)? */
export async function liveHoldsHead(liveUrl: string | null, opts: { cwd?: string; fetchFn?: typeof fetch } = {}): Promise<GuardResult> {
  const cwd = opts.cwd ?? process.cwd();
  if (!liveUrl) return { ok: false, reason: "No live address: pass --live https://<the live site> or set VICDATA_LIVE_URL. There is no default, so it can't check the wrong site." };
  let head: string;
  try {
    head = git(cwd, "rev-parse", "HEAD");
  } catch {
    return { ok: false, reason: "No local git HEAD to check." };
  }
  let live: string | null = null;
  try {
    const res = await (opts.fetchFn ?? fetch)(`${liveUrl}/api/version`, { signal: AbortSignal.timeout(15_000), headers: { "Cache-Control": "no-store" } });
    if (!res.ok) return { ok: false, reason: `${liveUrl}/api/version answered HTTP ${res.status}. Is the deploy live, and the address right?` };
    const body = (await res.json()) as { commit?: unknown };
    live = typeof body.commit === "string" && /^[0-9a-f]{7,64}$/i.test(body.commit) ? body.commit.toLowerCase() : null;
  } catch (e) {
    return { ok: false, reason: `Couldn't read ${liveUrl}/api/version (${(e as Error).message}).` };
  }
  if (!live) return { ok: false, reason: `${liveUrl}/api/version names no commit: the live build predates the deploy gate, or doesn't know its commit.` };
  try {
    git(cwd, "cat-file", "-e", `${live}^{commit}`);
  } catch {
    return { ok: false, reason: `The live commit ${live} isn't in this checkout: fetch first (git fetch https://github.com/guyVicData/vicdata_public.git main).` };
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", head, live], { cwd, stdio: "ignore" });
  } catch {
    return { ok: false, reason: `The live build (${live.slice(0, 12)}) doesn't hold this checkout's HEAD (${head.slice(0, 12)}). Deploy on Render and wait until ${liveUrl}/api/version shows the merge.` };
  }
  return { ok: true, live, head };
}

export const FORCE_WARNING =
  "--force: republishing without checking the live build. This is unsafe: if the live code predates HEAD, the new dashboards go live on code that can't draw them (their new views read \"This view isn't drawn here yet\") until the deploy lands.";
