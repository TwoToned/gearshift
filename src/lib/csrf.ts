import { NextRequest, NextResponse } from "next/server";

/**
 * Validate the Origin header on mutating requests to prevent CSRF attacks.
 *
 * Returns a 403 response if the Origin header is missing or doesn't match
 * the request's host. Returns null if the request is valid.
 */
export function validateCsrfOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const host = request.headers.get("host");
  if (!host) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  try {
    const originUrl = new URL(origin);
    // Compare hostname (and port if present) to the Host header
    const originHost = originUrl.port
      ? `${originUrl.hostname}:${originUrl.port}`
      : originUrl.hostname;

    // Host header may include port
    const requestHost = host.split(":")[0];
    const originHostname = originHost.split(":")[0];

    if (requestHost !== originHostname) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  return null;
}
