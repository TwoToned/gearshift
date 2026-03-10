import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getActiveOrganizationId() {
  const session = await getSession();
  return session?.session?.activeOrganizationId ?? null;
}

export async function requireOrganization() {
  const session = await requireSession();
  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    throw new Error("No active organization");
  }
  return { session, organizationId: orgId };
}
