import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const enabled = process.env.SITE_ADMIN_REGISTRATION_ENABLED === "true";
  const secret = process.env.SITE_ADMIN_SECRET_TOKEN;

  if (!enabled || !secret || token !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ valid: true });
}
