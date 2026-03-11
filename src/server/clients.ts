"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { clientSchema, type ClientFormValues } from "@/lib/validations/client";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";

export async function getClients(params?: {
  search?: string;
  type?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { organizationId } = await getOrgContext();
  const {
    search, type, isActive = true, page = 1, pageSize = 25,
    sortBy = "name", sortOrder = "asc",
  } = params || {};

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
    },
  }));
}

export async function createClient(data: ClientFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = clientSchema.parse(data);

  return serialize(await prisma.client.create({
    data: {
      organizationId,
      name: parsed.name,
      type: parsed.type,
      contactName: parsed.contactName || null,
      contactEmail: parsed.contactEmail || null,
      contactPhone: parsed.contactPhone || null,
      billingAddress: parsed.billingAddress || null,
      shippingAddress: parsed.shippingAddress || null,
      taxId: parsed.taxId || null,
      paymentTerms: parsed.paymentTerms || null,
      defaultDiscount: parsed.defaultDiscount ?? null,
      notes: parsed.notes || null,
      tags: parsed.tags,
      isActive: parsed.isActive,
    },
  }));
}

export async function updateClient(id: string, data: ClientFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = clientSchema.parse(data);

  return serialize(await prisma.client.update({
    where: { id, organizationId },
    data: {
      name: parsed.name,
      type: parsed.type,
      contactName: parsed.contactName || null,
      contactEmail: parsed.contactEmail || null,
      contactPhone: parsed.contactPhone || null,
      billingAddress: parsed.billingAddress || null,
      shippingAddress: parsed.shippingAddress || null,
      taxId: parsed.taxId || null,
      paymentTerms: parsed.paymentTerms || null,
      defaultDiscount: parsed.defaultDiscount ?? null,
      notes: parsed.notes || null,
      tags: parsed.tags,
      isActive: parsed.isActive,
    },
  }));
}

export async function archiveClient(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.client.update({
    where: { id, organizationId },
    data: { isActive: false },
  }));
}
