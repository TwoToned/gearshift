"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "@/server/projects";
import { ProjectForm } from "@/components/projects/project-form";
import type { ProjectFormValues } from "@/lib/validations/project";

function toDateOrUndefined(
  val: string | Date | null | undefined
): Date | undefined {
  if (!val) return undefined;
  return typeof val === "string" ? new Date(val) : val;
}

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  if (isLoading)
    return <div className="text-muted-foreground">Loading...</div>;
  if (!project)
    return <div className="text-muted-foreground">Project not found.</div>;

  const initialData: ProjectFormValues & { id: string } = {
    id: project.id,
    projectNumber: project.projectNumber,
    name: project.name,
    clientId: project.clientId || "",
    status: project.status,
    type: project.type,
    description: project.description || "",
    locationId: project.locationId || "",
    siteContactName: project.siteContactName || "",
    siteContactPhone: project.siteContactPhone || "",
    siteContactEmail: project.siteContactEmail || "",
    loadInDate: toDateOrUndefined(project.loadInDate as string | null),
    loadInTime: project.loadInTime || "",
    eventStartDate: toDateOrUndefined(
      project.eventStartDate as string | null
    ),
    eventStartTime: project.eventStartTime || "",
    eventEndDate: toDateOrUndefined(project.eventEndDate as string | null),
    eventEndTime: project.eventEndTime || "",
    loadOutDate: toDateOrUndefined(project.loadOutDate as string | null),
    loadOutTime: project.loadOutTime || "",
    rentalStartDate: toDateOrUndefined(
      project.rentalStartDate as string | null
    ),
    rentalEndDate: toDateOrUndefined(project.rentalEndDate as string | null),
    crewNotes: project.crewNotes || "",
    internalNotes: project.internalNotes || "",
    clientNotes: project.clientNotes || "",
    discountPercent: project.discountPercent
      ? Number(project.discountPercent)
      : undefined,
    depositPercent: project.depositPercent
      ? Number(project.depositPercent)
      : undefined,
    depositPaid: project.depositPaid
      ? Number(project.depositPaid)
      : undefined,
    tags: project.tags || [],
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Project</h1>
        <p className="text-muted-foreground">
          {project.projectNumber} &middot; {project.name}
        </p>
      </div>
      <ProjectForm initialData={initialData} />
    </div>
  );
}
