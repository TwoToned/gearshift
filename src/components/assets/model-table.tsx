"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Download, Upload } from "lucide-react";

import { getModels } from "@/server/models";
import { getCategories } from "@/server/categories";
import { exportModelsCSV } from "@/server/csv";
import { CSVImportDialog } from "@/components/assets/csv-import-dialog";
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

export function ModelTable() {
  const { sortBy, sortOrder, pageSize, page, setPage, setPageSize, handleSort } =
    useTablePreferences("models", { sortBy: "name", sortOrder: "asc" });
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assetType, setAssetType] = useState<"" | "SERIALIZED" | "BULK">("");
  const [importOpen, setImportOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["models", { search, categoryId, assetType, page, pageSize, sortBy, sortOrder }],
    queryFn: () =>
      getModels({
        search: search || undefined,
        categoryId: categoryId || undefined,
        assetType: assetType as "SERIALIZED" | "BULK" | undefined || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      }),
  });

  const models = data?.models || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <ComboboxPicker
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setPage(1); }}
            options={categories.map((cat) => ({
              value: cat.id,
              label: cat.parent ? `${cat.parent.name} → ${cat.name}` : cat.name,
            }))}
            placeholder="All Categories"
            searchPlaceholder="Search categories..."
            allowClear
          />
        </div>
        <select
          value={assetType}
          onChange={(e) => { setAssetType(e.target.value as typeof assetType); setPage(1); }}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All Types</option>
          <option value="SERIALIZED">Serialized</option>
          <option value="BULK">Bulk</option>
        </select>
        <CanDo resource="model" action="create">
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={async () => {
              const csv = await exportModelsCSV();
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "models.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button render={<Link href="/assets/models/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            New Model
          </Button>
        </CanDo>
      </div>
      <CanDo resource="model" action="create">
        <div className="flex gap-2 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const csv = await exportModelsCSV();
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "models.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </div>
      </CanDo>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Name</SortableTableHead>
              <SortableTableHead sortKey="manufacturer" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Manufacturer</SortableTableHead>
              <SortableTableHead sortKey="category" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Category</SortableTableHead>
              <SortableTableHead sortKey="assetType" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort}>Type</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Assets</SortableTableHead>
              <SortableTableHead sortKey="defaultRentalPrice" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSort} className="text-right">Rental $/day</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : models.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No models found.{" "}
                  <Link href="/assets/models/new" className="text-primary hover:underline">
                    Create one
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <MediaThumbnail
                        url={model.media?.[0]?.file?.url}
                        thumbnailUrl={model.media?.[0]?.file?.thumbnailUrl}
                        alt={model.name}
                        size={36}
                      />
                      <div>
                        <Link href={`/assets/models/${model.id}`} className="font-medium hover:underline">
                          {model.name}
                        </Link>
                        {model.modelNumber && (
                          <span className="ml-2 text-xs text-muted-foreground">{model.modelNumber}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{model.manufacturer || "—"}</TableCell>
                  <TableCell>
                    {model.category ? (
                      <Badge variant="secondary">{model.category.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={model.assetType === "SERIALIZED" ? "default" : "outline"}>
                      {model.assetType === "SERIALIZED" ? "Serialized" : "Bulk"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {model._count.assets + model._count.bulkAssets}
                  </TableCell>
                  <TableCell className="text-right">
                    {model.defaultRentalPrice ? `$${Number(model.defaultRentalPrice).toFixed(2)}` : "—"}
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

      <CSVImportDialog type="models" open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
