"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";

import { getKits } from "@/server/kits";
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => getLocations(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["kits", { search, status, locationId, page }],
    queryFn: () =>
      getKits({
        search: search || undefined,
        status: status || undefined,
        locationId: locationId || undefined,
        page,
      }),
  });

  const kits = data?.kits || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kits</h1>
          <p className="text-muted-foreground">
            Manage pre-configured kits and cases.
          </p>
        </div>
        <Button render={<Link href="/kits/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Kit
        </Button>
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
              <TableHead>Asset Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Items</TableHead>
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
                    <Link
                      href={`/kits/${kit.id}`}
                      className="font-mono font-medium text-sm hover:underline"
                    >
                      {kit.assetTag}
                    </Link>
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
