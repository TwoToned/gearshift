"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import {
  maintenanceSchema,
  type MaintenanceFormValues,
} from "@/lib/validations/maintenance";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";

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
    ...(assetId && { assetId }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { asset: { assetTag: { contains: search, mode: "insensitive" } } },
        { asset: { model: { name: { contains: search, mode: "insensitive" } } } },
      ],
    }),
  };

  const [records, total] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where,
      include: {
        asset: { include: { model: true } },
        assignedTo: true,
        reportedBy: true,
      },
      orderBy: sortBy
        ? (sortBy === "asset" ? { asset: { assetTag: sortOrder || "asc" } } : { [sortBy]: sortOrder || "asc" })
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
        asset: { include: { model: true } },
        assignedTo: true,
        reportedBy: true,
      },
    })
  );
}

export async function createMaintenanceRecord(data: MaintenanceFormValues) {
  const { organizationId, userId } = await getOrgContext();
  const parsed = maintenanceSchema.parse(data);

  const record = await prisma.maintenanceRecord.create({
    data: {
      organizationId,
      assetId: parsed.assetId,
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      description: parsed.description || null,
      reportedById: userId,
      assignedToId: parsed.assignedToId || null,
      scheduledDate: parsed.scheduledDate ?? null,
      completedDate: parsed.completedDate ?? null,
      cost: parsed.cost ?? null,
      partsUsed: parsed.partsUsed || null,
      result: parsed.result ?? null,
      nextDueDate: parsed.nextDueDate ?? null,
    },
    include: {
      asset: { include: { model: true } },
    },
  });

  // If status is IN_PROGRESS or SCHEDULED, set asset to IN_MAINTENANCE
  if (parsed.status === "IN_PROGRESS") {
    await prisma.asset.update({
      where: { id: parsed.assetId },
      data: { status: "IN_MAINTENANCE" },
    });
  }

  // If completed, update asset back to AVAILABLE (or based on result)
  if (parsed.status === "COMPLETED") {
    await prisma.asset.update({
      where: { id: parsed.assetId },
      data: {
        status: parsed.result === "FAIL" ? "IN_MAINTENANCE" : "AVAILABLE",
        lastTestAndTagDate:
          parsed.type === "TEST_AND_TAG" ? new Date() : undefined,
        nextTestAndTagDate:
          parsed.type === "TEST_AND_TAG" && parsed.nextDueDate
            ? parsed.nextDueDate
            : undefined,
      },
    });
  }

  return serialize(record);
}

export async function updateMaintenanceRecord(
  id: string,
  data: MaintenanceFormValues
) {
  const { organizationId } = await getOrgContext();
  const parsed = maintenanceSchema.parse(data);

  const existing = await prisma.maintenanceRecord.findUnique({
    where: { id, organizationId },
  });

  if (!existing) throw new Error("Maintenance record not found");

  const record = await prisma.maintenanceRecord.update({
    where: { id, organizationId },
    data: {
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      description: parsed.description || null,
      assignedToId: parsed.assignedToId || null,
      scheduledDate: parsed.scheduledDate ?? null,
      completedDate: parsed.completedDate ?? null,
      cost: parsed.cost ?? null,
      partsUsed: parsed.partsUsed || null,
      result: parsed.result ?? null,
      nextDueDate: parsed.nextDueDate ?? null,
    },
    include: {
      asset: { include: { model: true } },
    },
  });

  // Handle status transitions
  if (parsed.status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") {
    await prisma.asset.update({
      where: { id: parsed.assetId },
      data: { status: "IN_MAINTENANCE" },
    });
  }

  if (parsed.status === "COMPLETED" && existing.status !== "COMPLETED") {
    await prisma.asset.update({
      where: { id: parsed.assetId },
      data: {
        status: parsed.result === "FAIL" ? "IN_MAINTENANCE" : "AVAILABLE",
        lastTestAndTagDate:
          parsed.type === "TEST_AND_TAG" ? new Date() : undefined,
        nextTestAndTagDate:
          parsed.type === "TEST_AND_TAG" && parsed.nextDueDate
            ? parsed.nextDueDate
            : undefined,
      },
    });
  }

  if (parsed.status === "CANCELLED" && existing.status === "IN_PROGRESS") {
    // If cancelling an in-progress record, set asset back to available
    await prisma.asset.update({
      where: { id: parsed.assetId },
      data: { status: "AVAILABLE" },
    });
  }

  return serialize(record);
}

export async function deleteMaintenanceRecord(id: string) {
  const { organizationId } = await getOrgContext();

  const record = await prisma.maintenanceRecord.findUnique({
    where: { id, organizationId },
  });

  if (!record) throw new Error("Record not found");

  // If the record was keeping the asset in maintenance, release it
  if (record.status === "IN_PROGRESS" && record.assetId) {
    await prisma.asset.update({
      where: { id: record.assetId },
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
