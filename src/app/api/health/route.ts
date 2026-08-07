// Deliberately outside the access-gate matcher (see middleware.ts) so Render's
// health check can reach it without Basic Auth credentials.
export function GET(): Response {
  return new Response("ok", { status: 200 });
}
