import { prisma } from "./prisma";
import { requireOrganization } from "./auth-server";
import { hasPermission, type Resource } from "./permissions";

/**
 * Get the current organization context for server-side operations.
 * Validates the user's membership and returns scoped query helpers.
 */
export async function getOrgContext() {
  const { session, organizationId } = await requireOrganization();

  return {
    organizationId,
    userId: session.user.id,
    user: session.user,
    session: session.session,
  };
}

/**
 * Helper to create a where clause scoped to the current organization.
 */
export async function orgWhere<T extends Record<string, unknown>>(
  where?: T
): Promise<T & { organizationId: string }> {
  const { organizationId } = await getOrgContext();
  return { ...where, organizationId } as T & { organizationId: string };
}

/**
 * Validate that a user has the required role in the current organization.
 */
export async function requireRole(requiredRoles: string[]) {
  const { organizationId, userId } = await getOrgContext();

  const member = await prisma.member.findFirst({
    where: {
      organizationId,
      userId,
    },
  });

  if (!member || !requiredRoles.includes(member.role)) {
    throw new Error("Insufficient permissions");
  }

  return member;
}

/**
 * Check if the current user has a specific permission in the active org.
 * Throws if not permitted.
 */
export async function requirePermission(
  resource: Resource,
  action: string,
): Promise<{ organizationId: string; userId: string }> {
  const { organizationId, userId } = await getOrgContext();

  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
  });

  if (!member) {
    throw new Error("You are not a member of this organization.");
  }

  if (!hasPermission(member.role, resource, action)) {
    throw new Error("You don't have permission to perform this action.");
  }

  return { organizationId, userId };
}

/**
 * Get the current user's role in the active org (or null if not a member).
 */
export async function getCurrentRole(): Promise<string | null> {
  const { organizationId, userId } = await getOrgContext();

  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });

  return member?.role ?? null;
}
