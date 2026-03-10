"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";

import { getAssets } from "@/server/assets";
import { getBulkAssets } from "@/server/bulk-assets";
import { getLocations } from "@/server/locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ComboboxPicker } from "@/components/ui/combobox-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [view, setView] = useState<ViewMode>("serialized");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => getLocations(),
  });

  const serializedQuery = useQuery({
    queryKey: ["assets", { search, status, locationId, page }],
    queryFn: () => getAssets({
      search: search || undefined,
      status: status || undefined,
      locationId: locationId || undefined,
      page,
    }),
    enabled: view === "serialized",
  });

  const bulkQuery = useQuery({
    queryKey: ["bulk-assets", { search, status, locationId, page }],
    queryFn: () => getBulkAssets({
      search: search || undefined,
      status: status || undefined,
      locationId: locationId || undefined,
      page,
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

  return (
    <div className="space-y-4">
      {/* View Toggle + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-md border">
          <button
            onClick={() => { setView("serialized"); setPage(1); setStatus(""); }}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === "serialized" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            Serialized
          </button>
          <button
            onClick={() => { setView("bulk"); setPage(1); setStatus(""); }}
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
        <Button render={<Link href={`/assets/registry/new?type=${view}`} />}>
          <Plus className="mr-2 h-4 w-4" />
          New {view === "serialized" ? "Asset" : "Bulk Asset"}
        </Button>
      </div>

      {/* Serialized Table */}
      {view === "serialized" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : (serializedQuery.data?.assets || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No assets found.
                  </TableCell>
                </TableRow>
              ) : (
                (serializedQuery.data?.assets || []).map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link href={`/assets/registry/${asset.id}`} className="font-mono font-medium text-sm hover:underline">
                        {asset.assetTag}
                      </Link>
                      {asset.customName && (
                        <p className="text-xs text-muted-foreground">{asset.customName}</p>
                      )}
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
                <TableHead>Asset Tag</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
