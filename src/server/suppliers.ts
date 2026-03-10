"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";
import { supplierSchema, type SupplierFormValues } from "@/lib/validations/asset";

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
  const { organizationId } = await getOrgContext();
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
  return serialize(
    await prisma.supplier.create({
      data: { ...cleaned, organizationId },
    })
  );
}

export async function updateSupplier(id: string, data: SupplierFormValues) {
  const { organizationId } = await getOrgContext();
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
  return serialize(
    await prisma.supplier.update({
      where: { id, organizationId },
      data: cleaned,
    })
  );
}

export async function deleteSupplier(id: string) {
  const { organizationId } = await getOrgContext();
  const supplier = await prisma.supplier.findUnique({
    where: { id, organizationId },
    include: { _count: { select: { assets: true } } },
  });
  if (!supplier) throw new Error("Supplier not found");
  if (supplier._count.assets > 0) {
    throw new Error("Cannot delete supplier with assets linked to it");
  }
  await prisma.supplier.delete({ where: { id, organizationId } });
  return { success: true };
}
