"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { assetSchema, type AssetFormValues } from "@/lib/validations/asset";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";
import { reserveAssetTags, getOrgTestTagSettings } from "@/server/settings";
import { backfillTestTagAssets } from "@/server/test-tag-assets";

export type AssetWithRelations = Prisma.AssetGetPayload<{
  include: {
    model: { include: { category: true } };
    location: true;
  };
}>;

export async function getAssets(params?: {
  search?: string;
  categoryId?: string;
  status?: string;
  condition?: string;
  locationId?: string;
  modelId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { organizationId } = await getOrgContext();
  const {
    search, categoryId, status, condition, locationId, modelId,
    isActive = true, page = 1, pageSize = 25,
    sortBy = "assetTag", sortOrder = "asc",
  } = params || {};

  const where: Prisma.AssetWhereInput = {
    organizationId,
    isActive,
    ...(status && { status: status as Prisma.EnumAssetStatusFilter }),
    ...(condition && { condition: condition as Prisma.EnumAssetConditionFilter }),
    ...(locationId && { locationId }),
    ...(modelId && { modelId }),
    ...(categoryId && { model: { categoryId } }),
    ...(search && {
      OR: [
        { assetTag: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { customName: { contains: search, mode: "insensitive" } },
        { model: { name: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        model: {
          include: {
            category: true,
            media: {
              where: { type: "PHOTO", isPrimary: true },
              include: { file: true },
              take: 1,
            },
          },
        },
        location: true,
        media: {
          where: { type: "PHOTO", isPrimary: true },
          include: { file: true },
          take: 1,
        },
      },
      orderBy: sortBy === "model" ? { model: { name: sortOrder } }
        : sortBy === "location" ? { location: { name: sortOrder } }
        : { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.asset.count({ where }),
  ]);

  return serialize({ assets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getAsset(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.asset.findUnique({
    where: { id, organizationId },
    include: {
      model: {
        include: {
          category: true,
          media: {
            include: { file: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      location: true,
      supplier: true,
      media: {
        include: { file: true },
        orderBy: { sortOrder: "asc" },
      },
      maintenanceLinks: {
        include: { maintenanceRecord: true },
        orderBy: { maintenanceRecord: { createdAt: "desc" } },
        take: 20,
      },
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
      testTagAsset: {
        select: {
          id: true,
          testTagId: true,
          status: true,
          lastTestDate: true,
          nextDueDate: true,
          testIntervalMonths: true,
        },
      },
    },
  }));
}

export async function createAsset(data: AssetFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = assetSchema.parse(data);

  // Fetch the model to check T&T requirements
  const model = await prisma.model.findUnique({ where: { id: parsed.modelId } });

  try {
    const result = await prisma.asset.create({
      data: {
        organizationId,
        modelId: parsed.modelId,
        assetTag: parsed.assetTag,
        serialNumber: parsed.serialNumber,
        customName: parsed.customName,
        status: parsed.status,
        condition: parsed.condition,
        purchaseDate: parsed.purchaseDate,
        purchasePrice: parsed.purchasePrice,
        purchaseSupplier: parsed.purchaseSupplier,
        supplierId: parsed.supplierId || null,
        warrantyExpiry: parsed.warrantyExpiry,
        notes: parsed.notes,
        locationId: parsed.locationId || null,
        customFieldValues: parsed.customFieldValues ?? undefined,
        barcode: parsed.barcode || parsed.assetTag,
        qrCode: parsed.assetTag,
        images: parsed.images,
        isActive: parsed.isActive,
      },
    });
    // Advance the counter now that the asset is actually created
    await reserveAssetTags(1);

    // Auto-register in T&T registry if model requires it
    if (model?.requiresTestAndTag) {
      const orgTT = await getOrgTestTagSettings();
      const intervalMonths = model.testAndTagIntervalDays
        ? Math.max(1, Math.round(model.testAndTagIntervalDays / 30))
        : (orgTT.defaultIntervalMonths || 3);
      await prisma.testTagAsset.create({
        data: {
          organizationId,
          testTagId: parsed.assetTag,
          description: `${model.manufacturer ? model.manufacturer + " " : ""}${model.name} (${parsed.assetTag})`,
          equipmentClass: model.defaultEquipmentClass || "CLASS_I",
          applianceType: model.defaultApplianceType || "APPLIANCE",
          make: model.manufacturer || null,
          modelName: model.modelNumber || null,
          serialNumber: parsed.serialNumber || null,
          testIntervalMonths: intervalMonths,
          status: "NOT_YET_TESTED",
          assetId: result.id,
        },
      });
    }

    return serialize(result);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      throw new Error(`Asset tag "${parsed.assetTag}" already exists`);
    }
    throw e;
  }
}

export async function createAssets(
  data: AssetFormValues,
  assets: { tag: string; serialNumber?: string }[],
) {
  const { organizationId } = await getOrgContext();
  const parsed = assetSchema.parse(data);

  const model = await prisma.model.findUnique({ where: { id: parsed.modelId } });

  const results = await prisma.$transaction(
    assets.map(({ tag, serialNumber }) =>
      prisma.asset.create({
        data: {
          organizationId,
          modelId: parsed.modelId,
          assetTag: tag,
          serialNumber: serialNumber || parsed.serialNumber,
          customName: parsed.customName,
          status: parsed.status,
          condition: parsed.condition,
          purchaseDate: parsed.purchaseDate,
          purchasePrice: parsed.purchasePrice,
          purchaseSupplier: parsed.purchaseSupplier,
          supplierId: parsed.supplierId || null,
          warrantyExpiry: parsed.warrantyExpiry,
          notes: parsed.notes,
          locationId: parsed.locationId || null,
          customFieldValues: parsed.customFieldValues ?? undefined,
          barcode: parsed.barcode || tag,
          qrCode: tag,
          images: parsed.images,
          isActive: parsed.isActive,
        },
      })
    )
  );

  // Advance the counter now that assets are actually created
  await reserveAssetTags(assets.length);

  // Auto-register in T&T registry if model requires it
  if (model?.requiresTestAndTag) {
    const orgTT = await getOrgTestTagSettings();
    const intervalMonths = model.testAndTagIntervalDays
      ? Math.max(1, Math.round(model.testAndTagIntervalDays / 30))
      : (orgTT.defaultIntervalMonths || 3);
    await prisma.$transaction(
      results.map((asset) =>
        prisma.testTagAsset.create({
          data: {
            organizationId,
            testTagId: asset.assetTag,
            description: `${model.manufacturer ? model.manufacturer + " " : ""}${model.name} (${asset.assetTag})`,
            equipmentClass: model.defaultEquipmentClass || "CLASS_I",
            applianceType: model.defaultApplianceType || "APPLIANCE",
            make: model.manufacturer || null,
            modelName: model.modelNumber || null,
            serialNumber: asset.serialNumber || null,
            testIntervalMonths: intervalMonths,
            status: "NOT_YET_TESTED",
            assetId: asset.id,
          },
        })
      )
    );
  }

  return serialize(results);
}

export async function updateAsset(id: string, data: AssetFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = assetSchema.parse(data);

  const updated = await prisma.asset.update({
    where: { id, organizationId },
    data: {
      modelId: parsed.modelId,
      assetTag: parsed.assetTag,
      serialNumber: parsed.serialNumber,
      customName: parsed.customName,
      status: parsed.status,
      condition: parsed.condition,
      purchaseDate: parsed.purchaseDate,
      purchasePrice: parsed.purchasePrice,
      purchaseSupplier: parsed.purchaseSupplier,
      supplierId: parsed.supplierId || null,
      warrantyExpiry: parsed.warrantyExpiry,
      notes: parsed.notes,
      locationId: parsed.locationId || null,
      customFieldValues: parsed.customFieldValues ?? undefined,
      barcode: parsed.barcode || parsed.assetTag,
      images: parsed.images,
      isActive: parsed.isActive,
    },
  });

  // Register in T&T if model requires it and not already registered
  const model = await prisma.model.findUnique({ where: { id: parsed.modelId } });
  if (model?.requiresTestAndTag) {
    await backfillTestTagAssets();
  }

  return serialize(updated);
}

export async function bulkUpdateAssets(
  ids: string[],
  data: {
    status?: string;
    condition?: string;
    locationId?: string | null;
  },
) {
  const { organizationId } = await getOrgContext();
  if (ids.length === 0) throw new Error("No assets selected");

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.condition) updateData.condition = data.condition;
  if (data.locationId !== undefined) updateData.locationId = data.locationId || null;

  if (Object.keys(updateData).length === 0) throw new Error("No changes specified");

  const result = await prisma.asset.updateMany({
    where: { id: { in: ids }, organizationId },
    data: updateData,
  });

  return { count: result.count };
}

export async function deleteAsset(id: string) {
  const { organizationId } = await getOrgContext();

  const asset = await prisma.asset.findUnique({
    where: { id, organizationId },
    include: {
      _count: { select: { lineItems: true, maintenanceLinks: true } },
      kitItem: true,
    },
  });
  if (!asset) throw new Error("Asset not found");

  if (asset._count.lineItems > 0) {
    throw new Error("Cannot delete — this asset is referenced by project line items. Archive it instead.");
  }
  if (asset.kitItem) {
    throw new Error("Cannot delete — this asset is part of a kit. Remove it from the kit first.");
  }

  // Retire linked T&T entry if one exists
  const linkedTT = await prisma.testTagAsset.findFirst({
    where: { assetId: id, organizationId },
  });
  if (linkedTT) {
    await prisma.testTagAsset.update({
      where: { id: linkedTT.id },
      data: { status: "RETIRED", isActive: false, assetId: null },
    });
  }

  await prisma.asset.delete({ where: { id, organizationId } });
  return { id };
}

export async function updateAssetNotes(id: string, notes: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.asset.update({
    where: { id, organizationId },
    data: { notes: notes || null },
  }));
}

export async function archiveAsset(id: string) {
  const { organizationId } = await getOrgContext();

  // Retire linked T&T entry if one exists
  await prisma.testTagAsset.updateMany({
    where: { assetId: id, organizationId },
    data: { status: "RETIRED", isActive: false },
  });

  return serialize(await prisma.asset.update({
    where: { id, organizationId },
    data: { isActive: false, status: "RETIRED" },
  }));
}
