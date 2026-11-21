// VicData 0.8 feedback deploy gate: what this build is, from src/generated/build-info.json (written by
// scripts/write-build-info.mjs at `npm run build`; not committed). Server-only: it reads the file from disk.
// A build without the file (a local `next dev`, or one built without the script) has no list, and says so.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appVersion } from "./feedback-server";

export type BuildInfo = {
  /** The build's commit, 12 characters, or null if unknown. */
  commit: string | null;
  built_at: string | null;
  /** The build's history, 12-character shas, newest first; null when the build had none to list. */
  commits: string[] | null;
  /** A hash of the server's own code (write-build-info.mjs's server_code), or "commit:<sha>" when the
   * import walk failed; null when unknown. The results cache's code version. */
  server_code?: string | null;
  /** One code version per stored view (write-build-info.mjs's view_code: a hash of the files that view's
   * module and its routes reach); null when the walk failed or the build had no list, and then every view
   * uses server_code. */
  view_code?: Record<string, string> | null;
  /** A hash of what the boot preload (src/instrumentation.ts) runs; null when the build has none. Anything
   * else that isn't a 16-hex hash or "commit:<sha>" reads as "unknown" (its walk failed). */
  preload_code?: string | null;
};

const SHA = /^[0-9a-f]{7,64}$/;
const SERVER_CODE = /^(?:[0-9a-f]{16}|commit:[0-9a-f]{7,64})$/;
const VIEW_CODE = /^[0-9a-f]{16}$/;

/** A view_code that is a non-empty object of 16-hex versions; anything else reads as none (server_code for all). */
function parseViewCode(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (!entries.length || !entries.every(([k, v]) => k.length > 0 && !k.includes("|") && typeof v === "string" && VIEW_CODE.test(v))) return null;
  return Object.fromEntries(entries) as Record<string, string>;
}

/** Parse the file's text; anything malformed reads as "no list" rather than a wrong one. */
export function parseBuildInfo(text: string | null, env: Record<string, string | undefined> = process.env): BuildInfo {
  let raw: Record<string, unknown> = {};
  try {
    raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }
  const fromEnv = appVersion(env);
  const commit = typeof raw.commit === "string" && SHA.test(raw.commit) ? raw.commit : SHA.test(fromEnv) ? fromEnv : null;
  const commits = Array.isArray(raw.commits) && raw.commits.length && raw.commits.every((c) => typeof c === "string" && SHA.test(c)) ? (raw.commits as string[]) : null;
  return {
    commit,
    built_at: typeof raw.built_at === "string" && !Number.isNaN(Date.parse(raw.built_at)) ? raw.built_at : null,
    // A list that doesn't start at the build's own commit isn't this build's.
    commits: commits && commit && commits[0].startsWith(commit.slice(0, 7)) ? commits : null,
    server_code: typeof raw.server_code === "string" && SERVER_CODE.test(raw.server_code) ? raw.server_code : null,
    view_code: parseViewCode(raw.view_code),
    preload_code: raw.preload_code === null || raw.preload_code === undefined ? null : typeof raw.preload_code === "string" && SERVER_CODE.test(raw.preload_code) ? raw.preload_code : "unknown",
  };
}

let cached: BuildInfo | null = null;

export function buildInfo(): BuildInfo {
  if (cached) return cached;
  let text: string | null = null;
  try {
    text = readFileSync(join(process.cwd(), "src", "generated", "build-info.json"), "utf8");
  } catch {
    text = null;
  }
  cached = parseBuildInfo(text);
  return cached;
}
