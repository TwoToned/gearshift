"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext, requirePermission } from "@/lib/org-context";
import {
  maintenanceSchema,
  type MaintenanceFormValues,
} from "@/lib/validations/maintenance";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";

const assetInclude = {
  assets: {
    include: { asset: { include: { model: true } } },
    orderBy: { asset: { assetTag: "asc" as const } },
  },
};

export async function getMaintenanceRecords(params?: {
  search?: string;
  status?: string;
  type?: string;
  assetId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { organizationId } = await getOrgContext();
  const { search, status, type, assetId, page = 1, pageSize = 25, sortBy, sortOrder } = params || {};

  const where: Prisma.MaintenanceRecordWhereInput = {
    organizationId,
    ...(status && { status: status as Prisma.EnumMaintenanceStatusFilter }),
    ...(type && { type: type as Prisma.EnumMaintenanceTypeFilter }),
    ...(assetId && { assets: { some: { assetId } } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { assets: { some: { asset: { assetTag: { contains: search, mode: "insensitive" } } } } },
        { assets: { some: { asset: { model: { name: { contains: search, mode: "insensitive" } } } } } },
      ],
    }),
  };

  const [records, total] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where,
      include: {
        ...assetInclude,
        assignedTo: true,
        reportedBy: true,
      },
      orderBy: sortBy
        ? { [sortBy]: sortOrder || "asc" }
        : [{ status: "asc" }, { scheduledDate: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.maintenanceRecord.count({ where }),
  ]);

  return serialize({
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function getMaintenanceRecord(id: string) {
  const { organizationId } = await getOrgContext();

  return serialize(
    await prisma.maintenanceRecord.findUnique({
      where: { id, organizationId },
      include: {
        ...assetInclude,
        assignedTo: true,
        reportedBy: true,
      },
    })
  );
}

export async function createMaintenanceRecord(data: MaintenanceFormValues) {
  const { organizationId, userId } = await requirePermission("maintenance", "create");
  const parsed = maintenanceSchema.parse(data);

  const assetIds = parsed.assetIds?.length
    ? parsed.assetIds
    : parsed.assetId
      ? [parsed.assetId]
      : [];

  if (assetIds.length === 0) throw new Error("At least one asset is required");

  const record = await prisma.maintenanceRecord.create({
    data: {
      organizationId,
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      description: parsed.description || null,
      reportedById: parsed.reportedById || userId,
      assignedToId: parsed.assignedToId || null,
      scheduledDate: parsed.scheduledDate ?? null,
      completedDate: parsed.completedDate ?? null,
      cost: parsed.cost ?? null,
      partsUsed: parsed.partsUsed || null,
      result: parsed.result ?? null,
      nextDueDate: parsed.nextDueDate ?? null,
      assets: {
        create: assetIds.map((assetId) => ({ assetId })),
      },
    },
    include: {
      ...assetInclude,
    },
  });

  // Update asset statuses
  if (parsed.status === "IN_PROGRESS") {
    await prisma.asset.updateMany({
      where: { id: { in: assetIds } },
      data: { status: "IN_MAINTENANCE" },
    });
  }

  if (parsed.status === "COMPLETED") {
    await prisma.asset.updateMany({
      where: { id: { in: assetIds } },
      data: {
        status: parsed.result === "FAIL" ? "IN_MAINTENANCE" : "AVAILABLE",
      },
    });
  }

  return serialize(record);
}

export async function updateMaintenanceRecord(
  id: string,
  data: MaintenanceFormValues
) {
  const { organizationId } = await requirePermission("maintenance", "update");
  const parsed = maintenanceSchema.parse(data);

  const existing = await prisma.maintenanceRecord.findUnique({
    where: { id, organizationId },
    include: { assets: true },
  });

  if (!existing) throw new Error("Maintenance record not found");

  const existingAssetIds = existing.assets.map((a) => a.assetId);

  // Determine new asset list (edit mode may update assets)
  const newAssetIds = parsed.assetIds?.length
    ? parsed.assetIds
    : parsed.assetId
      ? [parsed.assetId]
      : existingAssetIds;

  const toAdd = newAssetIds.filter((id) => !existingAssetIds.includes(id));
  const toRemove = existingAssetIds.filter((id) => !newAssetIds.includes(id));

  const record = await prisma.maintenanceRecord.update({
    where: { id, organizationId },
    data: {
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      description: parsed.description || null,
      reportedById: parsed.reportedById || undefined,
      assignedToId: parsed.assignedToId || null,
      scheduledDate: parsed.scheduledDate ?? null,
      completedDate: parsed.completedDate ?? null,
      cost: parsed.cost ?? null,
      partsUsed: parsed.partsUsed || null,
      result: parsed.result ?? null,
      nextDueDate: parsed.nextDueDate ?? null,
      assets: {
        deleteMany: toRemove.length > 0 ? { assetId: { in: toRemove } } : undefined,
        create: toAdd.map((assetId) => ({ assetId })),
      },
    },
    include: {
      ...assetInclude,
    },
  });

  // Handle status transitions for all linked assets
  if (newAssetIds.length > 0) {
    if (parsed.status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") {
      await prisma.asset.updateMany({
        where: { id: { in: newAssetIds } },
        data: { status: "IN_MAINTENANCE" },
      });
    }

    if (parsed.status === "COMPLETED" && existing.status !== "COMPLETED") {
      await prisma.asset.updateMany({
        where: { id: { in: newAssetIds } },
        data: {
          status: parsed.result === "FAIL" ? "IN_MAINTENANCE" : "AVAILABLE",
        },
      });
    }

    if (parsed.status === "CANCELLED" && existing.status === "IN_PROGRESS") {
      await prisma.asset.updateMany({
        where: { id: { in: newAssetIds } },
        data: { status: "AVAILABLE" },
      });
    }
  }

  return serialize(record);
}

export async function deleteMaintenanceRecord(id: string) {
  const { organizationId } = await requirePermission("maintenance", "delete");

  const record = await prisma.maintenanceRecord.findUnique({
    where: { id, organizationId },
    include: { assets: true },
  });

  if (!record) throw new Error("Record not found");

  // If the record was keeping assets in maintenance, release them
  if (record.status === "IN_PROGRESS" && record.assets.length > 0) {
    await prisma.asset.updateMany({
      where: { id: { in: record.assets.map((a) => a.assetId) } },
      data: { status: "AVAILABLE" },
    });
  }

  await prisma.maintenanceRecord.delete({
    where: { id, organizationId },
  });
}

export async function getAssetsForMaintenanceSelect() {
  const { organizationId } = await getOrgContext();

  const assets = await prisma.asset.findMany({
    where: { organizationId, isActive: true },
    include: { model: true },
    orderBy: { assetTag: "asc" },
  });

  return serialize(
    assets.map((a) => ({
      id: a.id,
      label: `${a.assetTag} — ${a.model.name}${a.customName ? ` (${a.customName})` : ""}`,
    }))
  );
}
