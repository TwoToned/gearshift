"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Package,
  FolderOpen,
  Users,
  DollarSign,
  Wrench,
  Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getReportsSummary } from "@/server/reports";
import { RequirePermission } from "@/components/auth/require-permission";
import { useActiveOrganization } from "@/lib/auth-client";
import { assetStatusLabels, projectStatusLabels, maintenanceStatusLabels, formatLabel } from "@/lib/status-labels";

export default function ReportsPage() {
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["reports-summary", orgId],
    queryFn: getReportsSummary,
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const d = data as Record<string, unknown>;
  const assetsByStatus = d.assetsByStatus as Array<{ status: string; count: number }>;
  const projectsByStatus = d.projectsByStatus as Array<{ status: string; count: number }>;
  const maintenanceSummary = d.maintenanceSummary as Array<{ status: string; count: number }>;

  return (
    <RequirePermission resource="reports" action="view">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Business overview and metrics.</p>
      </div>

      {/* Top-level stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Serialized Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d.totalSerializedAssets as number}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bulk Assets</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d.totalBulkAssets as number}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d.totalClients as number}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((d.totalRevenue as number) || 0).toLocaleString("en-AU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Completed &amp; invoiced projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Assets by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assetsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets yet.</p>
            ) : (
              <div className="space-y-2">
                {assetsByStatus.map((g) => (
                  <div key={g.status} className="flex items-center justify-between">
                    <span className="text-sm">{assetStatusLabels[g.status] || formatLabel(g.status)}</span>
                    <Badge variant="secondary">{g.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" />
              Projects by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <div className="space-y-2">
                {projectsByStatus.map((g) => (
                  <div key={g.status} className="flex items-center justify-between">
                    <span className="text-sm">{projectStatusLabels[g.status] || formatLabel(g.status)}</span>
                    <Badge variant="secondary">{g.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {maintenanceSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No records yet.</p>
            ) : (
              <div className="space-y-2">
                {maintenanceSummary.map((g) => (
                  <div key={g.status} className="flex items-center justify-between">
                    <span className="text-sm">
                      {maintenanceStatusLabels[g.status] || formatLabel(g.status)}
                    </span>
                    <Badge variant="secondary">{g.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </RequirePermission>
  );
}
