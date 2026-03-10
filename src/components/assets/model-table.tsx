"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";

import { getModels } from "@/server/models";
import { getCategories } from "@/server/categories";
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

export function ModelTable() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assetType, setAssetType] = useState<"" | "SERIALIZED" | "BULK">("");
  const [page, setPage] = useState(1);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["models", { search, categoryId, assetType, page }],
    queryFn: () =>
      getModels({
        search: search || undefined,
        categoryId: categoryId || undefined,
        assetType: assetType as "SERIALIZED" | "BULK" | undefined || undefined,
        page,
      }),
  });

  const models = data?.models || [];
  const totalPages = data?.totalPages || 1;

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
        <Button render={<Link href="/assets/models/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Model
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Assets</TableHead>
              <TableHead className="text-right">Rental $/day</TableHead>
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
                    <Link href={`/assets/models/${model.id}`} className="font-medium hover:underline">
                      {model.name}
                    </Link>
                    {model.modelNumber && (
                      <span className="ml-2 text-xs text-muted-foreground">{model.modelNumber}</span>
                    )}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({data?.total} total)
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
