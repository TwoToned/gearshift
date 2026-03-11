"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Archive,
  Trash2,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Package,
  DollarSign,
  FileText,
  ChevronDown,
} from "lucide-react";
import { LineItemsPanel } from "@/components/projects/line-items-panel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  getProject,
  updateProjectStatus,
  updateProjectNotes,
  archiveProject,
  deleteProject,
} from "@/server/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addProjectMedia, removeProjectMedia, getProjectMedia } from "@/server/project-media";
import { MediaUploader, type MediaItem } from "@/components/media/media-uploader";
import { NotesEditor } from "@/components/ui/notes-editor";
import { NotViewer } from "@/components/auth/permission-gate";
import type { ProjectMediaType } from "@/generated/prisma/client";

const statusColors: Record<string, string> = {
  ENQUIRY: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  QUOTING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  QUOTED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  CONFIRMED: "bg-green-500/10 text-green-500 border-green-500/20",
  PREPPING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  CHECKED_OUT: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ON_SITE: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  RETURNED: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  COMPLETED: "bg-green-500/10 text-green-500 border-green-500/20",
  INVOICED: "bg-green-500/10 text-green-500 border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  ENQUIRY: "Enquiry",
  QUOTING: "Quoting",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  PREPPING: "Prepping",
  CHECKED_OUT: "Checked Out",
  ON_SITE: "On Site",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  INVOICED: "Invoiced",
  CANCELLED: "Cancelled",
};

const typeLabels: Record<string, string> = {
  DRY_HIRE: "Dry Hire",
  WET_HIRE: "Wet Hire",
  INSTALLATION: "Installation",
  TOUR: "Tour",
  CORPORATE: "Corporate",
  THEATRE: "Theatre",
  FESTIVAL: "Festival",
  CONFERENCE: "Conference",
  OTHER: "Other",
};

