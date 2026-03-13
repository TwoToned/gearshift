"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { getOrganization, type OrgSettings } from "@/server/settings";

/** Returns the org's configured country code (e.g. "AU"), or undefined. */
export function useOrgCountry(): string | undefined {
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: org } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: getOrganization,
    enabled: !!orgId,
  });

  const settings = (org as Record<string, unknown>)?.settings as OrgSettings | undefined;
  return settings?.country || undefined;
}
