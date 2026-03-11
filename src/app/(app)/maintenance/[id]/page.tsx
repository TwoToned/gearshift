"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMaintenanceRecord } from "@/server/maintenance";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { CanDo } from "@/components/auth/permission-gate";
import { RequirePermission } from "@/components/auth/require-permission";
import type { MaintenanceFormValues } from "@/lib/validations/maintenance";

export default function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: record, isLoading } = useQuery({
    queryKey: ["maintenance", id],
    queryFn: () => getMaintenanceRecord(id),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!record) return <div className="text-muted-foreground">Record not found.</div>;

  const r = record as Record<string, unknown>;
  const initialData: MaintenanceFormValues & { id: string } = {
    id: r.id as string,
    assetId: r.assetId as string,
    type: r.type as MaintenanceFormValues["type"],
    status: r.status as MaintenanceFormValues["status"],
    title: r.title as string,
    description: (r.description as string) || "",
    assignedToId: (r.assignedToId as string) || undefined,
    scheduledDate: r.scheduledDate
      ? new Date(r.scheduledDate as string).toISOString().split("T")[0]
      : "",
    completedDate: r.completedDate
      ? new Date(r.completedDate as string).toISOString().split("T")[0]
      : "",
    cost: r.cost != null ? Number(r.cost) : undefined,
    partsUsed: (r.partsUsed as string) || "",
    result: (r.result as MaintenanceFormValues["result"]) || undefined,
    nextDueDate: r.nextDueDate
      ? new Date(r.nextDueDate as string).toISOString().split("T")[0]
      : "",
  };

  return (
    <RequirePermission resource="maintenance" action="read">
    <CanDo resource="maintenance" action="update" fallback={<div className="p-8 text-center text-muted-foreground">You don&apos;t have permission to perform this action.</div>}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Maintenance Record</h1>
          <p className="text-muted-foreground">{r.title as string}</p>
        </div>
        <MaintenanceForm initialData={initialData} />
      </div>
    </CanDo>
    </RequirePermission>
  );
}
