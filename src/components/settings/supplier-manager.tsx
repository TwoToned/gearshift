"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import { supplierSchema, type SupplierFormValues } from "@/lib/validations/asset";
import { useActiveOrganization } from "@/lib/auth-client";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/server/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type SupplierItem = {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
  _count?: { assets?: number };
};

export function SupplierManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers", orgId],
    queryFn: getSuppliers,
  });

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactName: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      notes: "",
    },
  });

  const createMut = useMutation({
    mutationFn: (data: SupplierFormValues) => createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier created");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierFormValues }) =>
      updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier updated");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    form.reset({ name: "", contactName: "", email: "", phone: "", website: "", address: "", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(s: SupplierItem) {
    setEditingId(s.id);
    form.reset({
      name: s.name,
      contactName: s.contactName || "",
      email: s.email || "",
      phone: s.phone || "",
      website: s.website || "",
      address: s.address || "",
      notes: s.notes || "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    form.reset();
  }

  function onSubmit(data: SupplierFormValues) {
    if (editingId) {
      updateMut.mutate({ id: editingId, data });
    } else {
      createMut.mutate(data);
    }
  }

  const items = (suppliers || []) as SupplierItem[];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} supplier{items.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Supplier
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suppliers yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map((s) => {
            const assetCount = s._count?.assets || 0;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm font-medium">{s.name}</span>
                    {s.contactName ? (
                      <p className="text-xs text-muted-foreground">{s.contactName}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {assetCount > 0 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {assetCount} assets
                    </Badge>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      if (confirm("Delete this supplier?")) deleteMut.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Supplier" : "New Supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input {...form.register("name")} placeholder="e.g. Jands" />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input {...form.register("contactName")} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...form.register("phone")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input {...form.register("website")} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input {...form.register("address")} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} rows={2} />
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
