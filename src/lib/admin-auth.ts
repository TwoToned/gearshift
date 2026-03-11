import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";

/** Verify the current user is a site admin. For use in API routes. */
export async function requireSiteAdminApi(): Promise<{ userId: string }> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "admin") {
    throw new Error("Access denied. Site admin required.");
  }
  return { userId: user.id };
}
