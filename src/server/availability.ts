"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getOrgContext } from "@/lib/org-context";

export interface CalendarProject {
  id: string;
  projectNumber: string;
  name: string;
  clientName: string | null;
  status: string;
  rentalStartDate: string;
  rentalEndDate: string;
  lineItemCount: number;
}

/**
 * Get all projects that overlap with the given month range.
 * Returns projects with their rental dates so the UI can place them on calendar days.
 */
export async function getCalendarData(params: {
  startDate: string;
  endDate: string;
}) {
  const { organizationId } = await getOrgContext();
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      status: { notIn: ["CANCELLED"] },
      rentalStartDate: { lte: end },
      rentalEndDate: { gte: start },
    },
    include: {
      client: { select: { name: true } },
      _count: {
        select: {
          lineItems: { where: { status: { not: "CANCELLED" } } },
        },
      },
    },
    orderBy: { rentalStartDate: "asc" },
  });

  const result: CalendarProject[] = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name,
    clientName: p.client?.name || null,
    status: p.status,
    rentalStartDate: p.rentalStartDate?.toISOString() || "",
    rentalEndDate: p.rentalEndDate?.toISOString() || "",
    lineItemCount: p._count.lineItems,
  }));

  return serialize(result) as CalendarProject[];
}
