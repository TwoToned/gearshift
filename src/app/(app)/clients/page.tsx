"use client";

import { ClientTable } from "@/components/clients/client-table";

export default function ClientsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Manage your client directory.
        </p>
      </div>
      <ClientTable />
    </div>
  );
}
