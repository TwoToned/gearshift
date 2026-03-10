"use client";

import { ModelTable } from "@/components/assets/model-table";

export default function ModelsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipment Models</h1>
        <p className="text-muted-foreground">
          Manage your equipment model library — templates for creating assets.
        </p>
      </div>
      <ModelTable />
    </div>
  );
}
