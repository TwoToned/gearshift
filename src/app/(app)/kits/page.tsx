"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";

import { getKits } from "@/server/kits";
import { getLocations } from "@/server/locations";
import { useTablePreferences } from "@/lib/use-table-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ComboboxPicker } from "@/components/ui/combobox-picker";
import { SortableTableHead, PageSizeSelect } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MediaThumbnail } from "@/components/media/media-thumbnail";
import { CanDo } from "@/components/auth/permission-gate";
import { RequirePermission } from "@/components/auth/require-permission";
import { useActiveOrganization } from "@/lib/auth-client";

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-500/10 text-green-500 border-green-500/20",
  CHECKED_OUT: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  IN_MAINTENANCE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  RETIRED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  INCOMPLETE: "bg-red-500/10 text-red-500 border-red-500/20",
};

const conditionColors: Record<string, string> = {
  NEW: "bg-green-500/10 text-green-500 border-green-500/20",
  GOOD: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  FAIR: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  POOR: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  DAMAGED: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function KitsPage() {
  const { sortBy, sortOrder, pageSize, page, setPage, setPageSize, handleSort } =
    useTablePreferences("kits", { sortBy: "assetTag", sortOrder: "asc" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: locationsData } = useQuery({
    queryKey: ["locations", orgId],
    queryFn: () => getLocations({ pageSize: 100 }),
  });
  const locations = locationsData?.locations || [];

  const { data, isLoading } = useQuery({
    queryKey: ["kits", orgId, { search, status, locationId, page, pageSize, sortBy, sortOrder }],
    queryFn: () =>
      getKits({
        search: search || undefined,
        status: status || undefined,
        locationId: locationId || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      }),
  });

  const kits = data?.kits || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  return (
    <RequirePermission resource="kit" action="read">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kits</h1>
          <p className="text-muted-foreground">
            Manage pre-configured kits and cases.
          </p>
        </div>
        <CanDo resource="kit" action="create">
          <Button render={<Link href="/kits/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            New Kit
          </Button>
        </CanDo>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tag or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="CHECKED_OUT">Checked Out</option>
          <option value="IN_MAINTENANCE">In Maintenance</option>
          <option value="RETIRED">Retired</option>
          <option value="INCOMPLETE">Incomplete</option>
        </select>
        <div className="w-48">
          <ComboboxPicker
            value={locationId}
            onChange={(v) => {
              setLocationId(v);
              setPage(1);
            }}
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
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="assetTag" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Asset Tag</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Name</SortableTableHead>
              <SortableTableHead sortKey="category" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Category</SortableTableHead>
              <SortableTableHead sortKey="status" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Status</SortableTableHead>
              <SortableTableHead sortKey="condition" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Condition</SortableTableHead>
              <SortableTableHead sortKey="location" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Location</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Items</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : kits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No kits found.
                </TableCell>
              </TableRow>
            ) : (
              kits.map((kit) => (
                <TableRow key={kit.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <MediaThumbnail
                        url={kit.media?.[0]?.file?.url}
                        thumbnailUrl={kit.media?.[0]?.file?.thumbnailUrl}
                        alt={kit.assetTag}
                        size={32}
                      />
                      <Link
                        href={`/kits/${kit.id}`}
                        className="font-mono font-medium text-sm hover:underline"
                      >
                        {kit.assetTag}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{kit.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {kit.category?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[kit.status] || ""}>
                      {kit.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={conditionColors[kit.condition] || ""}>
                      {kit.condition}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {kit.location?.name || "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {kit._count.serializedItems + kit._count.bulkItems}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
    </RequirePermission>
  );
}
