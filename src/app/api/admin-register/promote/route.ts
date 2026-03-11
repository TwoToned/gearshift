import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { token, email } = await request.json();

  const enabled = process.env.SITE_ADMIN_REGISTRATION_ENABLED === "true";
  const secret = process.env.SITE_ADMIN_SECRET_TOKEN;

  if (!enabled || !secret || token !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "admin" },
  });

  return NextResponse.json({ success: true });
}
