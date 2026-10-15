// VicData 0.8 SMT r3 snags (R-SMT-CONTEXT-GEOGRAPHY): Context's map as it is before K0's migration --
// now that production holds lsoa_boundaries, the fallback state has to be made. Preload into a check:
//   npx -y tsx --env-file=.env --import ./scripts/context-preview/install-no-boundaries.ts <script> ...
// Wraps fetch so the app database's two boundary RPCs answer "no such function" (PGRST202), as they did
// before the migration. Every other request goes through untouched. Read-only.
const app = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!app) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
const real = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(app) && /\/rest\/v1\/rpc\/lsoa_boundaries_(near|geojson)\b/.test(url))
    return new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function (before the K0 migration)" }), { status: 404, headers: { "Content-Type": "application/json" } });
  return real(input, init);
};
