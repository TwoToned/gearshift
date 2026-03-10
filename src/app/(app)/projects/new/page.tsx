"use client";

import { ProjectForm } from "@/components/projects/project-form";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-muted-foreground">
          Create a new project for a gig, show, or event.
        </p>
      </div>
      <ProjectForm />
    </div>
  );
}
