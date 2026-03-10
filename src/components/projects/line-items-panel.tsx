"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Wrench,
  Users,
  Truck,
  MoreHorizontal,
  Plus,
  Trash2,
  Pencil,
  Star,
  Container,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { getProject } from "@/server/projects";
import { removeLineItem, addKitLineItem, checkKitAvailability } from "@/server/line-items";
import { getKits } from "@/server/kits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ComboboxPicker } from "@/components/ui/combobox-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddEquipmentDialog } from "./add-equipment-dialog";
import { AddServiceDialog } from "./add-service-dialog";
import { EditLineItemDialog } from "./edit-line-item-dialog";

interface LineItemsPanelProps {
  projectId: string;
  rentalStartDate?: Date;
  rentalEndDate?: Date;
}

const typeIcons: Record<string, React.ElementType> = {
  EQUIPMENT: Package,
  SERVICE: Wrench,
  LABOUR: Users,
  TRANSPORT: Truck,
  MISC: MoreHorizontal,
};

const typeLabels: Record<string, string> = {
  EQUIPMENT: "Equipment",
  SERVICE: "Service",
  LABOUR: "Labour",
  TRANSPORT: "Transport",
  MISC: "Misc",
};

const pricingLabels: Record<string, string> = {
  PER_DAY: "/day",
  PER_WEEK: "/week",
  FLAT: "flat",
  PER_HOUR: "/hr",
};

