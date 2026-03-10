"use client";

import { ProjectTable } from "@/components/projects/project-table";

export default function ProjectsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          Manage your gigs, shows, and events.
        </p>
      </div>
      <ProjectTable />
    </div>
  );
}
