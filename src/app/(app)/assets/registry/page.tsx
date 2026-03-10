"use client";

import { AssetTable } from "@/components/assets/asset-table";

export default function RegistryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asset Registry</h1>
        <p className="text-muted-foreground">
          View and manage all serialized and bulk assets.
        </p>
      </div>
      <AssetTable />
    </div>
  );
}
