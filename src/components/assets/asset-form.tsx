"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { assetSchema, type AssetFormValues } from "@/lib/validations/asset";
import { createAsset, createAssets, updateAsset } from "@/server/assets";
import { peekNextAssetTags } from "@/server/settings";
import { getModels } from "@/server/models";
import { getLocations } from "@/server/locations";
import { getSuppliers } from "@/server/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboboxPicker } from "@/components/ui/combobox-picker";
import { QuickCreateLocation } from "./quick-create-location";
import { QuickCreateSupplier } from "./quick-create-supplier";

interface AssetFormProps {
  initialData?: AssetFormValues & { id: string };
  preselectedModelId?: string;
}

export function AssetForm({ initialData, preselectedModelId }: AssetFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [extraAssets, setExtraAssets] = useState<{ tag: string; serialNumber: string }[]>([]);

  const { data: modelsData } = useQuery({
    queryKey: ["models", { isActive: true, assetType: "SERIALIZED", pageSize: 200 }],
    queryFn: () => getModels({ assetType: "SERIALIZED", pageSize: 200 }),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => getLocations(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => getSuppliers(),
  });

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: initialData || {
      modelId: preselectedModelId || "",
      assetTag: "",
      serialNumber: "",
      customName: "",
      status: "AVAILABLE",
      condition: "NEW",
      notes: "",
      locationId: "",
      isActive: true,
      images: [],
    },
  });

  // Auto-populate asset tag for new assets (preview only, no counter increment)
  useEffect(() => {
    if (!isEditing && !form.getValues("assetTag")) {
      peekNextAssetTags(1).then(([tag]) => {
        form.setValue("assetTag", tag);
      }).catch(() => {
        // ignore — user can still type manually
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addExtraAsset = async () => {
    try {
      // Peek at the next N+1 tags (current count + 1) and use the last one
      const totalNeeded = 1 + extraAssets.length + 1;
      const tags = await peekNextAssetTags(totalNeeded);
      setExtraAssets((prev) => [...prev, { tag: tags[tags.length - 1], serialNumber: "" }]);
    } catch {
      setExtraAssets((prev) => [...prev, { tag: "", serialNumber: "" }]);
    }
  };

  const removeExtraAsset = (index: number) => {
    setExtraAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExtraAsset = (index: number, field: "tag" | "serialNumber", value: string) => {
    setExtraAssets((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const mutation = useMutation({
    mutationFn: async (data: AssetFormValues) => {
      if (isEditing) {
        return updateAsset(initialData.id, data);
      }
      if (extraAssets.length > 0) {
        const allAssets = [
          { tag: data.assetTag, serialNumber: data.serialNumber || "" },
          ...extraAssets,
        ].filter((a) => a.tag);
        return createAssets(data, allAssets);
      }
      return createAsset(data);
    },
    onSuccess: (result) => {
      if (isEditing) {
        toast.success("Asset updated");
        router.push(`/assets/registry/${(result as { id: string }).id}`);
      } else if (extraAssets.length > 0) {
        toast.success(`${extraAssets.length + 1} assets created`);
        router.push("/assets/registry");
      } else {
        toast.success("Asset created");
        router.push(`/assets/registry/${(result as { id: string }).id}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const models = modelsData?.models || [];
  const selectedModelId = form.watch("modelId");
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const totalCount = 1 + extraAssets.length;

  return (
    <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Equipment Model *</Label>
            <ComboboxPicker
              value={form.watch("modelId")}
              onChange={(v) => form.setValue("modelId", v, { shouldValidate: true })}
              options={models.map((m) => ({
                value: m.id,
                label: `${m.manufacturer ? `${m.manufacturer} ` : ""}${m.name}`,
                description: m.modelNumber || undefined,
              }))}
              placeholder="Select a model"
              searchPlaceholder="Search models..."
            />
            {form.formState.errors.modelId && (
              <p className="text-xs text-destructive">{form.formState.errors.modelId.message}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Label className="flex-none">Asset Tag *</Label>
              <Label className="flex-none text-muted-foreground">/ Serial Number</Label>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input {...form.register("assetTag")} placeholder="Asset tag" className="flex-1" />
                <Input {...form.register("serialNumber")} placeholder="Serial number" className="flex-1" />
                {!isEditing && (
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={addExtraAsset} title="Add another asset">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {form.formState.errors.assetTag && (
                <p className="text-xs text-destructive">{form.formState.errors.assetTag.message}</p>
              )}
              {extraAssets.map((asset, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={asset.tag}
                    onChange={(e) => updateExtraAsset(i, "tag", e.target.value)}
                    placeholder="Asset tag"
                    className="flex-1"
                  />
                  <Input
                    value={asset.serialNumber}
                    onChange={(e) => updateExtraAsset(i, "serialNumber", e.target.value)}
                    placeholder="Serial number"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => removeExtraAsset(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {extraAssets.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Creating {totalCount} assets with the same details
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customName">Custom Name</Label>
            <Input id="customName" {...form.register("customName")} placeholder="e.g. FOH Console 1" />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <ComboboxPicker
              value={form.watch("locationId") || ""}
              onChange={(v) => form.setValue("locationId", v)}
              options={locations.map((loc) => ({
                value: loc.id,
                label: loc.parent ? `${loc.parent.name} → ${loc.name}` : loc.name,
                description: loc.type,
              }))}
              placeholder="No location"
              searchPlaceholder="Search locations..."
              onCreateNew={() => setShowCreateLocation(true)}
              createNewLabel="New location"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              {...form.register("status")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="AVAILABLE">Available</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="IN_MAINTENANCE">In Maintenance</option>
              <option value="RESERVED">Reserved</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <select
              id="condition"
              {...form.register("condition")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="NEW">New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="purchaseDate">Purchase Date</Label>
            <Input id="purchaseDate" type="date" {...form.register("purchaseDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
            <Input id="purchasePrice" type="number" step="0.01" {...form.register("purchasePrice")} />
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <ComboboxPicker
              value={form.watch("supplierId") || ""}
              onChange={(v) => form.setValue("supplierId", v)}
              options={(suppliers as Array<{ id: string; name: string; contactName?: string | null }>).map((s) => ({
                value: s.id,
                label: s.name,
                description: s.contactName || undefined,
              }))}
              placeholder="No supplier"
              searchPlaceholder="Search suppliers..."
              onCreateNew={() => setShowCreateSupplier(true)}
              createNewLabel="New supplier"
              allowClear
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
            <Input id="warrantyExpiry" type="date" {...form.register("warrantyExpiry")} />
          </div>
        </CardContent>
      </Card>

      {selectedModel?.requiresTestAndTag && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test & Tag</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lastTestAndTagDate">Last Test & Tag Date</Label>
              <Input id="lastTestAndTagDate" type="date" {...form.register("lastTestAndTagDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" {...form.register("barcode")} placeholder="Auto-generated from asset tag" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" {...form.register("notes")} placeholder="Any additional notes" rows={3} className="mt-2" />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Update Asset" : totalCount > 1 ? `Create ${totalCount} Assets` : "Create Asset"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      <QuickCreateLocation
        open={showCreateLocation}
        onOpenChange={setShowCreateLocation}
        onCreated={(id) => form.setValue("locationId", id)}
      />
      <QuickCreateSupplier
        open={showCreateSupplier}
        onOpenChange={setShowCreateSupplier}
        onCreated={(id) => form.setValue("supplierId", id)}
      />
    </form>
  );
}
