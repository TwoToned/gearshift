"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveOrganization } from "@/lib/auth-client";

import {
  getModelAccessories,
  addModelAccessory,
  updateModelAccessory,
  removeModelAccessory,
  reorderModelAccessories,
} from "@/server/model-accessories";
import { getModels } from "@/server/models";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CanDo } from "@/components/auth/permission-gate";
import { ComboboxPicker } from "@/components/ui/combobox-picker";

const levelColors: Record<string, string> = {
  MANDATORY: "bg-red-500/10 text-red-500 border-red-500/20",
  OPTIONAL: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  RECOMMENDED: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const levelLabels: Record<string, string> = {
  MANDATORY: "Mandatory",
  OPTIONAL: "Optional",
  RECOMMENDED: "Recommended",
};

interface ModelAccessoriesTabProps {
  modelId: string;
}

export function ModelAccessoriesTab({ modelId }: ModelAccessoriesTabProps) {
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;
  const [addOpen, setAddOpen] = useState(false);

  const { data: accessories, isLoading } = useQuery({
    queryKey: ["model-accessories", orgId, modelId],
    queryFn: () => getModelAccessories(modelId),
  });

  const addMut = useMutation({
    mutationFn: (data: {
      accessoryModelId: string;
      quantity: number;
      level: "MANDATORY" | "OPTIONAL" | "RECOMMENDED";
      notes?: string;
    }) => addModelAccessory(modelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-accessories", orgId, modelId] });
      toast.success("Accessory added");
      setAddOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { quantity?: number; level?: "MANDATORY" | "OPTIONAL" | "RECOMMENDED"; notes?: string } }) =>
      updateModelAccessory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-accessories", orgId, modelId] });
      toast.success("Accessory updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: removeModelAccessory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-accessories", orgId, modelId] });
      toast.success("Accessory removed");
    },
    onError: (e) => toast.error(e.message),
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const items = (accessories || []) as any[];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading accessories...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define accessories that should be automatically added when this model is added to a project.
        </p>
        <CanDo resource="model" action="update">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-2 h-4 w-4" />
              Add Accessory
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Accessory</DialogTitle>
              </DialogHeader>
              <AddAccessoryForm
                modelId={modelId}
                existingIds={items.map((a: any) => a.accessoryModelId)}
                onSubmit={(data) => addMut.mutate(data)}
                isPending={addMut.isPending}
              />
            </DialogContent>
          </Dialog>
        </CanDo>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Link2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No accessories defined for this model.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Accessory</TableHead>
                <TableHead className="w-[80px]">Qty</TableHead>
                <TableHead className="w-[140px]">Level</TableHead>
                <TableHead className="hidden sm:table-cell">Notes</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((acc: any) => (
                <AccessoryRow
                  key={acc.id}
                  accessory={acc}
                  onUpdate={(data) => updateMut.mutate({ id: acc.id, data })}
                  onRemove={() => {
                    if (confirm(`Remove ${acc.accessoryModel.name} as an accessory?`)) {
                      removeMut.mutate(acc.id);
                    }
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AccessoryRow({
  accessory,
  onUpdate,
  onRemove,
}: {
  accessory: any;
  onUpdate: (data: { quantity?: number; level?: "MANDATORY" | "OPTIONAL" | "RECOMMENDED"; notes?: string }) => void;
  onRemove: () => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{accessory.accessoryModel.name}</p>
          <p className="text-xs text-muted-foreground">
            {[accessory.accessoryModel.manufacturer, accessory.accessoryModel.modelNumber]
              .filter(Boolean)
              .join(" — ")}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <CanDo
          resource="model"
          action="update"
          fallback={<span className="text-sm">{accessory.quantity}</span>}
        >
          <Input
            type="number"
            min={1}
            className="h-8 w-16 text-sm"
            defaultValue={accessory.quantity}
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val > 0 && val !== accessory.quantity) {
                onUpdate({ quantity: val });
              }
            }}
          />
        </CanDo>
      </TableCell>
      <TableCell>
        <CanDo
          resource="model"
          action="update"
          fallback={
            <Badge variant="outline" className={levelColors[accessory.level]}>
              {levelLabels[accessory.level]}
            </Badge>
          }
        >
          <Select
            value={accessory.level}
            onValueChange={(v) => {
              if (v && v !== accessory.level) {
                onUpdate({ level: v as "MANDATORY" | "OPTIONAL" | "RECOMMENDED" });
              }
            }}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue>{levelLabels[accessory.level]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MANDATORY">Mandatory</SelectItem>
              <SelectItem value="OPTIONAL">Optional</SelectItem>
              <SelectItem value="RECOMMENDED">Recommended</SelectItem>
            </SelectContent>
          </Select>
        </CanDo>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="text-sm text-muted-foreground">{accessory.notes || "—"}</span>
      </TableCell>
      <TableCell>
        <CanDo resource="model" action="update">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CanDo>
      </TableCell>
    </TableRow>
  );
}

function AddAccessoryForm({
  modelId,
  existingIds,
  onSubmit,
  isPending,
}: {
  modelId: string;
  existingIds: string[];
  onSubmit: (data: {
    accessoryModelId: string;
    quantity: number;
    level: "MANDATORY" | "OPTIONAL" | "RECOMMENDED";
    notes?: string;
  }) => void;
  isPending: boolean;
}) {
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const [selectedModelId, setSelectedModelId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [level, setLevel] = useState<"MANDATORY" | "OPTIONAL" | "RECOMMENDED">("MANDATORY");
  const [notes, setNotes] = useState("");

  const { data: modelsData } = useQuery({
    queryKey: ["models", orgId, "all-for-accessories"],
    queryFn: () => getModels({ pageSize: 500, isActive: true }),
  });

  const models = ((modelsData as any)?.models || []) as Array<{
    id: string;
    name: string;
    manufacturer: string | null;
    modelNumber: string | null;
  }>;

  // Filter out self and already-added models
  const excludeIds = new Set([modelId, ...existingIds]);
  const options = models
    .filter((m) => !excludeIds.has(m.id))
    .map((m) => ({
      value: m.id,
      label: `${m.name}${m.manufacturer ? ` (${m.manufacturer})` : ""}`,
    }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Model</label>
        <ComboboxPicker
          options={options}
          value={selectedModelId}
          onChange={setSelectedModelId}
          placeholder="Search models..."
          emptyMessage="No models found"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Quantity per parent</label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Level</label>
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <SelectTrigger>
              <SelectValue>{levelLabels[level]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MANDATORY">Mandatory</SelectItem>
              <SelectItem value="OPTIONAL">Optional</SelectItem>
              <SelectItem value="RECOMMENDED">Recommended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes (optional)</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Use IEC cable for 240V venues"
        />
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          disabled={!selectedModelId || isPending}
          onClick={() =>
            onSubmit({
              accessoryModelId: selectedModelId,
              quantity,
              level,
              notes: notes || undefined,
            })
          }
        >
          {isPending ? "Adding..." : "Add Accessory"}
        </Button>
      </div>
    </div>
  );
}
