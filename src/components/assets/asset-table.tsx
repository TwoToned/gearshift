"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, Loader2, Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { getAssets, bulkUpdateAssets } from "@/server/assets";
import { getBulkAssets } from "@/server/bulk-assets";
import { getLocations } from "@/server/locations";
import { exportAssetsCSV, exportBulkAssetsCSV } from "@/server/csv";
import { CSVImportDialog } from "@/components/assets/csv-import-dialog";
import { useTablePreferences } from "@/lib/use-table-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboboxPicker } from "@/components/ui/combobox-picker";
import { SortableTableHead, PageSizeSelect } from "@/components/ui/sortable-table-head";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MediaThumbnail } from "@/components/media/media-thumbnail";

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-500/10 text-green-500 border-green-500/20",
  CHECKED_OUT: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  IN_MAINTENANCE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  RESERVED: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  RETIRED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  LOST: "bg-red-500/10 text-red-500 border-red-500/20",
  ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
  LOW_STOCK: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  OUT_OF_STOCK: "bg-red-500/10 text-red-500 border-red-500/20",
};

const conditionColors: Record<string, string> = {
  NEW: "bg-green-500/10 text-green-500 border-green-500/20",
  GOOD: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  FAIR: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  POOR: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  DAMAGED: "bg-red-500/10 text-red-500 border-red-500/20",
};

type ViewMode = "serialized" | "bulk";

