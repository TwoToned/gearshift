"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Square } from "lucide-react";

import { getProjectPullSheet } from "@/server/warehouse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors: Record<string, string> = {
  CONFIRMED: "bg-green-500/10 text-green-500 border-green-500/20",
  PREPPING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  CHECKED_OUT: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ON_SITE: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  RETURNED: "bg-teal-500/10 text-teal-500 border-teal-500/20",
};

const statusLabels: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PREPPING: "Prepping",
  CHECKED_OUT: "Checked Out",
  ON_SITE: "On Site",
  RETURNED: "Returned",
};

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PullSheetPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse-pullsheet", projectId],
    queryFn: () => getProjectPullSheet(projectId),
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!data) {
    return <div className="text-muted-foreground">Project not found.</div>;
  }

  const project = data.project;
  const groups = data.groups as Record<string, Array<Record<string, unknown>>>;

  const allGroups = Object.entries(groups).map(([name, items]) => ({
    name,
    items,
  }));

  return (
    <div className="space-y-6">
      {/* Screen-only header with back button */}
      <div className="flex items-center gap-2 print:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href={`/warehouse/${projectId}`} />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Back to warehouse view
        </span>
        <div className="ml-auto">
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="print:mb-6">
        <h1 className="text-2xl font-bold tracking-tight print:text-xl">
          Pull Sheet
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="font-mono text-sm text-muted-foreground">
            {project.projectNumber}
          </span>
          <Badge
            variant="outline"
            className={statusColors[project.status] || ""}
          >
            {statusLabels[project.status] || project.status}
          </Badge>
        </div>
        <p className="text-lg font-semibold mt-1">{project.name}</p>
        {project.client && (
          <p className="text-muted-foreground">{project.client.name}</p>
        )}
        <div className="flex gap-6 text-sm text-muted-foreground mt-2">
          <span>
            Rental: {formatDate(project.rentalStartDate as unknown as string | null)} –{" "}
            {formatDate(project.rentalEndDate as unknown as string | null)}
          </span>
          {project.loadInDate && (
            <span>Load In: {formatDate(project.loadInDate as unknown as string | null)}</span>
          )}
        </div>
      </div>

      {/* Equipment grouped */}
      {allGroups.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No equipment items on this project.
        </p>
      ) : (
        allGroups.map((group) => (
          <div key={group.name}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 print:text-black">
              {group.name}
            </h3>
            <div className="rounded-md border print:border-black">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 print:w-8" />
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center w-16">Qty</TableHead>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item) => {
                    const model = item.model as { name: string; modelNumber?: string | null } | null;
                    const asset = item.asset as { assetTag: string; location?: { name: string } | null } | null;
                    const bulkAsset = item.bulkAsset as { assetTag: string } | null;
                    const assetTag = asset?.assetTag || bulkAsset?.assetTag || null;

                    return (
                      <TableRow key={item.id as string}>
                        <TableCell className="text-center">
                          <Square className="h-4 w-4 text-muted-foreground print:text-black" />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {model
                              ? [model.name, model.modelNumber]
                                  .filter(Boolean)
                                  .join(" - ")
                              : (item.description as string) || "Unnamed item"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity as number}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {assetTag || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {asset?.location?.name || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ))
      )}

      {/* Print footer */}
      <div className="hidden print:block text-xs text-muted-foreground border-t pt-2 mt-8">
        <p>
          Printed {new Date().toLocaleDateString("en-AU")} — {project.name} (
          {project.projectNumber})
        </p>
      </div>
    </div>
  );
}
