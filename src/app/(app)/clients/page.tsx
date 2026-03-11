"use client";

import { ClientTable } from "@/components/clients/client-table";
import { RequirePermission } from "@/components/auth/require-permission";

export default function ClientsPage() {
  return (
    <RequirePermission resource="client" action="read">
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Manage your client directory.
        </p>
      </div>
      <ClientTable />
    </div>
    </RequirePermission>
  );
}