const allStatuses = [
  "ENQUIRY",
  "QUOTING",
  "QUOTED",
  "CONFIRMED",
  "PREPPING",
  "CHECKED_OUT",
  "ON_SITE",
  "RETURNED",
  "COMPLETED",
  "INVOICED",
  "CANCELLED",
];

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatus: string) =>
      updateProjectStatus(
        id,
        nextStatus as Parameters<typeof updateProjectStatus>[1]
      ),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(id),
    onSuccess: () => {
      toast.success("Project cancelled");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push("/projects");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!project) {
    return <div className="text-muted-foreground">Project not found.</div>;
  }

  const currentStatus = project.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {project.projectNumber}
            </span>
            <Badge
              variant="outline"
              className={statusColors[project.status] || ""}
            >
              {statusLabels[project.status] || project.status}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">
            {project.name}
          </h1>
          {project.client && (
            <p className="text-muted-foreground">
              <Link
                href={`/clients/${project.client.id}`}
                className="hover:underline"
              >
                {project.client.name}
              </Link>
              {project.location && <> &middot; {project.location.name}</>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" />}
            >
              <FileText className="mr-2 h-4 w-4" />
              Documents
              <ChevronDown className="ml-1 h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => window.open(`/api/documents/${id}?type=quote`, "_blank")}
              >
                Quote / Proposal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/api/documents/${id}?type=invoice`, "_blank")}
              >
                Invoice
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/api/documents/${id}?type=pull-slip`, "_blank")}
              >
                Pull Slip
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/api/documents/${id}?type=delivery-docket`, "_blank")}
              >
                Delivery Docket
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/api/documents/${id}?type=return-sheet`, "_blank")}
              >
                Return Sheet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <NotViewer>
            <Button
              variant="outline"
              render={<Link href={`/projects/${id}/edit`} />}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {project.status === "CANCELLED" ? (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Permanently delete this project? This cannot be undone.")) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Cancel this project?")) archiveMutation.mutate();
                }}
                disabled={archiveMutation.isPending}
              >
                <Archive className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
          </NotViewer>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="files">Files ({(project.media || []).length})</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <div className="space-y-6 pt-4">
            {/* Status */}
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Status:
                </span>
                <NotViewer fallback={
                  <Badge variant="outline" className={statusColors[currentStatus] || ""}>
                    {statusLabels[currentStatus] || currentStatus}
                  </Badge>
                }>
                  <select
                    value={currentStatus}
                    onChange={(e) => statusMutation.mutate(e.target.value)}
                    disabled={statusMutation.isPending}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {allStatuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s] || s}
                      </option>
                    ))}
                  </select>
                </NotViewer>
              </CardContent>
            </Card>

            {/* Info cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Client Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {project.client ? (
                    <>
                      <Link
                        href={`/clients/${project.client.id}`}
                        className="font-medium hover:underline"
                      >
                        {project.client.name}
                      </Link>
                      {project.client.contactEmail && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{project.client.contactEmail}</span>
                        </div>
                      )}
                      {project.client.contactPhone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{project.client.contactPhone}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No client assigned</p>
                  )}
                </CardContent>
              </Card>

              {/* Location & Site Contact */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Location &amp; Site Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {project.location ? (
                    <>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{project.location.name}</span>
                      </div>
                      {project.location.address && (
                        <p className="text-muted-foreground">
                          {project.location.address}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">No location set</span>
                    </div>
                  )}
                  {project.siteContactName && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="font-medium">{project.siteContactName}</p>
                      {project.siteContactPhone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{project.siteContactPhone}</span>
                        </div>
                      )}
                      {project.siteContactEmail && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{project.siteContactEmail}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dates */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Rental Period
                    </span>
                    <span className="font-medium">
                      {formatDate(project.rentalStartDate as string | null)} –{" "}
                      {formatDate(project.rentalEndDate as string | null)}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Load In</span>
                    <span className="font-medium">
                      {formatDate(project.loadInDate as string | null)}
                      {project.loadInTime && ` ${project.loadInTime}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Load Out</span>
                    <span className="font-medium">
                      {formatDate(project.loadOutDate as string | null)}
                      {project.loadOutTime && ` ${project.loadOutTime}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Start</span>
                    <span className="font-medium">
                      {formatDate(project.eventStartDate as string | null)}
                      {project.eventStartTime &&
                        ` ${project.eventStartTime}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event End</span>
                    <span className="font-medium">
                      {formatDate(project.eventEndDate as string | null)}
                      {project.eventEndTime && ` ${project.eventEndTime}`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Financial */}
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Financial Summary
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7 text-sm">
                    <div>
                      <span className="text-muted-foreground">Subtotal</span>
                      <p className="font-medium">
                        {formatCurrency(project.subtotal as number | null)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Discount</span>
                      <p className="font-medium">
                        {project.discountPercent != null
                          ? `${Number(project.discountPercent)}%`
                          : "—"}
                        {project.discountAmount != null &&
                          ` (${formatCurrency(project.discountAmount as unknown as number)})`}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax</span>
                      <p className="font-medium">
                        {formatCurrency(project.taxAmount as number | null)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total</span>
                      <p className="font-semibold text-base">
                        {formatCurrency(project.total as number | null)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Invoiced Total</span>
                      <p className="font-semibold text-base">
                        {project.invoicedTotal != null
                          ? formatCurrency(project.invoicedTotal as unknown as number)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Deposit
                      </span>
                      <p className="font-medium">
                        {project.depositPercent != null
                          ? `${Number(project.depositPercent)}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Deposit Paid
                      </span>
                      <p className="font-medium">
                        {formatCurrency(project.depositPaid as number | null)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            {project.description && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {project.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Project Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Project Info
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {typeLabels[project.type] || project.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {formatDate(project.createdAt as unknown as string)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">
                    {formatDate(project.updatedAt as unknown as string)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Equipment Tab */}
        <TabsContent value="equipment">
          <div className="pt-4">
            <LineItemsPanel
              projectId={id}
              rentalStartDate={
                project.rentalStartDate
                  ? new Date(project.rentalStartDate as unknown as string)
                  : undefined
              }
              rentalEndDate={
                project.rentalEndDate
                  ? new Date(project.rentalEndDate as unknown as string)
                  : undefined
              }
            />
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <div className="grid gap-4 pt-4">
            <NotesEditor
              title="Crew Notes"
              initialNotes={project.crewNotes || ""}
              queryKey={["project", id]}
              onSave={(notes) => updateProjectNotes(id, "crewNotes", notes)}
              placeholder="Notes for crew members..."
              rows={4}
            />
            <NotesEditor
              title="Internal Notes"
              initialNotes={project.internalNotes || ""}
              queryKey={["project", id]}
              onSave={(notes) => updateProjectNotes(id, "internalNotes", notes)}
              placeholder="Internal notes (not visible to client)..."
              rows={4}
            />
            <NotesEditor
              title="Client Notes"
              initialNotes={project.clientNotes || ""}
              queryKey={["project", id]}
              onSave={(notes) => updateProjectNotes(id, "clientNotes", notes)}
              placeholder="Notes visible to client on documents..."
              rows={4}
            />
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <div className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Files & Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <MediaUploader
                  entityType="project"
                  entityId={id}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.txt"
                  existingMedia={(project.media || []) as MediaItem[]}
                  queryKey={["project", id]}
                  onUploadComplete={async (fileUpload) => {
                    await addProjectMedia({
                      projectId: id,
                      fileId: fileUpload.id,
                      type: "OTHER" as ProjectMediaType,
                    });
                  }}
                  onRemove={async (mediaId) => {
                    await removeProjectMedia(mediaId);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
