import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ role: null });

    const orgId = session.session.activeOrganizationId;
    if (!orgId) return NextResponse.json({ role: null });

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id },
      select: { role: true },
    });

    return NextResponse.json({ role: member?.role || null });
  } catch {
    return NextResponse.json({ role: null });
  }
}
