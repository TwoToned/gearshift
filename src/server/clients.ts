"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext, requirePermission } from "@/lib/org-context";
import { clientSchema, type ClientFormValues } from "@/lib/validations/client";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity-log";
import { buildFilterWhere, type FilterValue, type FilterColumnDef } from "@/lib/table-utils";

const clientFilterColumns: FilterColumnDef[] = [
  { id: "type", filterType: "enum", filterKey: "type" },
];

export async function getClients(params?: {
  search?: string;
  type?: string;
  isActive?: boolean;
  filters?: Record<string, FilterValue>;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { organizationId } = await getOrgContext();
  const {
    search, type, isActive = true, filters, page = 1, pageSize = 25,
    sortBy = "name", sortOrder = "asc",
  } = params || {};

  const filterWhere = buildFilterWhere(filters, clientFilterColumns);

  const where: Prisma.ClientWhereInput = {
    organizationId,
    isActive,
    ...(type && { type: type as Prisma.EnumClientTypeFilter }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...filterWhere,
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        _count: { select: { projects: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.client.count({ where }),
  ]);

  return serialize({ clients, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getClient(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.client.findUnique({
    where: { id, organizationId },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          _count: { select: { lineItems: true } },
        },
      },
      media: {
        include: { file: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  }));
}

export async function createClient(data: ClientFormValues) {
  const { organizationId, userId, userName } = await requirePermission("client", "create");
  const parsed = clientSchema.parse(data);

  const result = await prisma.client.create({
    data: {
      organizationId,
      name: parsed.name,
      type: parsed.type,
      contactName: parsed.contactName || null,
      contactEmail: parsed.contactEmail || null,
      contactPhone: parsed.contactPhone || null,
      billingAddress: parsed.billingAddress || null,
      billingLatitude: parsed.billingLatitude ?? null,
      billingLongitude: parsed.billingLongitude ?? null,
      shippingAddress: parsed.shippingAddress || null,
      shippingLatitude: parsed.shippingLatitude ?? null,
      shippingLongitude: parsed.shippingLongitude ?? null,
      taxId: parsed.taxId || null,
      paymentTerms: parsed.paymentTerms || null,
      defaultDiscount: parsed.defaultDiscount ?? null,
      notes: parsed.notes || null,
      tags: parsed.tags,
      isActive: parsed.isActive,
    },
  });

  await logActivity({
    organizationId,
    userId,
    userName,
    action: "CREATE",
    entityType: "client",
    entityId: result.id,
    entityName: result.name,
    summary: `Created client ${result.name}`,
  });

  return serialize(result);
}

export async function updateClient(id: string, data: ClientFormValues) {
  const { organizationId, userId, userName } = await requirePermission("client", "update");
  const parsed = clientSchema.parse(data);

  const updated = await prisma.client.update({
    where: { id, organizationId },
    data: {
      name: parsed.name,
      type: parsed.type,
      contactName: parsed.contactName || null,
      contactEmail: parsed.contactEmail || null,
      contactPhone: parsed.contactPhone || null,
      billingAddress: parsed.billingAddress || null,
      billingLatitude: parsed.billingLatitude ?? null,
      billingLongitude: parsed.billingLongitude ?? null,
      shippingAddress: parsed.shippingAddress || null,
      shippingLatitude: parsed.shippingLatitude ?? null,
      shippingLongitude: parsed.shippingLongitude ?? null,
      taxId: parsed.taxId || null,
      paymentTerms: parsed.paymentTerms || null,
      defaultDiscount: parsed.defaultDiscount ?? null,
      notes: parsed.notes || null,
      tags: parsed.tags,
      isActive: parsed.isActive,
    },
  });

  await logActivity({
    organizationId,
    userId,
    userName,
    action: "UPDATE",
    entityType: "client",
    entityId: updated.id,
    entityName: updated.name,
    summary: `Updated client ${updated.name}`,
  });

  return serialize(updated);
}

export async function updateClientNotes(id: string, notes: string) {
  const { organizationId } = await requirePermission("client", "update");
  return serialize(await prisma.client.update({
    where: { id, organizationId },
    data: { notes: notes || null },
  }));
}

export async function archiveClient(id: string) {
  const { organizationId, userId, userName } = await requirePermission("client", "update");
  const archived = await prisma.client.update({
    where: { id, organizationId },
    data: { isActive: false },
  });

  await logActivity({
    organizationId,
    userId,
    userName,
    action: "DELETE",
    entityType: "client",
    entityId: id,
    entityName: archived.name,
    summary: `Archived client ${archived.name}`,
  });

  return serialize(archived);
}
