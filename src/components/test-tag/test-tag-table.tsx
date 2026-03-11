"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect, useCallback } from "react";
import Link from "next/link";
import { getTestTagAssets } from "@/server/test-tag-assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    CURRENT: { label: "Current", className: "bg-green-500/15 text-green-600 border-green-500/30" },
    DUE_SOON: { label: "Due Soon", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    OVERDUE: { label: "Overdue", className: "bg-red-500/15 text-red-600 border-red-500/30" },
    FAILED: { label: "Failed", className: "bg-red-500/15 text-red-600 border-red-500/30 border-dashed" },
    NOT_YET_TESTED: { label: "Not Tested", className: "bg-muted text-muted-foreground" },
    RETIRED: { label: "Retired", className: "bg-muted text-muted-foreground opacity-60" },
  };
  const { label, className } = map[status] || { label: status, className: "" };
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function formatEquipmentClass(value: string): string {
  const map: Record<string, string> = {
    CLASS_I: "Class I",
    CLASS_II: "Class II",
    CLASS_II_DOUBLE_INSULATED: "Class II (Double Insulated)",
    LEAD_CORD_ASSEMBLY: "Lead / Cord Assembly",
  };
  return map[value] || value;
}

function formatApplianceType(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "\u2014";
  const d = new Date(date);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function TestTagTableContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [equipmentClass, setEquipmentClass] = useState(searchParams.get("equipmentClass") || "");
  const [applianceType, setApplianceType] = useState(searchParams.get("applianceType") || "");
  const [assetLink, setAssetLink] = useState(searchParams.get("assetLink") || "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const pageSize = 25;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "test-tag-assets",
      { search: debouncedSearch, status, equipmentClass, applianceType, assetLink, page, pageSize },
    ],
    queryFn: () =>
      getTestTagAssets({
        search: debouncedSearch || undefined,
        status: status || undefined,
        equipmentClass: equipmentClass || undefined,
        applianceType: applianceType || undefined,
        assetLinkType: (assetLink as "all" | "serialized" | "bulk" | "standalone") || undefined,
        page,
        pageSize,
      }),
    staleTime: 60_000,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const selectClass =
    "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const getLinkedAssetLabel = useCallback(
    (item: (typeof items)[number]) => {
      if (item.asset) {
        return (
          <Link
            href={`/assets/registry/${item.asset.id}`}
            className="text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.asset.assetTag}
            {item.asset.customName && (
              <span className="ml-1 text-muted-foreground">({item.asset.customName})</span>
            )}
          </Link>
        );
      }
      if (item.bulkAsset) {
        return (
          <Link
            href={`/assets/registry/${item.bulkAsset.id}?type=bulk`}
            className="text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.bulkAsset.assetTag}
          </Link>
        );
      }
      return <span className="text-muted-foreground">\u2014</span>;
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tag, description, serial, make, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">All Statuses</option>
          <option value="CURRENT">Current</option>
          <option value="DUE_SOON">Due Soon</option>
          <option value="OVERDUE">Overdue</option>
          <option value="FAILED">Failed</option>
          <option value="NOT_YET_TESTED">Not Yet Tested</option>
          <option value="RETIRED">Retired</option>
        </select>
        <select
          value={equipmentClass}
          onChange={(e) => {
            setEquipmentClass(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">All Classes</option>
          <option value="CLASS_I">Class I</option>
          <option value="CLASS_II">Class II</option>
          <option value="CLASS_II_DOUBLE_INSULATED">Class II (Double Insulated)</option>
          <option value="LEAD_CORD_ASSEMBLY">Lead / Cord Assembly</option>
        </select>
        <select
          value={applianceType}
          onChange={(e) => {
            setApplianceType(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">All Types</option>
          <option value="APPLIANCE">Appliance</option>
          <option value="CORD_SET">Cord Set</option>
          <option value="EXTENSION_LEAD">Extension Lead</option>
          <option value="POWER_BOARD">Power Board</option>
          <option value="RCD_PORTABLE">RCD Portable</option>
          <option value="RCD_FIXED">RCD Fixed</option>
          <option value="THREE_PHASE">Three Phase</option>
          <option value="OTHER">Other</option>
        </select>
        <select
          value={assetLink}
          onChange={(e) => {
            setAssetLink(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">All Assets</option>
          <option value="serialized">Serialized</option>
          <option value="bulk">Bulk</option>
          <option value="standalone">Standalone</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test Tag ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Equipment Class</TableHead>
              <TableHead>Appliance Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Tested</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Linked Asset</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No test tag assets found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/test-and-tag/${item.id}`)}
                >
                  <TableCell className="font-mono font-medium text-sm">
                    {item.testTagId}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatEquipmentClass(item.equipmentClass)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatApplianceType(item.applianceType)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.lastTestDate)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.nextDueDate)}
                  </TableCell>
                  <TableCell>{getLinkedAssetLabel(item)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} ({total} total)
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TestTagTable() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TestTagTableContent />
    </Suspense>
  );
}
