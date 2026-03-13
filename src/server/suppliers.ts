"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext, requirePermission } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";
import { supplierSchema, type SupplierFormValues } from "@/lib/validations/asset";
import { logActivity } from "@/lib/activity-log";

export async function getSuppliers() {
  const { organizationId } = await getOrgContext();
  return serialize(
    await prisma.supplier.findMany({
      where: { organizationId, isActive: true },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: "asc" },
    })
  );
}

export async function createSupplier(data: SupplierFormValues) {
  const { organizationId, userId, userName } = await requirePermission("orgSettings", "update");
  const parsed = supplierSchema.parse(data);
  // Clean empty strings to null
  const cleaned = {
    ...parsed,
    email: parsed.email || null,
    contactName: parsed.contactName || null,
    phone: parsed.phone || null,
    website: parsed.website || null,
    address: parsed.address || null,
    notes: parsed.notes || null,
  };
  const result = await prisma.supplier.create({
    data: { ...cleaned, organizationId },
  });

  await logActivity({
    organizationId,
    userId,
    userName,
    action: "CREATE",
    entityType: "supplier",
    entityId: result.id,
    entityName: result.name,
    summary: `Created supplier ${result.name}`,
  });

  return serialize(result);
}

export async function updateSupplier(id: string, data: SupplierFormValues) {
  const { organizationId, userId, userName } = await requirePermission("orgSettings", "update");
  const parsed = supplierSchema.parse(data);
  const cleaned = {
    ...parsed,
    email: parsed.email || null,
    contactName: parsed.contactName || null,
    phone: parsed.phone || null,
    website: parsed.website || null,
    address: parsed.address || null,
    notes: parsed.notes || null,
  };
  const updated = await prisma.supplier.update({
    where: { id, organizationId },
    data: cleaned,
  });

  await logActivity({
    organizationId,
    userId,
    userName,
    action: "UPDATE",
    entityType: "supplier",
    entityId: updated.id,
    entityName: updated.name,
    summary: `Updated supplier ${updated.name}`,
  });

  return serialize(updated);
}

export async function deleteSupplier(id: string) {
  const { organizationId, userId, userName } = await requirePermission("orgSettings", "update");
  const supplier = await prisma.supplier.findUnique({
    where: { id, organizationId },
    include: { _count: { select: { assets: true } } },
  });
  if (!supplier) throw new Error("Supplier not found");
  if (supplier._count.assets > 0) {
    throw new Error("Cannot delete supplier with assets linked to it");
  }
  await prisma.supplier.delete({ where: { id, organizationId } });

  await logActivity({
    organizationId,
    userId,
    userName,
    action: "DELETE",
    entityType: "supplier",
    entityId: id,
    entityName: supplier.name,
    summary: `Deleted supplier ${supplier.name}`,
    details: { deleted: { name: supplier.name } },
  });

  return { success: true };
}
