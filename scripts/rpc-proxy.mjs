// VicData 0.8 database load: a local proxy between our own tools (parity harnesses, rule tests,
// capture scripts) and production's PostgREST, so they can't swamp the database.
//
//   node --env-file=.env scripts/rpc-proxy.mjs [--port 8790] [--max 4] [--no-cache] [--stats FILE]
//   then run the tool with VICDATA_API_URL=http://127.0.0.1:8790 (its .env still supplies the key).
//
//   --max N      at most N requests in flight to production (default 4, env RPC_PROXY_MAX)
//   --no-cache   pass every request through (the "before" count); by default each run caches every
//                answer by (path, body), so both trees' captures read each answer once -- and the same
//                answer, which also makes the fixtures consistent
//   --stats F    writes the counts to F (JSON) every 10 s and on exit
//
// A 5xx, a statement timeout (57014) or a network error is retried up to 4 times, after 1, 2, 4 and 8 s.
// Only POST and GET to /rest/v1/ are forwarded. The production URL and key come from this process's own
// environment (.env); neither is ever printed.
import http from "node:http";
import { writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const PORT = Number(arg("--port", process.env.RPC_PROXY_PORT ?? 8790));
const MAX = Number(arg("--max", process.env.RPC_PROXY_MAX ?? 4));
const CACHE = !process.argv.includes("--no-cache");
const STATS = arg("--stats", null);
const UPSTREAM = process.env.VICDATA_API_URL;
const KEY = process.env.VICDATA_ANON_KEY;
if (!UPSTREAM || !KEY) throw new Error("VICDATA_API_URL and VICDATA_ANON_KEY must be set (run with --env-file=.env)");
if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(UPSTREAM)) throw new Error("VICDATA_API_URL points at a local proxy: start the proxy with the real .env");

const stats = { started: new Date().toISOString(), max: MAX, cache: CACHE, received: 0, upstream: 0, cacheHits: 0, retries: 0, failures: 0, byFunction: {} };
const fnOf = (path) => (path.match(/\/rpc\/([a-z0-9_]+)/) ?? [null, path.split("?")[0]])[1];
const count = (fn, field) => {
  const f = (stats.byFunction[fn] ??= { received: 0, upstream: 0, cacheHits: 0 });
  f[field]++;
};
const writeStats = () => STATS && writeFileSync(STATS, JSON.stringify(stats, null, 1));
setInterval(writeStats, 10_000).unref();

// at most MAX upstream requests at once
let active = 0;
const queue = [];
const acquire = () => (active < MAX ? (active++, Promise.resolve()) : new Promise((r) => queue.push(r)));
const release = () => {
  const next = queue.shift();
  if (next) next();
  else active--;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function upstream(method, path, body, headers) {
  for (let attempt = 0; ; attempt++) {
    await acquire();
    let res, text, err;
    try {
      stats.upstream++;
      count(fnOf(path), "upstream");
      res = await fetch(`${UPSTREAM}${path}`, { method, headers: { ...headers, apikey: KEY, Authorization: `Bearer ${KEY}` }, body: method === "GET" ? undefined : body });
      text = await res.text();
    } catch (e) {
      err = e;
    } finally {
      release();
    }
    const retryable = err || res.status >= 500 || /57014|statement timeout/.test(text ?? "");
    if (!retryable || attempt >= 4) {
      if (err) throw err;
      if (!res.ok) stats.failures++;
      return { status: res.status, type: res.headers.get("content-type") ?? "application/json", text };
    }
    stats.retries++;
    await sleep(1000 * 2 ** attempt);
  }
}

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const canonical = (body) => {
  try {
    return JSON.stringify(sortKeys(JSON.parse(body)));
  } catch {
    return body;
  }
};

const cache = new Map();
http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString("utf8");
    if (!req.url.startsWith("/rest/v1/") || !["POST", "GET"].includes(req.method)) {
      res.writeHead(404).end();
      return;
    }
    stats.received++;
    const fn = fnOf(req.url);
    count(fn, "received");
    const headers = { "Content-Type": "application/json" };
    for (const h of ["accept", "prefer", "range", "range-unit", "content-profile", "accept-profile"]) if (req.headers[h]) headers[h] = req.headers[h];
    // The same arguments in another key order are the same request (the two trees' paged reads differ so).
    const key = `${req.method} ${req.url} ${JSON.stringify(headers)} ${canonical(body)}`;
    try {
      let p = CACHE ? cache.get(key) : undefined;
      if (p) {
        stats.cacheHits++;
        count(fn, "cacheHits");
      } else {
        p = upstream(req.method, req.url, body, headers);
        if (CACHE) {
          cache.set(key, p);
          p.then((r) => { if (r.status >= 400) cache.delete(key); }, () => cache.delete(key));
        }
      }
      const r = await p;
      res.writeHead(r.status, { "Content-Type": r.type }).end(r.text);
    } catch (e) {
      stats.failures++;
      res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ message: `rpc-proxy: ${e instanceof Error ? e.message : e}` }));
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`[rpc-proxy] 127.0.0.1:${PORT}, at most ${MAX} in flight, cache ${CACHE ? "on" : "off"}`));

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { writeStats(); process.exit(0); });
