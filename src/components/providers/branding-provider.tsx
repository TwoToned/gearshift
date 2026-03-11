"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { getOrganization } from "@/server/settings";
import { generatePrimaryPalette } from "@/lib/color-utils";
import type { OrgBranding } from "@/server/settings";

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const { data: org } = useQuery({
    queryKey: ["organization"],
    queryFn: getOrganization,
  });

  const branding = (org as Record<string, unknown>)?.settings as { branding?: OrgBranding } | undefined;
  const primaryColor = branding?.branding?.primaryColor;

  useEffect(() => {
    if (!primaryColor) return;

    const mode = resolvedTheme === "light" ? "light" : "dark";
    const overrides = generatePrimaryPalette(primaryColor, mode);

    const root = document.documentElement;
    const applied: string[] = [];

    for (const [prop, value] of Object.entries(overrides)) {
      root.style.setProperty(prop, value);
      applied.push(prop);
    }

    return () => {
      for (const prop of applied) {
        root.style.removeProperty(prop);
      }
    };
  }, [primaryColor, resolvedTheme]);

  return <>{children}</>;
}
