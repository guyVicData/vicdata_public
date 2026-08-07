import { NextResponse, type NextRequest } from "next/server";

// Default-deny: the gate is active unless ACCESS_GATE_ENABLED is explicitly "false".
// Missing credentials with the gate enabled fails closed (blocks everything), it
// never falls open. See docs/vicdata_phase3_full_build_brief_v1.md — "Launch gating".
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|api/health).*)",
};

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="VicData Public", charset="UTF-8"',
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function proxy(request: NextRequest): NextResponse {
  const gateEnabled = process.env.ACCESS_GATE_ENABLED !== "false";
  if (!gateEnabled) {
    return NextResponse.next();
  }

  const expectedUser = process.env.ACCESS_GATE_USER;
  const expectedPassword = process.env.ACCESS_GATE_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return unauthorized();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(authHeader.slice("Basic ".length));
  } catch {
    return unauthorized();
  }

  const sepIndex = decoded.indexOf(":");
  if (sepIndex === -1) {
    return unauthorized();
  }
  const user = decoded.slice(0, sepIndex);
  const password = decoded.slice(sepIndex + 1);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(password, expectedPassword)) {
    return unauthorized();
  }

  return NextResponse.next();
}
