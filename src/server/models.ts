"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getOrgContext } from "@/lib/org-context";
import { modelSchema, type ModelFormValues } from "@/lib/validations/model";
import type { Prisma } from "@/generated/prisma/client";

export type ModelWithRelations = Prisma.ModelGetPayload<{
  include: {
    category: true;
    _count: { select: { assets: true; bulkAssets: true } };
  };
}>;

export async function getModels(params?: {
  search?: string;
  categoryId?: string;
  assetType?: "SERIALIZED" | "BULK";
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { organizationId } = await getOrgContext();
  const { search, categoryId, assetType, isActive = true, page = 1, pageSize = 25, sortBy = "name", sortOrder = "asc" } = params || {};

  const where: Prisma.ModelWhereInput = {
    organizationId,
    isActive,
    ...(categoryId && { categoryId }),
    ...(assetType && { assetType }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { manufacturer: { contains: search, mode: "insensitive" } },
        { modelNumber: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [models, total] = await Promise.all([
    prisma.model.findMany({
      where,
      include: {
        category: true,
        _count: { select: { assets: true, bulkAssets: true } },
      },
      orderBy: sortBy === "category" ? { category: { name: sortOrder } }
        : { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.model.count({ where }),
  ]);

  return serialize({ models, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getModel(id: string) {
  const { organizationId } = await getOrgContext();
  const model = await prisma.model.findUnique({
    where: { id, organizationId },
    include: {
      category: true,
      assets: {
        where: { isActive: true },
        include: { location: true },
        orderBy: { assetTag: "asc" },
      },
      bulkAssets: {
        where: { isActive: true },
        include: { location: true },
        orderBy: { assetTag: "asc" },
      },
    },
  });
  return serialize(model);
}

export async function createModel(data: ModelFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = modelSchema.parse(data);
  return serialize(await prisma.model.create({
    data: {
      organizationId,
      name: parsed.name,
      manufacturer: parsed.manufacturer,
      modelNumber: parsed.modelNumber,
      categoryId: parsed.categoryId || null,
      description: parsed.description,
      image: parsed.image,
      images: parsed.images,
      manuals: parsed.manuals,
      specifications: parsed.specifications ?? undefined,
      customFields: parsed.customFields ?? undefined,
      defaultRentalPrice: parsed.defaultRentalPrice,
      defaultPurchasePrice: parsed.defaultPurchasePrice,
      replacementCost: parsed.replacementCost,
      weight: parsed.weight,
      powerDraw: parsed.powerDraw,
      requiresTestAndTag: parsed.requiresTestAndTag,
      testAndTagIntervalDays: parsed.requiresTestAndTag ? parsed.testAndTagIntervalDays : null,
      maintenanceIntervalDays: parsed.maintenanceIntervalDays,
      assetType: parsed.assetType,
      barcodeLabelTemplate: parsed.barcodeLabelTemplate,
      isActive: parsed.isActive,
    },
  }));
}

export async function updateModel(id: string, data: ModelFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = modelSchema.parse(data);
  return serialize(await prisma.model.update({
    where: { id, organizationId },
    data: {
      name: parsed.name,
      manufacturer: parsed.manufacturer,
      modelNumber: parsed.modelNumber,
      categoryId: parsed.categoryId || null,
      description: parsed.description,
      image: parsed.image,
      images: parsed.images,
      manuals: parsed.manuals,
      specifications: parsed.specifications ?? undefined,
      customFields: parsed.customFields ?? undefined,
      defaultRentalPrice: parsed.defaultRentalPrice,
      defaultPurchasePrice: parsed.defaultPurchasePrice,
      replacementCost: parsed.replacementCost,
      weight: parsed.weight,
      powerDraw: parsed.powerDraw,
      requiresTestAndTag: parsed.requiresTestAndTag,
      testAndTagIntervalDays: parsed.requiresTestAndTag ? parsed.testAndTagIntervalDays : null,
      maintenanceIntervalDays: parsed.maintenanceIntervalDays,
      assetType: parsed.assetType,
      barcodeLabelTemplate: parsed.barcodeLabelTemplate,
      isActive: parsed.isActive,
    },
  }));
}

export async function archiveModel(id: string) {
  const { organizationId } = await getOrgContext();

  // Delete all assets and bulk assets under this model
  await Promise.all([
    prisma.asset.deleteMany({ where: { modelId: id, organizationId } }),
    prisma.bulkAsset.deleteMany({ where: { modelId: id, organizationId } }),
  ]);

  return serialize(await prisma.model.update({
    where: { id, organizationId },
    data: { isActive: false },
  }));
}
