"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";

export async function getReportsSummary() {
  const { organizationId } = await getOrgContext();

  const [
    totalSerializedAssets,
    totalBulkAssets,
    assetsByStatus,
    projectsByStatus,
    totalClients,
    recentProjects,
    maintenanceSummary,
  ] = await Promise.all([
    prisma.asset.count({ where: { organizationId, isActive: true } }),
    prisma.bulkAsset.count({ where: { organizationId, isActive: true } }),
    prisma.asset.groupBy({
      by: ["status"],
      where: { organizationId, isActive: true },
      _count: { status: true },
    }),
    prisma.project.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { status: true },
    }),
    prisma.client.count({ where: { organizationId, isActive: true } }),
    prisma.project.findMany({
      where: { organizationId, status: { in: ["COMPLETED", "INVOICED"] } },
      select: { total: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.maintenanceRecord.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { status: true },
    }),
  ]);

  const totalRevenue = recentProjects.reduce(
    (sum, p) => sum + (p.total ? Number(p.total) : 0),
    0
  );

  return serialize({
    totalSerializedAssets,
    totalBulkAssets,
    assetsByStatus: assetsByStatus.map((g) => ({
      status: g.status,
      count: g._count.status,
    })),
    projectsByStatus: projectsByStatus.map((g) => ({
      status: g.status,
      count: g._count.status,
    })),
    totalClients,
    totalRevenue,
    maintenanceSummary: maintenanceSummary.map((g) => ({
      status: g.status,
      count: g._count.status,
    })),
  });
}
