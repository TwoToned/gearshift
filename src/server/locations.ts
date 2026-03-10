"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { locationSchema, type LocationFormValues } from "@/lib/validations/asset";
import { serialize } from "@/lib/serialize";

export async function getLocations() {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.location.findMany({
    where: { organizationId },
    include: {
      parent: true,
      _count: { select: { assets: true, bulkAssets: true, children: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
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
