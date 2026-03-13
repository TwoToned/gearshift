import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

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

const promoteSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  let body;
  try {
    body = promoteSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, email } = body;

  const enabled = process.env.SITE_ADMIN_REGISTRATION_ENABLED === "true";
  const secret = process.env.SITE_ADMIN_SECRET_TOKEN;

  if (!enabled || !secret || !safeTokenCompare(token, secret)) {
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
