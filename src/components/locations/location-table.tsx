"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Star } from "lucide-react";

import { getLocations } from "@/server/locations";
import { useTablePreferences } from "@/lib/use-table-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SortableTableHead, PageSizeSelect } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const typeColors: Record<string, string> = {
  WAREHOUSE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  VENUE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  VEHICLE: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  OFFSITE: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const typeLabels: Record<string, string> = {
  WAREHOUSE: "Warehouse",
  VENUE: "Venue",
  VEHICLE: "Vehicle",
  OFFSITE: "Offsite",
};

export function LocationTable() {
  const { sortBy, sortOrder, pageSize, page, setPage, setPageSize, handleSort } =
    useTablePreferences("locations", { sortBy: "name", sortOrder: "asc" });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["locations", { search, type, page, pageSize, sortBy, sortOrder }],
    queryFn: () => getLocations({
      search: search || undefined,
      type: type || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder,
    }),
  });

  const locations = data?.locations || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or address..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All Types</option>
          <option value="WAREHOUSE">Warehouse</option>
          <option value="VENUE">Venue</option>
          <option value="VEHICLE">Vehicle</option>
          <option value="OFFSITE">Offsite</option>
        </select>
        <Button render={<Link href="/locations/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Location
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Name</SortableTableHead>
              <SortableTableHead sortKey="type" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Type</SortableTableHead>
              <SortableTableHead sortKey="address" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Address</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Assets</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Parent</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No locations found.
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => {
                const assetCount = (location._count?.assets || 0) + (location._count?.bulkAssets || 0) + (location._count?.kits || 0);
                return (
                  <TableRow key={location.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/locations/${location.id}`} className="font-medium hover:underline">
                          {location.name}
                        </Link>
                        {location.isDefault && (
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColors[location.type] || ""}>
                        {typeLabels[location.type] || location.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.address || "\u2014"}
                    </TableCell>
                    <TableCell className="text-right">
                      {assetCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.parent?.name || "\u2014"}
                    </TableCell>
                  </TableRow>
                );
              })
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
  );
}
