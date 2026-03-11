"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { serialize } from "@/lib/serialize";
import { invalidatePlatformNameCache } from "@/lib/platform";

/** Verify the current user is a site admin. Throws if not. */
async function requireSiteAdmin() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "admin") {
    throw new Error("Access denied. Site admin required.");
  }
  return session;
}

/** Check if the current user is a site admin */
export async function isSiteAdmin(): Promise<boolean> {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    return user?.role === "admin";
  } catch {
    return false;
  }
}

// ─── Site Settings ─────────────────────────────────────────────────────────

export async function getSiteSettings() {
  let settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    settings = await prisma.siteSettings.create({ data: {} });
  }
  return serialize(settings);
}

export async function updateSiteSettings(data: {
  platformName?: string;
  platformIcon?: string | null;
  platformLogo?: string | null;
  registrationPolicy?: string;
  twoFactorGlobalPolicy?: string;
  defaultCurrency?: string;
  defaultTaxRate?: number;
}) {
  await requireSiteAdmin();

  let settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    settings = await prisma.siteSettings.create({ data: {} });
  }

  const updated = await prisma.siteSettings.update({
    where: { id: settings.id },
    data,
  });

  // Invalidate the cached platform name so it picks up changes immediately
  invalidatePlatformNameCache();

  return serialize(updated);
}

// ─── Organization Management ───────────────────────────────────────────────

export async function getAllOrganizations(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  await requireSiteAdmin();
  const { page = 1, pageSize = 20, search } = params || {};

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { slug: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          where: { role: "owner" },
          take: 1,
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return serialize({
    organizations,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function adminUpdateOrganization(
  orgId: string,
  data: { name?: string; slug?: string },
) {
  await requireSiteAdmin();

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data,
  });

  return serialize(updated);
}

export async function adminDeleteOrganization(orgId: string) {
  await requireSiteAdmin();

  await prisma.organization.delete({ where: { id: orgId } });
  return { success: true };
}

export async function adminGetOrganizationDetails(orgId: string) {
  await requireSiteAdmin();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          assets: true,
          bulkAssets: true,
          projects: true,
          kits: true,
        },
      },
    },
  });

  if (!org) throw new Error("Organization not found");
  return serialize(org);
}

// ─── User Management ───────────────────────────────────────────────────────

export async function getAllUsers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  roleFilter?: string;
}) {
  await requireSiteAdmin();
  const { page = 1, pageSize = 20, search, roleFilter } = params || {};

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (roleFilter) {
    where.role = roleFilter;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        banned: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
        members: {
          include: {
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return serialize({
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function promoteToSiteAdmin(userId: string) {
  await requireSiteAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { role: "admin" },
  });
  return { success: true };
}

export async function demoteFromSiteAdmin(userId: string) {
  const session = await requireSiteAdmin();
  if (session.user.id === userId) {
    throw new Error("You cannot demote yourself.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { role: "user" },
  });
  return { success: true };
}

export async function banUser(userId: string) {
  const session = await requireSiteAdmin();
  if (session.user.id === userId) {
    throw new Error("You cannot ban yourself.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { banned: true },
  });
  return { success: true };
}

export async function unbanUser(userId: string) {
  await requireSiteAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { banned: false },
  });
  return { success: true };
}

export async function adminDeleteUser(userId: string) {
  const session = await requireSiteAdmin();
  if (session.user.id === userId) {
    throw new Error("You cannot delete yourself.");
  }
  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
}

export async function forceDisable2FA(userId: string) {
  await requireSiteAdmin();
  await prisma.$transaction([
    prisma.twoFactor.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    }),
  ]);
  return { success: true };
}

export async function adminTransferOwnership(orgId: string, newOwnerId: string) {
  await requireSiteAdmin();

  return prisma.$transaction(async (tx) => {
    // Find current owner
    const currentOwner = await tx.member.findFirst({
      where: { organizationId: orgId, role: "owner" },
    });

    // Verify new owner is a member
    const newOwner = await tx.member.findFirst({
      where: { organizationId: orgId, userId: newOwnerId },
    });
    if (!newOwner) throw new Error("New owner must be a member of the organization.");

    // Demote current owner
    if (currentOwner) {
      await tx.member.update({
        where: { id: currentOwner.id },
        data: { role: "admin" },
      });
    }

    // Promote new owner
    await tx.member.update({
      where: { id: newOwner.id },
      data: { role: "owner" },
    });

    return { success: true };
  });
}

// ─── Dashboard Stats ───────────────────────────────────────────────────────

export async function getAdminDashboardStats() {
  await requireSiteAdmin();

  const [totalUsers, totalOrgs, recentUsers, recentOrgs, siteAdminCount] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, slug: true, createdAt: true },
    }),
    prisma.user.count({ where: { role: "admin" } }),
  ]);

  return serialize({
    totalUsers,
    totalOrgs,
    siteAdminCount,
    recentUsers,
    recentOrgs,
  });
}
