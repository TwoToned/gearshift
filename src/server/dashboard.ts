"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";

export async function getDashboardStats() {
  const { organizationId } = await getOrgContext();

  const now = new Date();

  const [
    totalAssets,
    totalBulkAssets,
    checkedOutAssets,
    activeProjects,
    maintenanceDue,
    overdueReturns,
  ] = await Promise.all([
    prisma.asset.count({
      where: { organizationId, isActive: true },
    }),
    prisma.bulkAsset.aggregate({
      where: { organizationId, isActive: true },
      _sum: { totalQuantity: true },
    }),
    prisma.asset.count({
      where: { organizationId, isActive: true, status: "CHECKED_OUT" },
    }),
    prisma.project.count({
      where: {
        organizationId,
        status: { in: ["CONFIRMED", "PREPPING", "CHECKED_OUT", "ON_SITE"] },
      },
    }),
    prisma.maintenanceRecord.count({
      where: {
        organizationId,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledDate: { lte: now },
      },
    }),
    prisma.projectLineItem.count({
      where: {
        organizationId,
        status: "CHECKED_OUT",
        project: {
          rentalEndDate: { lt: now },
          status: { notIn: ["RETURNED", "COMPLETED", "INVOICED", "CANCELLED"] },
        },
      },
    }),
  ]);

  return {
    totalAssets: totalAssets + (totalBulkAssets._sum.totalQuantity || 0),
    checkedOutAssets,
    activeProjects,
    maintenanceDue,
    overdueReturns,
  };
}

export async function getUpcomingProjects() {
  const { organizationId } = await getOrgContext();

  const now = new Date();

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      status: { in: ["CONFIRMED", "PREPPING", "QUOTED"] },
      rentalStartDate: { gte: now },
    },
    include: {
      client: true,
      _count: { select: { lineItems: { where: { type: "EQUIPMENT" } } } },
    },
    orderBy: { rentalStartDate: "asc" },
    take: 8,
  });

  return serialize(projects);
}

export async function getRecentActivity() {
  const { organizationId } = await getOrgContext();

  const [logs, testRecords, maintenanceRecords] = await Promise.all([
    prisma.assetScanLog.findMany({
      where: { organizationId },
      include: {
        asset: { include: { model: true } },
        bulkAsset: { include: { model: true } },
        project: true,
        scannedBy: true,
      },
      orderBy: { scannedAt: "desc" },
      take: 10,
    }),
    prisma.testTagRecord.findMany({
      where: { organizationId },
      include: {
        testTagAsset: { select: { testTagId: true, description: true } },
        testedBy: { select: { id: true, name: true } },
      },
      orderBy: { testDate: "desc" },
      take: 10,
    }),
    prisma.maintenanceRecord.findMany({
      where: { organizationId },
      include: {
        assets: {
          include: { asset: { include: { model: true } } },
          take: 3,
        },
        reportedBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  return serialize({ logs, testRecords, maintenanceRecords });
}
