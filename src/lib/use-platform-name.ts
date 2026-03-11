"use client";

import { useQuery } from "@tanstack/react-query";

interface PlatformBranding {
  name: string;
  icon: string | null;
}

async function fetchPlatformBranding(): Promise<PlatformBranding> {
  const res = await fetch("/api/platform-name");
  if (!res.ok) return { name: "GearFlow", icon: null };
  const data = await res.json();
  return {
    name: data.name || "GearFlow",
    icon: data.icon || null,
  };
}

export function usePlatformName(): string {
  const { data } = useQuery({
    queryKey: ["platform-branding"],
    queryFn: fetchPlatformBranding,
    staleTime: 5 * 60_000,
  });
  return data?.name || "GearFlow";
}

export function usePlatformBranding(): PlatformBranding {
  const { data } = useQuery({
    queryKey: ["platform-branding"],
    queryFn: fetchPlatformBranding,
    staleTime: 5 * 60_000,
  });
  return data || { name: "GearFlow", icon: null };
}
