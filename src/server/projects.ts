"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import {
  projectSchema,
  type ProjectFormValues,
} from "@/lib/validations/project";
import type { Prisma } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";

export async function getProjects(params?: {
  search?: string;
  status?: string;
  type?: string;
  clientId?: string;
  rentalStartDate?: string;
  rentalEndDate?: string;
  page?: number;
  pageSize?: number;
  includeLineItems?: boolean;
}) {
  const { organizationId } = await getOrgContext();
  const {
    search,
    status,
    type,
    clientId,
    rentalStartDate,
    rentalEndDate,
    page = 1,
    pageSize = 25,
    includeLineItems = false,
  } = params || {};

  const where: Prisma.ProjectWhereInput = {
    organizationId,
    ...(status && {
      status: status as Prisma.EnumProjectStatusFilter,
    }),
    ...(type && {
      type: type as Prisma.EnumProjectTypeFilter,
    }),
    ...(clientId && { clientId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { projectNumber: { contains: search, mode: "insensitive" } },
        { location: { name: { contains: search, mode: "insensitive" } } },
      ],
    }),
    ...(rentalStartDate && {
      rentalStartDate: { gte: new Date(rentalStartDate) },
    }),
    ...(rentalEndDate && {
      rentalEndDate: { lte: new Date(rentalEndDate) },
    }),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: true,
        location: true,
        ...(includeLineItems && {
          lineItems: {
            where: { status: { not: "CANCELLED" }, type: "EQUIPMENT" },
            select: { id: true, status: true, type: true, isKitChild: true },
          },
        }),
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  return serialize({
    projects,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function getProject(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(
    await prisma.project.findUnique({
      where: { id, organizationId },
      include: {
        client: true,
        location: true,
        lineItems: {
          include: {
            model: true,
            asset: true,
            bulkAsset: true,
            kit: true,
            childLineItems: {
              include: { model: true, asset: true, bulkAsset: true },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    })
  );
}

export async function createProject(data: ProjectFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = projectSchema.parse(data);

  try {
    return serialize(
      await prisma.project.create({
        data: {
          organizationId,
          projectNumber: parsed.projectNumber,
        name: parsed.name,
        clientId: parsed.clientId || null,
        status: parsed.status,
        type: parsed.type,
        description: parsed.description || null,
        locationId: parsed.locationId || null,
        siteContactName: parsed.siteContactName || null,
        siteContactPhone: parsed.siteContactPhone || null,
        siteContactEmail: parsed.siteContactEmail || null,
        loadInDate: parsed.loadInDate ?? null,
        loadInTime: parsed.loadInTime || null,
        eventStartDate: parsed.eventStartDate ?? null,
        eventStartTime: parsed.eventStartTime || null,
        eventEndDate: parsed.eventEndDate ?? null,
        eventEndTime: parsed.eventEndTime || null,
        loadOutDate: parsed.loadOutDate ?? null,
        loadOutTime: parsed.loadOutTime || null,
        rentalStartDate: parsed.rentalStartDate ?? null,
        rentalEndDate: parsed.rentalEndDate ?? null,
        crewNotes: parsed.crewNotes || null,
        internalNotes: parsed.internalNotes || null,
        clientNotes: parsed.clientNotes || null,
        discountPercent: parsed.discountPercent ?? null,
        depositPercent: parsed.depositPercent ?? null,
        depositPaid: parsed.depositPaid ?? null,
        tags: parsed.tags,
      },
    })
  );
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      throw new Error(`Project code "${parsed.projectNumber}" already exists`);
    }
    throw e;
  }
}

export async function updateProject(id: string, data: ProjectFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = projectSchema.parse(data);

  return serialize(
    await prisma.project.update({
      where: { id, organizationId },
      data: {
        projectNumber: parsed.projectNumber,
        name: parsed.name,
        clientId: parsed.clientId || null,
        status: parsed.status,
        type: parsed.type,
        description: parsed.description || null,
        locationId: parsed.locationId || null,
        siteContactName: parsed.siteContactName || null,
        siteContactPhone: parsed.siteContactPhone || null,
        siteContactEmail: parsed.siteContactEmail || null,
        loadInDate: parsed.loadInDate ?? null,
        loadInTime: parsed.loadInTime || null,
        eventStartDate: parsed.eventStartDate ?? null,
        eventStartTime: parsed.eventStartTime || null,
        eventEndDate: parsed.eventEndDate ?? null,
        eventEndTime: parsed.eventEndTime || null,
        loadOutDate: parsed.loadOutDate ?? null,
        loadOutTime: parsed.loadOutTime || null,
        rentalStartDate: parsed.rentalStartDate ?? null,
        rentalEndDate: parsed.rentalEndDate ?? null,
        crewNotes: parsed.crewNotes || null,
        internalNotes: parsed.internalNotes || null,
        clientNotes: parsed.clientNotes || null,
        discountPercent: parsed.discountPercent ?? null,
        depositPercent: parsed.depositPercent ?? null,
        depositPaid: parsed.depositPaid ?? null,
        tags: parsed.tags,
      },
    })
  );
}

export async function updateProjectStatus(
  id: string,
  status: ProjectFormValues["status"]
) {
  const { organizationId } = await getOrgContext();
  return serialize(
    await prisma.project.update({
      where: { id, organizationId },
      data: { status },
    })
  );
}

export async function archiveProject(id: string) {
  const { organizationId } = await getOrgContext();
  return serialize(
    await prisma.project.update({
      where: { id, organizationId },
      data: { status: "CANCELLED" },
    })
  );
}

export async function deleteProject(id: string) {
  const { organizationId } = await getOrgContext();

  // Only allow deleting cancelled projects
  const project = await prisma.project.findUnique({
    where: { id, organizationId },
  });

  if (!project) throw new Error("Project not found");
  if (project.status !== "CANCELLED") throw new Error("Only cancelled projects can be deleted");

  await prisma.project.delete({
    where: { id, organizationId },
  });
}
