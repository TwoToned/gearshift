"use client";

import React, { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Square, Container } from "lucide-react";

import { getProjectPullSheet } from "@/server/warehouse";
import { useActiveOrganization } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
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

function PullSheetOverbookedBadge({ info }: { info?: { overBy: number; totalStock: number; effectiveStock?: number; totalBooked: number; inherited?: boolean; unavailableAssets?: number; reducedOnly?: boolean; hasOverbookedChildren?: boolean; hasReducedChildren?: boolean } | null }) {
  if (!info) return null;
  const effective = info.effectiveStock ?? info.totalStock;
  const unavail = info.unavailableAssets || 0;

  // Kit parents with BOTH overbooked and reduced children show two badges
  if (info.inherited && info.hasOverbookedChildren && info.hasReducedChildren) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="outline" className="ml-1.5 cursor-help text-xs print:border-red-500 print:text-red-600 bg-red-500/10 text-red-600 border-red-500/20">
                  Overbooked
                </Badge>
              }
            />
            <TooltipContent>Contains items that are over capacity</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="outline" className="ml-1.5 cursor-help text-xs print:border-purple-500 print:text-purple-600 bg-purple-500/10 text-purple-600 border-purple-500/20">
                  Reduced Stock
                </Badge>
              }
            />
            <TooltipContent>Contains items with {unavail} asset{unavail !== 1 ? "s" : ""} in maintenance or lost</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );
  }

  const isReduced = info.reducedOnly;
  const colorClass = isReduced
    ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
    : info.inherited
      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
      : "bg-red-500/10 text-red-600 border-red-500/20";
  const label = isReduced ? "Reduced Stock" : "Overbooked";

  function getTooltip() {
    if (info!.inherited) {
      return isReduced
        ? `Contains items with ${unavail} asset${unavail !== 1 ? "s" : ""} in maintenance or lost`
        : `Contains items that are ${info!.overBy} over capacity`;
    }
    if (isReduced) {
      return `${info!.overBy} over usable stock — ${unavail} of ${info!.totalStock} in maintenance or lost`;
    }
    return `${info!.overBy} over capacity (${info!.totalBooked} booked / ${effective} usable${unavail > 0 ? `, ${unavail} unavailable` : ""})`;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="outline"
              className={`ml-1.5 cursor-help text-xs print:border-red-500 print:text-red-600 ${colorClass}`}
            >
              {label}
            </Badge>
          }
        />
        <TooltipContent>
          {getTooltip()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function PullSheetPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse-pullsheet", orgId, projectId],
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
                    const kit = item.kit as { assetTag: string; name: string } | null;
                    const assetTag = asset?.assetTag || bulkAsset?.assetTag || null;
                    const overbookedInfo = item.overbookedInfo as { overBy: number; totalStock: number; totalBooked: number; inherited?: boolean } | null;
                    const isKit = !!(item.kitId) && !(item.isKitChild);
                    const allChildren = (item.childLineItems || []) as Array<Record<string, unknown>>;
                    const qty = item.quantity as number;
                    const itemName = isKit
                      ? (item.description as string) || kit?.name || "Kit"
                      : model
                        ? [model.name, model.modelNumber].filter(Boolean).join(" - ")
                        : (item.description as string) || "Unnamed item";

                    return (
                      <React.Fragment key={item.id as string}>
                        <TableRow className={isKit ? "bg-muted/30" : ""}>
                          <TableCell className="text-center">
                            {isKit
                              ? <Container className="h-4 w-4 text-muted-foreground print:text-black" />
                              : <Square className="h-4 w-4 text-muted-foreground print:text-black" />}
                          </TableCell>
                          <TableCell>
                            <span className={isKit ? "font-bold" : "font-medium"}>
                              {isKit ? `[Kit] ${itemName}` : itemName}
                            </span>
                            {overbookedInfo && <PullSheetOverbookedBadge info={overbookedInfo} />}
                          </TableCell>
                          <TableCell className="text-center">
                            {isKit ? allChildren.filter((c) => !c.isAccessory).length : qty}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {isKit ? (kit?.assetTag || "—") : (assetTag || "—")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {asset?.location?.name || "—"}
                          </TableCell>
                        </TableRow>
                        {/* All children (kit items + accessories) — unified tree */}
                        {allChildren.map((child) => {
                          const cModel = child.model as { name: string; modelNumber?: string | null } | null;
                          const cAsset = child.asset as { assetTag: string; location?: { name: string } | null } | null;
                          const cBulk = child.bulkAsset as { assetTag: string } | null;
                          const cName = cModel?.name || (child.description as string) || "-";
                          const cQty = child.quantity as number;
                          const cOverbookedInfo = child.overbookedInfo as { overBy: number; totalStock: number; totalBooked: number; inherited?: boolean } | null;
                          const isAcc = !!child.isAccessory;
                          // Grandchildren (e.g. accessories of kit children)
                          const grandchildren = ((child.childLineItems || []) as Array<Record<string, unknown>>);

                          return (
                            <React.Fragment key={child.id as string}>
                              <TableRow>
                                <TableCell className="text-center">
                                  <Square className={`${isAcc ? "h-3 w-3 text-muted-foreground/50" : "h-3.5 w-3.5 text-muted-foreground"} print:text-black`} />
                                </TableCell>
                                <TableCell className="pl-8">
                                  <span className={`${isAcc ? "text-xs" : "text-sm"} text-muted-foreground`}>{cName}</span>
                                  {isAcc && (
                                    <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 bg-teal-500/10 text-teal-600 border-teal-500/20 print:border-teal-600 print:text-teal-600">Acc.</Badge>
                                  )}
                                  {cOverbookedInfo && <PullSheetOverbookedBadge info={cOverbookedInfo} />}
                                </TableCell>
                                <TableCell className="text-center text-sm">{cQty}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {cAsset?.assetTag || cBulk?.assetTag || "—"}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {cAsset?.location?.name || "—"}
                                </TableCell>
                              </TableRow>
                              {/* Per-unit expansion */}
                              {cQty > 1 && Array.from({ length: cQty }).map((_, i) => (
                                <TableRow key={`${child.id}-${i}`}>
                                  <TableCell className="text-center">
                                    <Square className="h-3 w-3 text-muted-foreground/50 print:text-black" />
                                  </TableCell>
                                  <TableCell className="pl-12">
                                    <span className="text-xs text-muted-foreground">{cName} - {i + 1}</span>
                                  </TableCell>
                                  <TableCell />
                                  <TableCell />
                                  <TableCell />
                                </TableRow>
                              ))}
                              {/* Grandchildren (accessories of kit children) */}
                              {grandchildren.map((gc) => {
                                const gcModel = gc.model as { name: string; modelNumber?: string | null } | null;
                                const gcAsset = gc.asset as { assetTag: string; location?: { name: string } | null } | null;
                                const gcBulk = gc.bulkAsset as { assetTag: string } | null;
                                const gcName = gcModel?.name || (gc.description as string) || "-";
                                const gcQty = gc.quantity as number;
                                return (
                                  <TableRow key={gc.id as string}>
                                    <TableCell className="text-center">
                                      <Square className="h-3 w-3 text-muted-foreground/50 print:text-black" />
                                    </TableCell>
                                    <TableCell className="pl-12">
                                      <span className="text-xs text-muted-foreground">{gcName}</span>
                                      {!!(gc.isAccessory) && (
                                        <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 bg-teal-500/10 text-teal-600 border-teal-500/20 print:border-teal-600 print:text-teal-600">Acc.</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center text-xs">{gcQty}</TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                      {gcAsset?.assetTag || gcBulk?.assetTag || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {gcAsset?.location?.name || "—"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        {/* Quantity expansion for non-kit items with qty > 1 */}
                        {!isKit && qty > 1 && Array.from({ length: qty }).map((_, i) => (
                          <TableRow key={`${item.id}-sub-${i}`}>
                            <TableCell className="text-center">
                              <Square className="h-3 w-3 text-muted-foreground/50 print:text-black" />
                            </TableCell>
                            <TableCell className="pl-8">
                              <span className="text-xs text-muted-foreground">{itemName} - {i + 1}</span>
                            </TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell />
                          </TableRow>
                        ))}
                      </React.Fragment>
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