const statusColors: Record<string, string> = {
  QUOTED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  CONFIRMED: "bg-green-500/10 text-green-500 border-green-500/20",
  PREPPED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  CHECKED_OUT: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  RETURNED: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "--";
  return `$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

export function LineItemsPanel({
  projectId,
  rentalStartDate,
  rentalEndDate,
}: LineItemsPanelProps) {
  const queryClient = useQueryClient();
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [kitDialogOpen, setKitDialogOpen] = useState(false);
  const [selectedKitId, setSelectedKitId] = useState("");
  const [kitPricingMode, setKitPricingMode] = useState<"KIT_PRICE" | "ITEMIZED">("KIT_PRICE");
  const [kitUnitPrice, setKitUnitPrice] = useState("");
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<(typeof lineItems)[0] | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

  const { data: kitsData } = useQuery({
    queryKey: ["kits"],
    queryFn: () => getKits({ pageSize: 200 }),
    enabled: kitDialogOpen,
  });

  const { data: kitAvailability } = useQuery({
    queryKey: ["kit-availability", selectedKitId, rentalStartDate?.toISOString(), rentalEndDate?.toISOString(), projectId],
    queryFn: () => checkKitAvailability(selectedKitId, rentalStartDate!, rentalEndDate!, projectId),
    enabled: kitDialogOpen && !!selectedKitId && !!rentalStartDate && !!rentalEndDate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeLineItem(id),
    onSuccess: () => {
      toast.success("Line item removed");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const addKitMutation = useMutation({
    mutationFn: () =>
      addKitLineItem(
        projectId,
        selectedKitId,
        kitPricingMode,
        kitPricingMode === "KIT_PRICE" && kitUnitPrice
          ? parseFloat(kitUnitPrice)
          : undefined
      ),
    onSuccess: () => {
      toast.success("Kit added to project");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setKitDialogOpen(false);
      setSelectedKitId("");
      setKitPricingMode("KIT_PRICE");
      setKitUnitPrice("");
    },
    onError: (e) => toast.error(e.message),
  });

  const lineItems = project?.lineItems || [];

  // Filter out kit child items — they render under their parent
  const topLevelItems = lineItems.filter((item) => !item.isKitChild);

  // Group items by groupName
  const grouped = new Map<string, typeof topLevelItems>();
  const ungrouped: typeof topLevelItems = [];

  for (const item of topLevelItems) {
    if (item.groupName) {
      const existing = grouped.get(item.groupName) || [];
      existing.push(item);
      grouped.set(item.groupName, existing);
    } else {
      ungrouped.push(item);
    }
  }

  function toggleKitExpanded(kitItemId: string) {
    setExpandedKits((prev) => {
      const next = new Set(prev);
      if (next.has(kitItemId)) {
        next.delete(kitItemId);
      } else {
        next.add(kitItemId);
      }
      return next;
    });
  }

  function renderItemRow(item: (typeof lineItems)[0]) {
    const isKitParent = !!item.kitId && !item.isKitChild;
    const Icon = isKitParent ? Container : (typeIcons[item.type] || Package);
    const itemName =
      isKitParent
        ? item.description || "Unnamed Kit"
        : item.type === "EQUIPMENT"
          ? [item.model?.name, item.model?.modelNumber]
              .filter(Boolean)
              .join(" - ") || item.description || "Unnamed item"
          : item.description || "Unnamed item";
    const isExpanded = expandedKits.has(item.id);
    const childItems = isKitParent ? (item.childLineItems || []) : [];

    return (
      <React.Fragment key={item.id}>
        <TableRow className={isKitParent ? "bg-muted/30" : undefined}>
          <TableCell>
            <div className="flex items-center gap-2">
              {isKitParent ? (
                <button
                  type="button"
                  onClick={() => toggleKitExpanded(item.id)}
                  className="flex items-center gap-1.5 text-left"
                >
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{itemName}</span>
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                    >
                      Kit
                    </Badge>
                    {item.pricingMode === "ITEMIZED" && (
                      <Badge
                        variant="outline"
                        className="ml-1 text-xs"
                      >
                        Itemized
                      </Badge>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {childItems.length} item{childItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ) : (
                <>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{itemName}</span>
                    {item.isOptional && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-xs bg-amber-500/10 text-amber-600 border-amber-500/20"
                      >
                        Optional
                      </Badge>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </TableCell>
          <TableCell className="text-center">{item.quantity}</TableCell>
          <TableCell className="text-right">
            {formatCurrency(item.unitPrice as number | null)}
            {item.unitPrice != null && (
              <span className="text-xs text-muted-foreground ml-0.5">
                {pricingLabels[item.pricingType]}
              </span>
            )}
          </TableCell>
          <TableCell className="text-center">{item.duration}</TableCell>
          <TableCell className="text-right font-medium">
            {formatCurrency(item.lineTotal as number | null)}
          </TableCell>
          <TableCell>
            <Badge
              variant="outline"
              className={statusColors[item.status] || ""}
            >
              {item.status}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              {!isKitParent && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditingItem(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const msg = isKitParent
                    ? "Remove this kit and all its items?"
                    : "Remove this line item?";
                  if (confirm(msg)) {
                    deleteMutation.mutate(item.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {isKitParent && isExpanded && (childItems as Array<{ id: string; model?: { name: string } | null; description?: string | null; asset?: { assetTag: string } | null; quantity: number; duration: number; unitPrice?: unknown; lineTotal?: unknown }>).map((child) => (
          <TableRow key={child.id} className="bg-muted/10">
            <TableCell>
              <div className="flex items-center gap-2 pl-8">
                <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <span className="text-sm">{child.model?.name || child.description || "Unnamed"}</span>
                  {child.asset?.assetTag && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({child.asset.assetTag})
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-center text-sm">{child.quantity}</TableCell>
            <TableCell className="text-right text-sm">
              {formatCurrency(child.unitPrice as number | null)}
            </TableCell>
            <TableCell className="text-center text-sm">{child.duration}</TableCell>
            <TableCell className="text-right text-sm">
              {formatCurrency(child.lineTotal as number | null)}
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        ))}
      </React.Fragment>
    );
  }

  function renderTable(items: typeof lineItems, groupTitle?: string) {
    return (
      <div key={groupTitle || "__ungrouped"}>
        {groupTitle && (
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 mt-4 first:mt-0">
            {groupTitle}
          </h3>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center w-16">Qty</TableHead>
                <TableHead className="text-right w-28">Unit Price</TableHead>
                <TableHead className="text-center w-20">Duration</TableHead>
                <TableHead className="text-right w-28">Total</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>{items.map(renderItemRow)}</TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setEquipmentDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Equipment
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setServiceDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Service / Other
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setKitDialogOpen(true)}
        >
          <Container className="mr-1.5 h-4 w-4" />
          Add Kit
        </Button>
      </div>

      {topLevelItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No line items yet.</p>
            <p className="text-xs mt-1">
              Add equipment, services, and labour to this project.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Ungrouped items first */}
          {ungrouped.length > 0 && renderTable(ungrouped)}

          {/* Grouped items */}
          {[...grouped.entries()].map(([groupName, items]) =>
            renderTable(items, groupName)
          )}

          {/* Totals */}
          {project && (
            <Card>
              <CardContent className="py-4">
                <div className="space-y-1 text-sm max-w-xs ml-auto">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(project.subtotal as number | null)}
                    </span>
                  </div>
                  {project.discountPercent != null &&
                    Number(project.discountPercent) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          Discount ({Number(project.discountPercent)}%)
                        </span>
                        <span>
                          -{formatCurrency(project.discountAmount as number | null)}
                        </span>
                      </div>
                    )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST (10%)</span>
                    <span>
                      {formatCurrency(project.taxAmount as number | null)}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold">
                      {formatCurrency(project.total as number | null)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AddEquipmentDialog
        projectId={projectId}
        rentalStartDate={rentalStartDate}
        rentalEndDate={rentalEndDate}
        open={equipmentDialogOpen}
        onOpenChange={setEquipmentDialogOpen}
      />

      <AddServiceDialog
        projectId={projectId}
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
      />

      <EditLineItemDialog
        projectId={projectId}
        lineItem={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      />

      {/* Add Kit Dialog */}
      <Dialog
        open={kitDialogOpen}
        onOpenChange={(open) => {
          setKitDialogOpen(open);
          if (!open) {
            setSelectedKitId("");
            setKitPricingMode("KIT_PRICE");
            setKitUnitPrice("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Kit to Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Kit</Label>
              <ComboboxPicker
                value={selectedKitId}
                onChange={setSelectedKitId}
                options={
                  (kitsData?.kits || []).map((kit) => ({
                    value: kit.id,
                    label: `${kit.assetTag} — ${kit.name}`,
                    description: kit.category?.name,
                  }))
                }
                placeholder="Select a kit..."
                searchPlaceholder="Search kits..."
                emptyMessage="No kits found."
              />
            </div>

            {selectedKitId && kitAvailability && !kitAvailability.available && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                Kit is unavailable: {kitAvailability.conflictsWith}
              </div>
            )}

            <div className="space-y-2">
              <Label>Pricing Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kitPricingMode"
                    value="KIT_PRICE"
                    checked={kitPricingMode === "KIT_PRICE"}
                    onChange={() => setKitPricingMode("KIT_PRICE")}
                    className="accent-primary"
                  />
                  Kit Price
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kitPricingMode"
                    value="ITEMIZED"
                    checked={kitPricingMode === "ITEMIZED"}
                    onChange={() => setKitPricingMode("ITEMIZED")}
                    className="accent-primary"
                  />
                  Itemized
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {kitPricingMode === "KIT_PRICE"
                  ? "One price for the whole kit."
                  : "Each item in the kit priced individually."}
              </p>
            </div>

            {kitPricingMode === "KIT_PRICE" && (
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={kitUnitPrice}
                  onChange={(e) => setKitUnitPrice(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => addKitMutation.mutate()}
              disabled={!selectedKitId || addKitMutation.isPending || (kitAvailability && !kitAvailability.available)}
            >
              {addKitMutation.isPending ? "Adding..." : "Add Kit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
