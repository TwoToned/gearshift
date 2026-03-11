import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await prisma.siteSettings.findFirst();
  const policy = settings?.registrationPolicy ?? "OPEN";
  return NextResponse.json({ policy });
}
