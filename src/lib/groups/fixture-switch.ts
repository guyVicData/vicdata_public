// VicData 0.8 groups r2: the test-and-preview switch for the group lookups. Until the ingest's group
// aggregates are promoted, tests, parity harnesses and screenshot runs read the dry run's fixtures
// (docs/v0.8/groups_fixtures, from ~/dev/vicdata docs/group_aggregates_fixtures) instead of production.
//
// Guarded like the testing routes (api/testing/preview-session): it fails closed. It is on only when
// every condition holds -- never in a production build (NODE_ENV "production", which `next build` /
// `next start` and Render always set), never on Render, and only with the flag set to exactly "true"
// and a fixtures directory named. Anything else reads production. Pure, so the test can prove it.

export type FixtureEnv = Partial<Record<"NODE_ENV" | "RENDER" | "VICDATA_GROUP_FIXTURES" | "VICDATA_GROUP_FIXTURES_DIR", string | undefined>>;

/** The fixtures directory when the switch is on, else null (read production). */
export function groupFixturesDir(env: FixtureEnv): string | null {
  if (env.NODE_ENV === "production") return null;
  if (env.RENDER) return null;
  if (env.VICDATA_GROUP_FIXTURES !== "true") return null;
  const dir = env.VICDATA_GROUP_FIXTURES_DIR?.trim();
  return dir ? dir : null;
}
