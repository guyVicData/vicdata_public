// Preloaded into the local Next server (NODE_OPTIONS="--import <this file>") for the notes and feedback browser
// tests (copied from the View as fixes round, unchanged in what it does) -- for the View as fixes browser
// tests: the browser's stub platform admin (harness.mjs, a fake token whose sub is the admin's id) is
// answered here, so every page and route runs for real against the real app database with no real session.
//   * auth/v1/user for the stub token: the stub user;  rpc/is_platform_admin for it: true;
//   * any other database request carrying the stub token: sent with the anon key instead (the admin's
//     own RLS then reads nothing -- View as reads through the service role after the check, as live);
//   * every write -- POST/PATCH/PUT/DELETE to a table, and any rpc that isn't a known read -- refused (403)
//     and logged. Nothing is ever written.
const REF = process.env.STUB_REF ?? "lnhulykjlxmoneappnsp";
const HOST = `${REF}.supabase.co`;
const READ_RPCS = /^(is_platform_admin|region_nation_set|search_schools|nearest_schools|school_groups_lookup|group_schools_lookup|platform_group_accounts_overview|[a-z0-9_]*_lookup|[a-z0-9_]*_json|reference_[a-z0-9_]*)$/;
const original = globalThis.fetch;
const stubSub = (auth) => {
  const t = (auth ?? "").replace(/^Bearer\s+/i, "");
  if (!t.endsWith(".sig")) return null;
  try {
    return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).sub ?? null;
  } catch {
    return null;
  }
};
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  if (u.host !== HOST) return original(input, init);
  const sub = stubSub(req.headers.get("authorization"));
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (sub && u.pathname === "/auth/v1/user") return json({ id: sub, aud: "authenticated", role: "authenticated", email: "admin@example.test" });
  if (sub && u.pathname === "/rest/v1/rpc/is_platform_admin") return json(true);
  const rpc = u.pathname.startsWith("/rest/v1/rpc/") ? u.pathname.slice("/rest/v1/rpc/".length) : null;
  const write = req.method !== "GET" && req.method !== "HEAD" && !(rpc && READ_RPCS.test(rpc));
  if (write) {
    console.log(`[stub-server] refused ${req.method} ${u.pathname}`);
    return json({ message: "stub server: writes refused" }, 403);
  }
  if (sub) {
    const h = new Headers(req.headers);
    h.set("authorization", `Bearer ${h.get("apikey")}`);
    return original(new Request(req, { headers: h }));
  }
  return original(input, init);
};
console.log("[stub-server] preload installed for", HOST);
