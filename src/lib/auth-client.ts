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

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
  useActiveOrganization,
  useListOrganizations,
} = authClient;
