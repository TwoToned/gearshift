"use client";

import { SupplierTable } from "@/components/suppliers/supplier-table";
import { RequirePermission } from "@/components/auth/require-permission";

export default function SuppliersPage() {
  return (
    <RequirePermission resource="supplier" action="read">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage your suppliers and vendors.
          </p>
        </div>
        <SupplierTable />
      </div>
    </RequirePermission>
  );
}
