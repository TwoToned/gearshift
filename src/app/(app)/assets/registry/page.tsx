"use client";

import { AssetTable } from "@/components/assets/asset-table";
import { RequirePermission } from "@/components/auth/require-permission";

export default function RegistryPage() {
  return (
    <RequirePermission resource="asset" action="read">
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asset Registry</h1>
        <p className="text-muted-foreground">
          View and manage all serialized and bulk assets.
        </p>
      </div>
      <AssetTable />
    </div>
    </RequirePermission>
  );
}
