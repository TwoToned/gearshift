"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Wrench,
  CalendarClock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import {
  getMaintenanceRecords,
  deleteMaintenanceRecord,
} from "@/server/maintenance";
import { useTablePreferences } from "@/lib/use-table-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableTableHead, PageSizeSelect } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SCHEDULED: {
    label: "Scheduled",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: CalendarClock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Wrench,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
};

const typeLabels: Record<string, string> = {
  REPAIR: "Repair",
  PREVENTATIVE: "Preventative",
  TEST_AND_TAG: "Test & Tag",
  INSPECTION: "Inspection",
  CLEANING: "Cleaning",
  FIRMWARE_UPDATE: "Firmware Update",
};

const resultConfig: Record<string, { label: string; color: string }> = {
  PASS: { label: "Pass", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  FAIL: { label: "Fail", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  CONDITIONAL: {
    label: "Conditional",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
};

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const { sortBy, sortOrder, pageSize, page, setPage, setPageSize, handleSort } =
    useTablePreferences("maintenance", { sortBy: "", sortOrder: "asc" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance", search, statusFilter, typeFilter, page, pageSize, sortBy, sortOrder],
    queryFn: () =>
      getMaintenanceRecords({
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        page,
        pageSize,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaintenanceRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      toast.success("Record deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const records = (data?.records || []) as Record<string, unknown>[];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;
  const now = new Date();

  // Summary counts
  const overdueMaintenance = records.filter((r) => {
    if (r.status !== "SCHEDULED" && r.status !== "IN_PROGRESS") return false;
    return r.scheduledDate && new Date(r.scheduledDate as string) < now;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-muted-foreground">
            Track repairs, test &amp; tag, and preventative maintenance.
          </p>
        </div>
        <Link href="/maintenance/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Record
          </Button>
        </Link>
      </div>

      {overdueMaintenance > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium">
              {overdueMaintenance} overdue maintenance{" "}
              {overdueMaintenance === 1 ? "record" : "records"}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="REPAIR">Repair</SelectItem>
            <SelectItem value="PREVENTATIVE">Preventative</SelectItem>
            <SelectItem value="TEST_AND_TAG">Test &amp; Tag</SelectItem>
            <SelectItem value="INSPECTION">Inspection</SelectItem>
            <SelectItem value="CLEANING">Cleaning</SelectItem>
            <SelectItem value="FIRMWARE_UPDATE">Firmware Update</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="title" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Title</SortableTableHead>
              <SortableTableHead sortKey="asset" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Asset</SortableTableHead>
              <SortableTableHead sortKey="type" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Type</SortableTableHead>
              <SortableTableHead sortKey="status" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Status</SortableTableHead>
              <SortableTableHead sortKey="scheduledDate" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Scheduled</SortableTableHead>
              <SortableTableHead sortKey="result" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Result</SortableTableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No maintenance records found.
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => {
                const asset = record.asset as Record<string, unknown> | null;
                const model = asset?.model as Record<string, unknown> | null;
                const status = statusConfig[record.status as string];
                const isOverdue =
                  (record.status === "SCHEDULED" || record.status === "IN_PROGRESS") &&
                  record.scheduledDate &&
                  new Date(record.scheduledDate as string) < now;

                return (
                  <TableRow key={record.id as string}>
                    <TableCell>
                      <Link
                        href={`/maintenance/${record.id}`}
                        className="font-medium hover:underline"
                      >
                        {record.title as string}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {asset && (
                        <div>
                          <span className="font-mono text-xs">
                            {asset.assetTag as string}
                          </span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {model?.name as string}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {typeLabels[record.type as string] || (record.type as string)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${status?.color || ""} ${isOverdue ? "ring-1 ring-destructive/50" : ""}`}
                      >
                        {status?.label || (record.status as string)}
                        {isOverdue ? " (Overdue)" : null}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.scheduledDate
                        ? format(new Date(record.scheduledDate as string), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {record.result ? (
                        <Badge
                          variant="outline"
                          className={resultConfig[record.result as string]?.color || ""}
                        >
                          {resultConfig[record.result as string]?.label || (record.result as string)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {record.status === "CANCELLED" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            deleteMutation.mutate(record.id as string)
                          }
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
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
