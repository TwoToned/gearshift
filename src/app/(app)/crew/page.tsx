"use client";

import { CrewTable } from "@/components/crew/crew-table";
import { RequirePermission } from "@/components/auth/require-permission";

export default function CrewPage() {
  return (
    <RequirePermission resource="crew" action="read">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Crew</h1>
          <p className="text-muted-foreground">
            Manage your crew members, freelancers, and contractors.
          </p>
        </div>
        <CrewTable />
      </div>
    </RequirePermission>
  );
}
