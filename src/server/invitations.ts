"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { serialize } from "@/lib/serialize";

/** Get pending invitations for the current user (by email). No org context needed. */
export async function getMyPendingInvitations() {
  const session = await requireSession();
  const email = session.user.email?.toLowerCase();
  if (!email) return [];

  const invitations = await prisma.invitation.findMany({
    where: {
      email,
      status: "pending",
      expiresAt: { gte: new Date() },
    },
    include: {
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return serialize(invitations);
}