export function AssetTable() {
  const { sortBy, sortOrder, pageSize, view, page, setPage, setPageSize, setView, handleSort } =
    useTablePreferences("assets", { sortBy: "assetTag", sortOrder: "asc", view: "serialized" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => getLocations(),
  });

  const serializedQuery = useQuery({
    queryKey: ["assets", { search, status, locationId, page, pageSize, sortBy, sortOrder }],
    queryFn: () => getAssets({
      search: search || undefined,
      status: status || undefined,
      locationId: locationId || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder,
    }),
    enabled: view === "serialized",
  });

  const bulkQuery = useQuery({
    queryKey: ["bulk-assets", { search, status, locationId, page, pageSize, sortBy, sortOrder }],
    queryFn: () => getBulkAssets({
      search: search || undefined,
      status: status || undefined,
      locationId: locationId || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder,
    }),
    enabled: view === "bulk",
  });

  const isLoading = view === "serialized" ? serializedQuery.isLoading : bulkQuery.isLoading;
  const totalPages = view === "serialized"
    ? serializedQuery.data?.totalPages || 1
    : bulkQuery.data?.totalPages || 1;
  const total = view === "serialized"
    ? serializedQuery.data?.total || 0
    : bulkQuery.data?.total || 0;

  const assets = serializedQuery.data?.assets || [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkEditOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* View Toggle + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-md border">
          <button
            onClick={() => { setView("serialized"); setStatus(""); setSelectedIds(new Set()); }}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === "serialized" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            Serialized
          </button>
          <button
            onClick={() => { setView("bulk"); setStatus(""); setSelectedIds(new Set()); }}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === "bulk" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            Bulk
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tag, serial, or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          {view === "serialized" ? (
            <>
              <option value="AVAILABLE">Available</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="IN_MAINTENANCE">In Maintenance</option>
              <option value="RESERVED">Reserved</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
            </>
          ) : (
            <>
              <option value="ACTIVE">Active</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="RETIRED">Retired</option>
            </>
          )}
        </select>
        <div className="w-48">
          <ComboboxPicker
            value={locationId}
            onChange={(v) => { setLocationId(v); setPage(1); }}
            options={locations.map((loc) => ({
              value: loc.id,
              label: loc.parent ? `${loc.parent.name} → ${loc.name}` : loc.name,
              description: loc.type,
            }))}
            placeholder="All Locations"
            searchPlaceholder="Search locations..."
            allowClear
          />
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            const csv = view === "serialized" ? await exportAssetsCSV() : await exportBulkAssetsCSV();
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = view === "serialized" ? "assets.csv" : "bulk-assets.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button render={<Link href={`/assets/registry/new?type=${view}`} />}>
          <Plus className="mr-2 h-4 w-4" />
          New {view === "serialized" ? "Asset" : "Bulk Asset"}
        </Button>
      </div>

      {/* Bulk Edit Bar */}
      {view === "serialized" && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)}>
            <Pencil className="mr-2 h-3 w-3" />
            Bulk Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Serialized Table */}
      {view === "serialized" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={assets.length > 0 && selectedIds.size === assets.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < assets.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <SortableTableHead sortKey="assetTag" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Asset Tag</SortableTableHead>
                <SortableTableHead sortKey="model" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Model</SortableTableHead>
                <SortableTableHead sortKey="serialNumber" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Serial #</SortableTableHead>
                <SortableTableHead sortKey="status" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="condition" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Condition</SortableTableHead>
                <SortableTableHead sortKey="location" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Location</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No assets found.
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => (
                  <TableRow key={asset.id} className={selectedIds.has(asset.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(asset.id)}
                        onCheckedChange={() => toggleSelect(asset.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MediaThumbnail
                          url={asset.media?.[0]?.file?.url || asset.model?.media?.[0]?.file?.url}
                          thumbnailUrl={asset.media?.[0]?.file?.thumbnailUrl || asset.model?.media?.[0]?.file?.thumbnailUrl}
                          alt={asset.assetTag}
                          size={32}
                        />
                        <div>
                          <Link href={`/assets/registry/${asset.id}`} className="font-mono font-medium text-sm hover:underline">
                            {asset.assetTag}
                          </Link>
                          {asset.customName && (
                            <p className="text-xs text-muted-foreground">{asset.customName}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/assets/models/${asset.modelId}`} className="hover:underline">
                        {asset.model.name}
                      </Link>
                      {asset.model.category && (
                        <p className="text-xs text-muted-foreground">{asset.model.category.name}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {asset.serialNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[asset.status] || ""}>
                        {asset.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={conditionColors[asset.condition] || ""}>
                        {asset.condition}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {asset.location?.name || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk Table */}
      {view === "bulk" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="assetTag" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Asset Tag</SortableTableHead>
                <SortableTableHead sortKey="model" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Model</SortableTableHead>
                <SortableTableHead sortKey="availableQuantity" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Available</SortableTableHead>
                <SortableTableHead sortKey="totalQuantity" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Total</SortableTableHead>
                <SortableTableHead sortKey="status" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="location" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Location</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : (bulkQuery.data?.bulkAssets || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No bulk assets found.
                  </TableCell>
                </TableRow>
              ) : (
                (bulkQuery.data?.bulkAssets || []).map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link href={`/assets/registry/${asset.id}?type=bulk`} className="font-mono font-medium text-sm hover:underline">
                        {asset.assetTag}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/assets/models/${asset.modelId}`} className="hover:underline">
                        {asset.model.name}
                      </Link>
                      {asset.model.category && (
                        <p className="text-xs text-muted-foreground">{asset.model.category.name}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{asset.availableQuantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{asset.totalQuantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[asset.status] || ""}>
                        {asset.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {asset.location?.name || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <PageSizeSelect value={pageSize} onChange={(s) => { setPageSize(s); setPage(1); }} />
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={selectedIds}
        locations={locations}
        onSuccess={() => {
          clearSelection();
          queryClient.invalidateQueries({ queryKey: ["assets"] });
        }}
      />

      <CSVImportDialog type="assets" open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function BulkEditDialog({
  open,
  onOpenChange,
  selectedIds,
  locations,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  locations: Array<{ id: string; name: string; type: string; parent?: { name: string } | null }>;
  onSuccess: () => void;
}) {
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCondition, setBulkCondition] = useState("");
  const [bulkLocationId, setBulkLocationId] = useState<string | undefined>(undefined);

  const mutation = useMutation({
    mutationFn: () =>
      bulkUpdateAssets(Array.from(selectedIds), {
        status: bulkStatus || undefined,
        condition: bulkCondition || undefined,
        locationId: bulkLocationId,
      }),
    onSuccess: (result) => {
      toast.success(`Updated ${result.count} assets`);
      setBulkStatus("");
      setBulkCondition("");
      setBulkLocationId(undefined);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const hasChanges = bulkStatus || bulkCondition || bulkLocationId !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Edit {selectedIds.size} Assets</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Only fields you change will be updated. Leave a field unchanged to keep existing values.
        </p>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— No change —</option>
              <option value="AVAILABLE">Available</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="IN_MAINTENANCE">In Maintenance</option>
              <option value="RESERVED">Reserved</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Condition</Label>
            <select
              value={bulkCondition}
              onChange={(e) => setBulkCondition(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— No change —</option>
              <option value="NEW">New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <ComboboxPicker
              value={bulkLocationId ?? ""}
              onChange={(v) => setBulkLocationId(v)}
              options={locations.map((loc) => ({
                value: loc.id,
                label: loc.parent ? `${loc.parent.name} → ${loc.name}` : loc.name,
                description: loc.type,
              }))}
              placeholder="— No change —"
              searchPlaceholder="Search locations..."
              allowClear
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !hasChanges}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update {selectedIds.size} Assets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
