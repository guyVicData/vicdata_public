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
};

const SHA = /^[0-9a-f]{7,64}$/;

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
