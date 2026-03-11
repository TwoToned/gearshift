import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.siteSettings.findFirst({
    select: { platformName: true, platformIcon: true },
  });
  return NextResponse.json({
    name: settings?.platformName || "GearFlow",
    icon: settings?.platformIcon || null,
  });
}
