"use client";

import { useQuery } from "@tanstack/react-query";
import { hasPermission, type Resource } from "./permissions";

async function fetchCurrentRole(): Promise<string | null> {
  const res = await fetch("/api/current-role");
  if (!res.ok) return null;
  const data = await res.json();
  return data.role || null;
}

export function useCurrentRole(): { role: string | null; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["current-role"],
    queryFn: fetchCurrentRole,
    staleTime: 60_000,
  });
  return { role: data ?? null, isLoading };
}

export function useCanDo(resource: Resource, action: string): boolean {
  const { role } = useCurrentRole();
  if (!role) return false;
  return hasPermission(role, resource, action);
}

/** Returns true if the user is a viewer (read-only, cannot modify anything). */
export function useIsViewer(): boolean {
  const { role } = useCurrentRole();
  return role === "viewer";
}
