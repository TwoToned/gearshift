"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext, requirePermission } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";
import { sendEmail, roleChangedEmail, removedFromOrgEmail } from "@/lib/email";

export async function getOrgMembers(params?: {
  page?: number;
  pageSize?: number;
}) {
  await requirePermission("orgMembers", "read");
  const { organizationId } = await getOrgContext();
  const { page = 1, pageSize = 50 } = params || {};

  const where = { organizationId };

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            twoFactorEnabled: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.count({ where }),
  ]);

  return serialize({
    members,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function changeMemberRole(memberId: string, newRole: string) {
  await requirePermission("orgMembers", "update_role");
  const { organizationId, userId } = await getOrgContext();

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!target) throw new Error("Member not found");

  // Can't change owner role
  if (target.role === "owner") {
    throw new Error("Cannot change the owner's role. Transfer ownership instead.");
  }

  // Can't change your own role
  if (target.userId === userId) {
    throw new Error("You cannot change your own role.");
  }

  // Admins can't promote to admin or change other admins
  const actor = await prisma.member.findFirst({
    where: { organizationId, userId },
  });
  if (actor?.role === "admin" && (newRole === "admin" || target.role === "admin")) {
    throw new Error("Only the owner can manage admin roles.");
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { role: newRole },
  });

  // Send notification email
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (org && target.user.email) {
    const emailContent = roleChangedEmail({ orgName: org.name, newRole });
    sendEmail({ to: target.user.email, ...emailContent }).catch(console.error);
  }

  return { success: true };
}

export async function removeOrgMember(memberId: string) {
  await requirePermission("orgMembers", "remove");
  const { organizationId, userId } = await getOrgContext();

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    include: { user: { select: { email: true } } },
  });
  if (!target) throw new Error("Member not found");

  if (target.role === "owner") {
    throw new Error("Cannot remove the owner. Transfer ownership first.");
  }

  if (target.userId === userId) {
    throw new Error("You cannot remove yourself. Use 'Leave Organization' instead.");
  }

  // Admins can't remove other admins
  const actor = await prisma.member.findFirst({
    where: { organizationId, userId },
  });
  if (actor?.role === "admin" && target.role === "admin") {
    throw new Error("Only the owner can remove admins.");
  }

  await prisma.member.delete({ where: { id: memberId } });

  // Send notification
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (org && target.user.email) {
    const emailContent = removedFromOrgEmail({ orgName: org.name });
    sendEmail({ to: target.user.email, ...emailContent }).catch(console.error);
  }

  return { success: true };
}

export async function transferOwnership(newOwnerId: string) {
  const { organizationId, userId } = await getOrgContext();

  // Only the owner can transfer
  const actor = await prisma.member.findFirst({
    where: { organizationId, userId },
  });
  if (!actor || actor.role !== "owner") {
    throw new Error("Only the owner can transfer ownership.");
  }

  const newOwner = await prisma.member.findFirst({
    where: { organizationId, userId: newOwnerId },
  });
  if (!newOwner) throw new Error("Target must be a member of this organization.");

  await prisma.$transaction([
    prisma.member.update({
      where: { id: actor.id },
      data: { role: "admin" },
    }),
    prisma.member.update({
      where: { id: newOwner.id },
      data: { role: "owner" },
    }),
  ]);

  return { success: true };
}

export async function getPendingInvitations() {
  const { organizationId } = await getOrgContext();

  const invitations = await prisma.invitation.findMany({
    where: { organizationId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return serialize(invitations);
}

export async function revokeInvitation(invitationId: string) {
  await requirePermission("orgMembers", "invite");
  const { organizationId } = await getOrgContext();

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId, status: "pending" },
  });
  if (!invitation) throw new Error("Invitation not found");

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "cancelled" },
  });

  return { success: true };
}
