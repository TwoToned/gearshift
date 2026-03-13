import { useRef } from "react";
import { createAuthClient } from "better-auth/react";
import { organizationClient, twoFactorClient, adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    organizationClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/two-factor";
      },
    }),
    adminClient(),
  ],
});

const {
  useActiveOrganization: _useActiveOrganization,
  ...authExports
} = authClient;

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
  useListOrganizations,
} = authExports;

/**
 * Wrapper around Better Auth's useActiveOrganization that returns a stable
 * orgId. Once the org resolves, the previous value is held during re-fetches
 * to prevent query key flicker (undefined → id) that causes DOM errors.
 */
export function useActiveOrganization() {
  const result = _useActiveOrganization();
  const lastOrgId = useRef<string | undefined>(undefined);

  const currentId = result.data?.id;
  if (currentId !== undefined) {
    lastOrgId.current = currentId;
  }

  return {
    ...result,
    data: result.data ?? (lastOrgId.current ? { id: lastOrgId.current } as unknown as typeof result.data : undefined),
  };
}
