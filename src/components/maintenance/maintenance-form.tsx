"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  maintenanceSchema,
  type MaintenanceFormValues,
} from "@/lib/validations/maintenance";
import {
  createMaintenanceRecord,
  updateMaintenanceRecord,
  getAssetsForMaintenanceSelect,
} from "@/server/maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MaintenanceFormProps {
  initialData?: MaintenanceFormValues & { id: string };
}

export function MaintenanceForm({ initialData }: MaintenanceFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const { data: assets } = useQuery({
    queryKey: ["maintenance-assets"],
    queryFn: getAssetsForMaintenanceSelect,
  });

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: initialData || {
      assetId: "",
      type: "REPAIR",
      status: "SCHEDULED",
      title: "",
      description: "",
      scheduledDate: "",
      completedDate: "",
      cost: undefined,
      partsUsed: "",
      result: undefined,
      nextDueDate: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: MaintenanceFormValues) =>
      isEdit
        ? updateMaintenanceRecord(initialData!.id, data)
        : createMaintenanceRecord(data),
    onSuccess: () => {
      toast.success(isEdit ? "Record updated" : "Record created");
      router.push("/maintenance");
    },
    onError: (e) => toast.error(e.message),
  });

  const statusValue = form.watch("status");
  const typeValue = form.watch("type");

  return (
    <form
      onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      className="space-y-6 max-w-2xl"
    >
      {/* Asset */}
      <div className="space-y-2">
        <Label htmlFor="assetId">Asset *</Label>
        <Select
          value={form.watch("assetId")}
          onValueChange={(v) => form.setValue("assetId", v ?? "")}
          disabled={isEdit}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an asset..." />
          </SelectTrigger>
          <SelectContent>
            {(assets || []).map((a: { id: string; label: string }) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.assetId && (
          <p className="text-sm text-destructive">
            {form.formState.errors.assetId.message}
          </p>
        )}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...form.register("title")} placeholder="Brief description" />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      {/* Type + Status row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={typeValue}
            onValueChange={(v) => form.setValue("type", v as MaintenanceFormValues["type"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REPAIR">Repair</SelectItem>
              <SelectItem value="PREVENTATIVE">Preventative</SelectItem>
              <SelectItem value="TEST_AND_TAG">Test &amp; Tag</SelectItem>
              <SelectItem value="INSPECTION">Inspection</SelectItem>
              <SelectItem value="CLEANING">Cleaning</SelectItem>
              <SelectItem value="FIRMWARE_UPDATE">Firmware Update</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={statusValue}
            onValueChange={(v) => form.setValue("status", v as MaintenanceFormValues["status"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Detailed notes about the work..."
          rows={3}
        />
      </div>

      {/* Dates row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scheduledDate">Scheduled Date</Label>
          <Input id="scheduledDate" type="date" {...form.register("scheduledDate")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="completedDate">Completed Date</Label>
          <Input id="completedDate" type="date" {...form.register("completedDate")} />
        </div>
      </div>

      {/* Cost + Parts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cost">Cost ($)</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            {...form.register("cost")}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partsUsed">Parts Used</Label>
          <Input
            id="partsUsed"
            {...form.register("partsUsed")}
            placeholder="List parts..."
          />
        </div>
      </div>

      {/* Result + Next Due */}
      {(typeValue === "TEST_AND_TAG" || statusValue === "COMPLETED") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Result</Label>
            <Select
              value={form.watch("result") || ""}
              onValueChange={(v) =>
                form.setValue("result", (v || undefined) as MaintenanceFormValues["result"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select result..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">Pass</SelectItem>
                <SelectItem value="FAIL">Fail</SelectItem>
                <SelectItem value="CONDITIONAL">Conditional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextDueDate">Next Due Date</Label>
            <Input id="nextDueDate" type="date" {...form.register("nextDueDate")} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? "Saving..."
            : isEdit
              ? "Update Record"
              : "Create Record"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
