// Deliberately outside the beta gate's matcher (src/proxy.ts) so Render's health check reaches it
// without a session.
export function GET(): Response {
  return new Response("ok", { status: 200 });
}
