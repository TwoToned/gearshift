"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { bulkAssetSchema, type BulkAssetFormValues } from "@/lib/validations/asset";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";
import { reserveAssetTags } from "@/server/settings";

export type BulkAssetWithRelations = Prisma.BulkAssetGetPayload<{
  include: {
    model: { include: { category: true } };
    location: true;
  };
}>;

export async function getBulkAssets(params?: {
  search?: string;
  categoryId?: string;
  status?: string;
  locationId?: string;
  modelId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await getOrgContext();
  const {
    search, categoryId, status, locationId, modelId,
    isActive = true, page = 1, pageSize = 25,
  } = params || {};

  const where: Prisma.BulkAssetWhereInput = {
    organizationId,
    isActive,
    ...(status && { status: status as Prisma.EnumBulkAssetStatusFilter }),
    ...(locationId && { locationId }),
    ...(modelId && { modelId }),
    ...(categoryId && { model: { categoryId } }),
    ...(search && {
      OR: [
        { assetTag: { contains: search, mode: "insensitive" } },
        { model: { name: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  const [bulkAssets, total] = await Promise.all([
    prisma.bulkAsset.findMany({
      where,
      include: {
        model: { include: { category: true } },
        location: true,
      },
      orderBy: { assetTag: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bulkAsset.count({ where }),
  ]);

  return serialize({ bulkAssets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getBulkAsset(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.bulkAsset.findUnique({
    where: { id, organizationId },
    include: {
      model: { include: { category: true } },
      location: true,
      scanLogs: {
        orderBy: { scannedAt: "desc" },
        take: 20,
        include: { scannedBy: true, project: true },
      },
      lineItems: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { project: true },
      },
    },
  }));
}

export async function createBulkAsset(data: BulkAssetFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = bulkAssetSchema.parse(data);
  try {
    const result = await prisma.bulkAsset.create({
      data: {
        organizationId,
        modelId: parsed.modelId,
        assetTag: parsed.assetTag,
        totalQuantity: parsed.totalQuantity,
        availableQuantity: parsed.totalQuantity,
        purchasePricePerUnit: parsed.purchasePricePerUnit,
        locationId: parsed.locationId || null,
        status: parsed.status,
        reorderThreshold: parsed.reorderThreshold,
        notes: parsed.notes,
        isActive: parsed.isActive,
      },
    });
    await reserveAssetTags(1);
    return serialize(result);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      throw new Error(`Asset tag "${parsed.assetTag}" already exists`);
    }
    throw e;
  }
}

export async function updateBulkAsset(id: string, data: BulkAssetFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = bulkAssetSchema.parse(data);

  const existing = await prisma.bulkAsset.findUnique({ where: { id, organizationId } });
  if (!existing) throw new Error("Bulk asset not found");

  // Adjust available quantity based on total change
  const totalDiff = parsed.totalQuantity - existing.totalQuantity;
  const newAvailable = Math.max(0, existing.availableQuantity + totalDiff);

  return serialize(await prisma.bulkAsset.update({
    where: { id, organizationId },
    data: {
      modelId: parsed.modelId,
      assetTag: parsed.assetTag,
      totalQuantity: parsed.totalQuantity,
      availableQuantity: newAvailable,
      purchasePricePerUnit: parsed.purchasePricePerUnit,
      locationId: parsed.locationId || null,
      status: parsed.status,
      reorderThreshold: parsed.reorderThreshold,
      notes: parsed.notes,
      isActive: parsed.isActive,
    },
  }));
}

export async function archiveBulkAsset(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.bulkAsset.update({
    where: { id, organizationId },
    data: { isActive: false, status: "RETIRED" },
  }));
}
