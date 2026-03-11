"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import {
  projectSchema,
  type ProjectFormValues,
} from "@/lib/validations/project";
import type { Prisma, ProjectStatus } from "@/generated/prisma/client";
import { serialize } from "@/lib/serialize";
import { computeOverbookedStatus } from "@/lib/availability";

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
  sortBy?: string;
  sortOrder?: "asc" | "desc";
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
    sortBy = "createdAt",
    sortOrder = "desc",
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
      orderBy: sortBy === "client" ? { client: { name: sortOrder } }
        : { [sortBy]: sortOrder },
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

/**
 * For a list of project IDs, returns which ones have overbooked or reduced-stock issues.
 * Only computes for projects in active statuses (not completed/cancelled/etc).
 */
export async function getProjectIssueFlags(projectIds: string[]) {
  const { organizationId } = await getOrgContext();
  if (projectIds.length === 0) return {} as Record<string, { hasOverbooked: boolean; hasReducedStock: boolean }>;

  // Only compute for active projects
  const activeStatuses: ProjectStatus[] = ["ENQUIRY", "QUOTING", "QUOTED", "CONFIRMED", "PREPPING", "CHECKED_OUT", "ON_SITE"];
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, organizationId, status: { in: activeStatuses } },
    select: { id: true, rentalStartDate: true, rentalEndDate: true },
  });

  if (projects.length === 0) return {} as Record<string, { hasOverbooked: boolean; hasReducedStock: boolean }>;

  const activeIds = projects.map((p) => p.id);

  // Batch fetch all line items across all active projects
  const allLineItems = await prisma.projectLineItem.findMany({
    where: {
      organizationId,
      projectId: { in: activeIds },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true, projectId: true, modelId: true, quantity: true,
      isKitChild: true, parentLineItemId: true, kitId: true, status: true,
    },
  });

  const result: Record<string, { hasOverbooked: boolean; hasReducedStock: boolean }> = {};

  // Compute per project
  for (const project of projects) {
    const items = allLineItems.filter((li) => li.projectId === project.id);
    if (items.length === 0) continue;

    const overbookedMap = await computeOverbookedStatus(
      organizationId, items, project.rentalStartDate, project.rentalEndDate, project.id,
    );

    if (overbookedMap.size === 0) continue;

    let hasOverbooked = false;
    let hasReducedStock = false;
    for (const info of overbookedMap.values()) {
      if (info.reducedOnly) hasReducedStock = true;
      else hasOverbooked = true;
    }
    result[project.id] = { hasOverbooked, hasReducedStock };
  }

  return result;
}

export async function getProject(id: string) {
  const { organizationId } = await getOrgContext();
  const project = await prisma.project.findUnique({
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
      media: {
        include: { file: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!project) return null;

  const overbookedMap = await computeOverbookedStatus(
    organizationId,
    project.lineItems,
    project.rentalStartDate,
    project.rentalEndDate,
    project.id,
  );

  const enrichedLineItems = project.lineItems.map((li) => {
    const info = overbookedMap.get(li.id);
    return {
      ...li,
      isOverbooked: !!info,
      overbookedInfo: info ?? null,
      childLineItems: li.childLineItems?.map((child) => {
        const childInfo = overbookedMap.get(child.id);
        return {
          ...child,
          isOverbooked: !!childInfo,
          overbookedInfo: childInfo ?? null,
        };
      }),
    };
  });

  return serialize({ ...project, lineItems: enrichedLineItems });
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
        invoicedTotal: parsed.invoicedTotal ?? null,
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
        invoicedTotal: parsed.invoicedTotal ?? null,
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

export async function updateProjectNotes(
  id: string,
  field: "crewNotes" | "internalNotes" | "clientNotes",
  notes: string,
) {
  const { organizationId } = await getOrgContext();
  return serialize(await prisma.project.update({
    where: { id, organizationId },
    data: { [field]: notes || null },
  }));
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
