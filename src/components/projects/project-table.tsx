"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";

import { getProjects } from "@/server/projects";
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

const statusColors: Record<string, string> = {
  ENQUIRY: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  QUOTING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  QUOTED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  CONFIRMED: "bg-green-500/10 text-green-500 border-green-500/20",
  PREPPING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  CHECKED_OUT: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ON_SITE: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  RETURNED: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  COMPLETED: "bg-green-500/10 text-green-500 border-green-500/20",
  INVOICED: "bg-green-500/10 text-green-500 border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  ENQUIRY: "Enquiry",
  QUOTING: "Quoting",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  PREPPING: "Prepping",
  CHECKED_OUT: "Checked Out",
  ON_SITE: "On Site",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  INVOICED: "Invoiced",
  CANCELLED: "Cancelled",
};

const typeLabels: Record<string, string> = {
  DRY_HIRE: "Dry Hire",
  WET_HIRE: "Wet Hire",
  INSTALLATION: "Installation",
  TOUR: "Tour",
  CORPORATE: "Corporate",
  THEATRE: "Theatre",
  FESTIVAL: "Festival",
  CONFERENCE: "Conference",
  OTHER: "Other",
};

const typeColors: Record<string, string> = {
  DRY_HIRE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  WET_HIRE: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  INSTALLATION: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  TOUR: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  CORPORATE: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  THEATRE: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  FESTIVAL: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  CONFERENCE: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  OTHER: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined
) {
  if (!start && !end) return "—";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function ProjectTable() {
  const { sortBy, sortOrder, pageSize, page, setPage, setPageSize, handleSort } =
    useTablePreferences("projects", { sortBy: "createdAt", sortOrder: "desc" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["projects", { search, status, type, page, pageSize, sortBy, sortOrder }],
    queryFn: () =>
      getProjects({
        search: search || undefined,
        status: status || undefined,
        type: type || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      }),
  });

  const projects = data?.projects || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, project #, or location..."
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
          <option value="ENQUIRY">Enquiry</option>
          <option value="QUOTING">Quoting</option>
          <option value="QUOTED">Quoted</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PREPPING">Prepping</option>
          <option value="CHECKED_OUT">Checked Out</option>
          <option value="ON_SITE">On Site</option>
          <option value="RETURNED">Returned</option>
          <option value="COMPLETED">Completed</option>
          <option value="INVOICED">Invoiced</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All Types</option>
          <option value="DRY_HIRE">Dry Hire</option>
          <option value="WET_HIRE">Wet Hire</option>
          <option value="INSTALLATION">Installation</option>
          <option value="TOUR">Tour</option>
          <option value="CORPORATE">Corporate</option>
          <option value="THEATRE">Theatre</option>
          <option value="FESTIVAL">Festival</option>
          <option value="CONFERENCE">Conference</option>
          <option value="OTHER">Other</option>
        </select>
        <Button render={<Link href="/projects/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="projectNumber" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Project #</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Name</SortableTableHead>
              <SortableTableHead sortKey="client" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Client</SortableTableHead>
              <SortableTableHead sortKey="type" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Type</SortableTableHead>
              <SortableTableHead sortKey="status" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Status</SortableTableHead>
              <SortableTableHead sortKey="rentalStartDate" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Dates</SortableTableHead>
              <SortableTableHead sortKey="total" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Total</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No projects found.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {project.projectNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.client?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={typeColors[project.type] || ""}
                    >
                      {typeLabels[project.type] || project.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[project.status] || ""}
                    >
                      {statusLabels[project.status] || project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateRange(
                      project.rentalStartDate as string | null,
                      project.rentalEndDate as string | null
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {(project.invoicedTotal != null || project.total != null)
                      ? `$${Number(project.invoicedTotal ?? project.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                      : "—"}
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
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
