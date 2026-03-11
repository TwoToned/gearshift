"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";

import { getClients } from "@/server/clients";
import { useTablePreferences } from "@/lib/use-table-preferences";
import { Button } from "@/components/ui/button";
import { CanDo } from "@/components/auth/permission-gate";
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
  COMPANY: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  INDIVIDUAL: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  VENUE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  PRODUCTION_COMPANY: "bg-green-500/10 text-green-500 border-green-500/20",
};

const typeLabels: Record<string, string> = {
  COMPANY: "Company",
  INDIVIDUAL: "Individual",
  VENUE: "Venue",
  PRODUCTION_COMPANY: "Production Co.",
};

export function ClientTable() {
  const { sortBy, sortOrder, pageSize, page, setPage, setPageSize, handleSort } =
    useTablePreferences("clients", { sortBy: "name", sortOrder: "asc" });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clients", { search, type, page, pageSize, sortBy, sortOrder }],
    queryFn: () => getClients({
      search: search || undefined,
      type: type || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder,
    }),
  });

  const clients = data?.clients || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, or email..."
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
          <option value="COMPANY">Company</option>
          <option value="INDIVIDUAL">Individual</option>
          <option value="VENUE">Venue</option>
          <option value="PRODUCTION_COMPANY">Production Company</option>
        </select>
        <CanDo resource="client" action="create">
          <Button render={<Link href="/clients/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        </CanDo>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Name</SortableTableHead>
              <SortableTableHead sortKey="type" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Type</SortableTableHead>
              <SortableTableHead sortKey="contactName" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Contact</SortableTableHead>
              <SortableTableHead sortKey="contactEmail" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Email</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Projects</SortableTableHead>
              <SortableTableHead sortKey="isActive" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Status</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={typeColors[client.type] || ""}>
                      {typeLabels[client.type] || client.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.contactName || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.contactEmail || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {client._count.projects}
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.isActive ? "default" : "destructive"}>
                      {client.isActive ? "Active" : "Archived"}
                    </Badge>
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
  );
}
