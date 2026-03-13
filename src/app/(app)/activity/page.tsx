"use client";

import React, { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, X, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { getActivityLogs, exportActivityLogCSV } from "@/server/activity-log";
import { useTablePreferences } from "@/lib/use-table-preferences";
import { useActiveOrganization } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const actionColors: Record<string, string> = {
  CREATE: "bg-emerald-500/15 text-emerald-500",
  UPDATE: "bg-blue-500/15 text-blue-500",
  DELETE: "bg-red-500/15 text-red-500",
  STATUS_CHANGE: "bg-purple-500/15 text-purple-500",
  CHECK_OUT: "bg-amber-500/15 text-amber-500",
  CHECK_IN: "bg-amber-500/15 text-amber-500",
  SCAN: "bg-gray-500/15 text-gray-500",
  ASSIGN: "bg-teal-500/15 text-teal-500",
  UNASSIGN: "bg-teal-500/15 text-teal-500",
  EXPORT: "bg-blue-500/15 text-blue-500",
  IMPORT: "bg-blue-500/15 text-blue-500",
  INVITE: "bg-purple-500/15 text-purple-500",
};

const entityTypeLabels: Record<string, string> = {
  asset: "Asset",
  bulkAsset: "Bulk Asset",
  model: "Model",
  kit: "Kit",
  project: "Project",
  client: "Client",
  location: "Location",
  category: "Category",
  supplier: "Supplier",
  maintenance: "Maintenance",
  testTagAsset: "T&T Asset",
  testTagRecord: "T&T Record",
  lineItem: "Line Item",
  member: "Member",
  invitation: "Invitation",
  settings: "Settings",
};

const actionLabels: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  STATUS_CHANGE: "Status Change",
  CHECK_OUT: "Check Out",
  CHECK_IN: "Check In",
  ASSIGN: "Assign",
  UNASSIGN: "Unassign",
  EXPORT: "Export",
  IMPORT: "Import",
  INVITE: "Invite",
};

function formatDetails(details: unknown): { field: string; from: string; to: string }[] | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;

  // Handle "changes" array format: [{ field, from, to }]
  if (Array.isArray(d.changes)) {
    return d.changes.map((c: Record<string, unknown>) => ({
      field: String(c.field ?? ""),
      from: String(c.from ?? ""),
      to: String(c.to ?? ""),
    }));
  }

  // Handle flat object with before/after or old/new keys
  if (d.before && d.after && typeof d.before === "object" && typeof d.after === "object") {
    const before = d.before as Record<string, unknown>;
    const after = d.after as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changes: { field: string; from: string; to: string }[] = [];
    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push({
          field: key,
          from: String(before[key] ?? ""),
          to: String(after[key] ?? ""),
        });
      }
    }
    return changes.length > 0 ? changes : null;
  }

  // Fallback: show raw key-value pairs
  const entries = Object.entries(d);
  if (entries.length === 0) return null;
  return entries.map(([key, value]) => ({
    field: key,
    from: "",
    to: String(value ?? ""),
  }));
}

function ActivityLogContent() {
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { sortBy, sortOrder, pageSize, page, setPage, setPageSize, handleSort } =
    useTablePreferences("activity-log", { sortBy: "createdAt", sortOrder: "desc" });

  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const hasFilters = search || entityType !== "all" || action !== "all" || startDate || endDate;

  const filters = {
    search: search || undefined,
    entityType: entityType !== "all" ? entityType : undefined,
    action: action !== "all" ? action : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize,
    sort: sortBy || "createdAt",
    order: sortOrder,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", orgId, filters],
    queryFn: () => getActivityLogs(filters),
    enabled: !!orgId,
  });

  const items = (data?.items || []) as Record<string, unknown>[];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setEntityType("all");
    setAction("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const csv = await exportActivityLogCSV({
        search: search || undefined,
        entityType: entityType !== "all" ? entityType : undefined,
        action: action !== "all" ? action : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Activity log exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground">
            Track all changes and actions across your organization.
          </p>
        </div>
        <Button onClick={handleExport} disabled={isExporting} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activity..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={entityType}
          onValueChange={(v) => {
            setEntityType(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue>
              {entityType === "all" ? "All Types" : entityTypeLabels[entityType] || entityType}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(entityTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue>
              {action === "all" ? "All Actions" : actionLabels[action] || action}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(actionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="w-[160px]"
          placeholder="Start date"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="w-[160px]"
          placeholder="End date"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <SortableTableHead
                sortKey="createdAt"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              >
                Timestamp
              </SortableTableHead>
              <TableHead className="hidden sm:table-cell">User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="hidden md:table-cell">Entity Type</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No activity logs found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const id = item.id as string;
                const isExpanded = expandedRows.has(id);
                const user = item.user as Record<string, unknown> | null;
                const actionStr = item.action as string;
                const details = item.details;
                const hasDetails = !!(details && typeof details === "object" && Object.keys(details as object).length > 0);
                const parsedDetails = isExpanded ? formatDetails(details) : null;

                return (
                  <React.Fragment key={id}>
                    <TableRow
                      className={`cursor-pointer hover:bg-muted/50 ${hasDetails ? "" : "cursor-default"}`}
                      onClick={() => hasDetails && toggleRow(id)}
                    >
                      <TableCell className="w-8 px-2">
                        {hasDetails && (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(item.createdAt as string), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {user?.name as string || item.userName as string || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={actionColors[actionStr] || "bg-gray-500/15 text-gray-500"}
                        >
                          {actionLabels[actionStr] || actionStr}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {entityTypeLabels[item.entityType as string] || (item.entityType as string)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">
                        {item.summary as string}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasDetails && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 px-8 py-3">
                          {parsedDetails && parsedDetails.length > 0 ? (
                            <div className="space-y-1 text-sm">
                              {parsedDetails.map((change, i) => (
                                <div key={i} className="flex gap-2">
                                  <span className="font-medium text-muted-foreground min-w-[120px]">
                                    {change.field}:
                                  </span>
                                  {change.from ? (
                                    <span>
                                      <span className="text-red-400 line-through">{change.from}</span>
                                      <span className="mx-1 text-muted-foreground">-&gt;</span>
                                      <span className="text-emerald-400">{change.to}</span>
                                    </span>
                                  ) : (
                                    <span className="text-foreground">{change.to}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                              {JSON.stringify(details, null, 2)}
                            </pre>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <PageSizeSelect
            value={pageSize}
            onChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
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

export default function ActivityLogPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <ActivityLogContent />
    </Suspense>
  );
}
