"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { locationSchema, type LocationFormValues } from "@/lib/validations/asset";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";

export async function getLocations(params?: {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { organizationId } = await getOrgContext();
  const {
    search,
    type,
    page = 1,
    pageSize = 25,
    sortBy = "name",
    sortOrder = "asc",
  } = params || {};

  const where: Prisma.LocationWhereInput = {
    organizationId,
    ...(type && { type: type as Prisma.EnumLocationTypeFilter }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [locations, total] = await Promise.all([
    prisma.location.findMany({
      where,
      include: {
        parent: { select: { name: true } },
        _count: { select: { assets: true, bulkAssets: true, kits: true, children: true, projects: true } },
      },
      orderBy: sortBy === "parent" ? { parent: { name: sortOrder } }
        : [{ isDefault: "desc" }, { [sortBy]: sortOrder }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.location.count({ where }),
  ]);

  return serialize({
    locations,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function getLocation(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.location.findUnique({
    where: { id, organizationId },
    include: {
      parent: true,
      children: {
        include: { _count: { select: { assets: true, bulkAssets: true } } },
        orderBy: { name: "asc" },
      },
      assets: {
        where: { isActive: true },
        include: { model: true },
        orderBy: { assetTag: "asc" },
        take: 50,
      },
      bulkAssets: {
        where: { isActive: true },
        include: { model: true },
        orderBy: { assetTag: "asc" },
        take: 50,
      },
      kits: {
        where: { isActive: true },
        orderBy: { assetTag: "asc" },
        take: 50,
      },
      projects: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { client: true },
      },
      media: {
        include: { file: true },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { assets: true, bulkAssets: true, kits: true, children: true, projects: true } },
    },
  }));
}

export async function createLocation(data: LocationFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = locationSchema.parse(data);

  // If this is set as default, unset other defaults
  if (parsed.isDefault) {
    await prisma.location.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return serialize(await prisma.location.create({
    data: {
      ...parsed,
      parentId: parsed.parentId || null,
      organizationId,
    },
  }));
}

export async function updateLocation(id: string, data: LocationFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = locationSchema.parse(data);

  if (parsed.isDefault) {
    await prisma.location.updateMany({
      where: { organizationId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  return serialize(await prisma.location.update({
    where: { id, organizationId },
    data: {
      ...parsed,
      parentId: parsed.parentId || null,
    },
  }));
}

export async function deleteLocation(id: string) {
  const { organizationId } = await getOrgContext();
  const location = await prisma.location.findUnique({
    where: { id, organizationId },
    include: { _count: { select: { assets: true, bulkAssets: true, children: true } } },
  });
  if (!location) throw new Error("Location not found");
  if (location._count.children > 0) throw new Error("Cannot delete location with sub-locations");
  if (location._count.assets > 0 || location._count.bulkAssets > 0) {
    throw new Error("Cannot delete location with assets assigned to it");
  }
  return serialize(await prisma.location.delete({ where: { id, organizationId } }));
}

export async function updateLocationNotes(id: string, notes: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.location.update({
    where: { id, organizationId },
    data: { notes: notes || null },
  }));
}
