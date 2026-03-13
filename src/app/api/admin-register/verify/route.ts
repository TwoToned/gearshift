import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

function safeTokenCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const enabled = process.env.SITE_ADMIN_REGISTRATION_ENABLED === "true";
  const secret = process.env.SITE_ADMIN_SECRET_TOKEN;

  if (!enabled || !secret || !token || !safeTokenCompare(token, secret)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ valid: true });
}
