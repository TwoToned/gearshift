import { prisma } from "./prisma";
import { requireOrganization } from "./auth-server";

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
