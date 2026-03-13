"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, MapPin, Star, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { locationSchema, type LocationFormValues } from "@/lib/validations/asset";
import { useActiveOrganization } from "@/lib/auth-client";
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from "@/server/locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";

const typeLabels: Record<string, string> = {
  WAREHOUSE: "Warehouse",
  VENUE: "Venue",
  VEHICLE: "Vehicle",
  OFFSITE: "Offsite",
};

type LocationItem = Record<string, unknown> & {
  id: string;
  name: string;
  address?: string | null;
  type: string;
  isDefault?: boolean;
  parentId?: string | null;
  notes?: string | null;
  _count?: { assets?: number; bulkAssets?: number; children?: number };
};

export function LocationManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: locationsData, isLoading } = useQuery({
    queryKey: ["locations", orgId],
    queryFn: () => getLocations({ pageSize: 100 }),
  });
  const locations = locationsData?.locations;

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      type: "WAREHOUSE",
      isDefault: false,
      notes: "",
      parentId: null,
    },
  });

  const createMut = useMutation({
    mutationFn: (data: LocationFormValues) => createLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location created");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LocationFormValues }) =>
      updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location updated");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate(parentLocationId?: string) {
    setEditingId(null);
    setParentId(parentLocationId || null);
    form.reset({
      name: "",
      address: "",
      type: "WAREHOUSE",
      isDefault: false,
      notes: "",
      parentId: parentLocationId || null,
    });
    setDialogOpen(true);
  }

  function openEdit(loc: LocationItem) {
    setEditingId(loc.id);
    setParentId(loc.parentId || null);
    form.reset({
      name: loc.name,
      address: loc.address || "",
      type: (loc.type as LocationFormValues["type"]) || "WAREHOUSE",
      isDefault: loc.isDefault || false,
      notes: loc.notes || "",
      parentId: loc.parentId || null,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setParentId(null);
    form.reset();
  }

  function onSubmit(data: LocationFormValues) {
    const payload = { ...data, parentId };
    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const items = (locations || []) as LocationItem[];
  const topLevel = items.filter((l) => !l.parentId);
  const childrenOf = (id: string) => items.filter((l) => l.parentId === id);

  function assetCount(loc: LocationItem) {
    const c = loc._count;
    return (c?.assets || 0) + (c?.bulkAssets || 0);
  }

  function renderLocationRow(loc: LocationItem, isChild?: boolean) {
    const count = assetCount(loc);
    return (
      <div
        key={loc.id}
        className={`flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent/50 ${isChild ? "border-dashed" : ""}`}
      >
        <div className="flex items-center gap-2">
          {isChild ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          ) : null}
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{loc.name}</span>
              {loc.isDefault ? (
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              ) : null}
              <Badge variant="secondary" className="text-[10px]">
                {typeLabels[loc.type] || loc.type}
              </Badge>
            </div>
            {loc.address ? (
              <p className="text-xs text-muted-foreground">{loc.address}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {count > 0 ? (
            <span className="text-xs text-muted-foreground">{count} assets</span>
          ) : null}
          {!isChild ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreate(loc.id)}>
              <Plus className="h-3 w-3" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(loc)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (confirm("Delete this location?")) deleteMut.mutate(loc.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} location{items.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Location
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground">No locations yet.</p>
      ) : (
        <div className="space-y-1">
          {topLevel.map((loc) => {
            const children = childrenOf(loc.id);
            return (
              <div key={loc.id}>
                {renderLocationRow(loc)}
                {children.length > 0 ? (
                  <div className="ml-6 mt-1 space-y-1">
                    {children.map((child) => renderLocationRow(child, true))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Location" : "New Location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {parentId ? (
              <p className="text-xs text-muted-foreground">
                Sub-location of: {items.find((l) => l.id === parentId)?.name}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input {...form.register("name")} placeholder="Main Warehouse" />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) => form.setValue("type", (v ?? "WAREHOUSE") as LocationFormValues["type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                  <SelectItem value="VENUE">Venue</SelectItem>
                  <SelectItem value="VEHICLE">Vehicle</SelectItem>
                  <SelectItem value="OFFSITE">Offsite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input {...form.register("address")} placeholder="123 Main St" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.watch("isDefault")}
                onCheckedChange={(checked) => form.setValue("isDefault", !!checked)}
              />
              <Label className="text-sm">Default location</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
