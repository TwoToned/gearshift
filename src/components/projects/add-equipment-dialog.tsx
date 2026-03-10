"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Search } from "lucide-react";
import { toast } from "sonner";

import {
  lineItemSchema,
  type LineItemFormValues,
} from "@/lib/validations/line-item";
import { addLineItem, checkAvailability, lookupAssetByTag } from "@/server/line-items";
import { getModels } from "@/server/models";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboboxPicker } from "@/components/ui/combobox-picker";

type AddMode = "model" | "asset-tag";

interface AddEquipmentDialogProps {
  projectId: string;
  rentalStartDate?: Date;
  rentalEndDate?: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEquipmentDialog({
  projectId,
  rentalStartDate,
  rentalEndDate,
  open,
  onOpenChange,
}: AddEquipmentDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AddMode>("model");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [assetTagInput, setAssetTagInput] = useState("");
  const [lookupTag, setLookupTag] = useState("");

  const form = useForm<LineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      type: "EQUIPMENT",
      quantity: 1,
      pricingType: "PER_DAY",
      duration: 1,
      isOptional: false,
    },
  });

  const { data: modelsData } = useQuery({
    queryKey: ["models", { pageSize: 200 }],
    queryFn: () => getModels({ pageSize: 200 }),
    enabled: open,
  });

  const modelOptions = (modelsData?.models || []).map((m) => ({
    value: m.id,
    label: m.name,
    description: [m.manufacturer, m.modelNumber].filter(Boolean).join(" - ") || undefined,
  }));

  const selectedModel = modelsData?.models?.find(
    (m) => m.id === selectedModelId
  );

  // Model-based availability check
  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: [
      "availability",
      selectedModelId,
      rentalStartDate?.toISOString(),
      rentalEndDate?.toISOString(),
      projectId,
    ],
    queryFn: () =>
      checkAvailability(
        selectedModelId,
        rentalStartDate!,
        rentalEndDate!,
        projectId
      ),
    enabled: mode === "model" && !!selectedModelId && !!rentalStartDate && !!rentalEndDate,
  });

  // Asset tag lookup
  const { data: assetLookup, isLoading: lookupLoading } = useQuery({
    queryKey: [
      "asset-lookup",
      lookupTag,
      rentalStartDate?.toISOString(),
      rentalEndDate?.toISOString(),
      projectId,
    ],
    queryFn: () =>
      lookupAssetByTag(lookupTag, rentalStartDate, rentalEndDate, projectId),
    enabled: mode === "asset-tag" && lookupTag.length > 0,
  });

  // When a model is selected, update form fields
  useEffect(() => {
    if (selectedModel) {
      form.setValue("modelId", selectedModel.id);
      form.setValue("assetId", undefined);
      if (selectedModel.defaultRentalPrice != null) {
        form.setValue("unitPrice", Number(selectedModel.defaultRentalPrice));
      }
    }
  }, [selectedModel, form]);

  // When asset is looked up, populate form
  useEffect(() => {
    if (assetLookup?.found && assetLookup.asset) {
      const asset = assetLookup.asset;
      form.setValue("modelId", asset.modelId);
      form.setValue("assetId", asset.id);
      form.setValue("quantity", 1);
      if (asset.model.defaultRentalPrice != null) {
        form.setValue("unitPrice", Number(asset.model.defaultRentalPrice));
      }
      form.setValue("description", `${asset.model.name}${asset.customName ? ` (${asset.customName})` : ""} [${asset.assetTag}]`);
    }
  }, [assetLookup, form]);

  const mutation = useMutation({
    mutationFn: (data: LineItemFormValues) => addLineItem(projectId, data),
    onSuccess: () => {
      toast.success("Equipment added");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onOpenChange(false);
      resetState();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetState() {
    form.reset({
      type: "EQUIPMENT",
      quantity: 1,
      pricingType: "PER_DAY",
      duration: 1,
      isOptional: false,
    });
    setSelectedModelId("");
    setAssetTagInput("");
    setLookupTag("");
    setMode("model");
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  }

  function handleTagSearch() {
    const trimmed = assetTagInput.trim();
    if (trimmed) setLookupTag(trimmed);
  }

  function getAvailabilityColor() {
    if (!availability) return "";
    if (availability.available <= 0)
      return "text-red-600 dark:text-red-400";
    if (availability.available <= Math.ceil(availability.totalStock * 0.2))
      return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  }

  const requestedQty = Number(form.watch("quantity")) || 1;
  const modelAvailabilityBlocked = mode === "model" && availability && requestedQty > availability.available;
  const canSubmitModel = mode === "model" && !!selectedModelId && !modelAvailabilityBlocked;
  const canSubmitAsset = mode === "asset-tag" && assetLookup?.found && assetLookup.available;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-md border">
          <button
            type="button"
            onClick={() => { setMode("model"); setLookupTag(""); setAssetTagInput(""); }}
            className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${mode === "model" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            By Model
          </button>
          <button
            type="button"
            onClick={() => { setMode("asset-tag"); setSelectedModelId(""); }}
            className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${mode === "asset-tag" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            By Asset Tag
          </button>
        </div>

        <form
          onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
          className="space-y-4"
        >
          {mode === "model" && (
            <>
              {/* Model picker */}
              <div className="space-y-2">
                <Label>Model</Label>
                <ComboboxPicker
                  value={selectedModelId}
                  onChange={(val) => setSelectedModelId(val)}
                  options={modelOptions}
                  placeholder="Search models..."
                  searchPlaceholder="Search by name, manufacturer..."
                  emptyMessage="No models found."
                  allowClear
                />
              </div>

              {/* Availability */}
              {selectedModelId && rentalStartDate && rentalEndDate && (
                <div className="rounded-md border p-3 text-sm">
                  {availabilityLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking availability...
                    </div>
                  ) : availability ? (
                    <div className="space-y-1">
                      <p className={getAvailabilityColor()}>
                        <span className="font-semibold">{availability.available}</span>{" "}
                        available out of{" "}
                        <span className="font-semibold">{availability.totalStock}</span>{" "}
                        total
                      </p>
                      {availability.conflicts.length > 0 && (
                        <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <div>
                            <p className="font-medium">Conflicts:</p>
                            <ul className="list-disc pl-4">
                              {availability.conflicts.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {mode === "asset-tag" && (
            <>
              {/* Asset tag search */}
              <div className="space-y-2">
                <Label>Asset Tag</Label>
                <div className="flex gap-2">
                  <Input
                    value={assetTagInput}
                    onChange={(e) => setAssetTagInput(e.target.value)}
                    placeholder="e.g. TTP-AUD-001"
                    className="font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleTagSearch();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleTagSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Lookup result */}
              {lookupTag && (
                <div className="rounded-md border p-3 text-sm">
                  {lookupLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Looking up asset...
                    </div>
                  ) : assetLookup?.found && assetLookup.asset ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assetLookup.asset.model.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{assetLookup.asset.assetTag}</span>
                      </div>
                      {assetLookup.asset.customName && (
                        <p className="text-xs text-muted-foreground">{assetLookup.asset.customName}</p>
                      )}
                      {assetLookup.asset.serialNumber && (
                        <p className="text-xs text-muted-foreground">S/N: {assetLookup.asset.serialNumber}</p>
                      )}
                      {assetLookup.available ? (
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Available
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Not available{assetLookup.conflictsWith ? ` — ${assetLookup.conflictsWith}` : ""}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <XCircle className="h-3.5 w-3.5" />
                      No asset found with tag &quot;{lookupTag}&quot;
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eq-quantity">Quantity</Label>
              <Input
                id="eq-quantity"
                type="number"
                min={1}
                {...form.register("quantity")}
                disabled={mode === "asset-tag"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-unitPrice">Unit Price ($)</Label>
              <Input
                id="eq-unitPrice"
                type="number"
                step="0.01"
                min={0}
                {...form.register("unitPrice")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eq-pricingType">Pricing Type</Label>
              <select
                id="eq-pricingType"
                {...form.register("pricingType")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="PER_DAY">Per Day</option>
                <option value="PER_WEEK">Per Week</option>
                <option value="FLAT">Flat</option>
                <option value="PER_HOUR">Per Hour</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-duration">Duration</Label>
              <Input
                id="eq-duration"
                type="number"
                min={1}
                {...form.register("duration")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-groupName">Group Name</Label>
            <Input
              id="eq-groupName"
              {...form.register("groupName")}
              placeholder="e.g. Audio, Lighting"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-notes">Notes</Label>
            <Textarea
              id="eq-notes"
              {...form.register("notes")}
              placeholder="Additional notes"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="isOptional"
              render={({ field }) => (
                <Checkbox
                  id="eq-isOptional"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="eq-isOptional" className="text-sm font-normal">
              Optional item (excluded from totals)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                (mode === "model" && !canSubmitModel) ||
                (mode === "asset-tag" && !canSubmitAsset)
              }
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add to Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
