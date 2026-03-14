"use client";

import { use, useState } from "react";
import Link from "next/link";
import { PageMeta } from "@/components/layout/page-meta";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Pencil,
  Mail,
  Phone,
  Trash2,
  Plus,
  Loader2,
  Briefcase,
  CalendarOff,
  CalendarSync,
  Copy,
  RefreshCw,
} from "lucide-react";
import { AddressDisplay } from "@/components/ui/address-display";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  getCrewMemberById,
  deleteCrewMember,
  addCertification,
  removeCertification,
} from "@/server/crew";
import {
  getCrewAvailability,
  addAvailability,
  removeAvailability,
} from "@/server/crew-availability";
import {
  getIcalSettings,
  enableIcalFeed,
  disableIcalFeed,
  regenerateIcalToken,
} from "@/server/crew-calendar";
import {
  crewMemberStatusLabels,
  crewMemberTypeLabels,
  crewCertStatusLabels,
  assignmentStatusLabels,
  phaseLabels,
  availabilityTypeLabels,
  formatLabel,
} from "@/lib/status-labels";
import {
  crewCertificationSchema,
  type CrewCertificationFormValues,
  crewAvailabilitySchema,
  type CrewAvailabilityFormValues,
} from "@/lib/validations/crew";
import { useActiveOrganization } from "@/lib/auth-client";
import { CanDo } from "@/components/auth/permission-gate";
import { RequirePermission } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
  INACTIVE: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  ON_LEAVE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  ARCHIVED: "bg-red-500/10 text-red-500 border-red-500/20",
};

const certStatusColors: Record<string, string> = {
  CURRENT: "bg-green-500/10 text-green-500 border-green-500/20",
  EXPIRING_SOON: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  EXPIRED: "bg-red-500/10 text-red-500 border-red-500/20",
  NOT_VERIFIED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const assignmentStatusColors: Record<string, string> = {
  PENDING: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  OFFERED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ACCEPTED: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  DECLINED: "bg-red-500/10 text-red-500 border-red-500/20",
  CONFIRMED: "bg-green-500/10 text-green-500 border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
  COMPLETED: "bg-green-500/10 text-green-500 border-green-500/20",
};

const projectStatusColors: Record<string, string> = {
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

const availabilityTypeColors: Record<string, string> = {
  UNAVAILABLE: "bg-red-500/10 text-red-500 border-red-500/20",
  TENTATIVE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  PREFERRED: "bg-green-500/10 text-green-500 border-green-500/20",
};

const projectStatusLabels: Record<string, string> = {
  ENQUIRY: "Enquiry",
  QUOTING: "Quoting",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  PREPPING: "Prepping",
  CHECKED_OUT: "Deployed",
  ON_SITE: "On Site",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  INVOICED: "Invoiced",
  CANCELLED: "Cancelled",
};

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CrewMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const [addCertOpen, setAddCertOpen] = useState(false);
  const [addAvailOpen, setAddAvailOpen] = useState(false);

  const { data: member, isLoading } = useQuery({
    queryKey: ["crew-member", orgId, id],
    queryFn: () => getCrewMemberById(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCrewMember(id),
    onSuccess: () => {
      toast.success("Crew member deleted");
      queryClient.invalidateQueries({ queryKey: ["crew-members"] });
      router.push("/crew");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeCertMutation = useMutation({
    mutationFn: (certId: string) => removeCertification(certId),
    onSuccess: () => {
      toast.success("Certification removed");
      queryClient.invalidateQueries({
        queryKey: ["crew-member", orgId, id],
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: availabilityRecords } = useQuery({
    queryKey: ["crew-availability", orgId, id],
    queryFn: () => getCrewAvailability(id),
  });

  const { data: icalSettings } = useQuery({
    queryKey: ["crew-ical", orgId, id],
    queryFn: () => getIcalSettings(id),
  });

  const enableIcalMutation = useMutation({
    mutationFn: () => enableIcalFeed(id),
    onSuccess: () => {
      toast.success("iCal feed enabled");
      queryClient.invalidateQueries({ queryKey: ["crew-ical", orgId, id] });
    },
    onError: (e) => toast.error(e.message),
  });

  const disableIcalMutation = useMutation({
    mutationFn: () => disableIcalFeed(id),
    onSuccess: () => {
      toast.success("iCal feed disabled");
      queryClient.invalidateQueries({ queryKey: ["crew-ical", orgId, id] });
    },
    onError: (e) => toast.error(e.message),
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: () => regenerateIcalToken(id),
    onSuccess: () => {
      toast.success("iCal token regenerated — old URL is now invalid");
      queryClient.invalidateQueries({ queryKey: ["crew-ical", orgId, id] });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeAvailMutation = useMutation({
    mutationFn: (availId: string) => removeAvailability(availId),
    onSuccess: () => {
      toast.success("Availability block removed");
      queryClient.invalidateQueries({
        queryKey: ["crew-availability", orgId, id],
      });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading)
    return <div className="text-muted-foreground">Loading...</div>;
  if (!member)
    return <div className="text-muted-foreground">Crew member not found.</div>;

  const fullName = `${member.firstName} ${member.lastName}`;
  const certifications = member.certifications || [];
  const skills = member.skills || [];
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const assignments = (member as any).assignments || [];

  return (
    <RequirePermission resource="crew" action="read">
      <PageMeta title={fullName} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
              <Badge
                variant="outline"
                className={statusColors[member.status] || ""}
              >
                {crewMemberStatusLabels[member.status] ||
                  formatLabel(member.status)}
              </Badge>
              <Badge variant="outline">
                {crewMemberTypeLabels[member.type] || formatLabel(member.type)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {member.crewRole?.name || "No role assigned"}
              {member.department && <> &middot; {member.department}</>}
            </p>
          </div>
          <CanDo resource="crew" action="update">
            <div className="flex gap-2">
              <Button
                variant="outline"
                render={<Link href={`/crew/${id}/edit`} />}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <CanDo resource="crew" action="delete">
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this crew member? This cannot be undone."
                      )
                    )
                      deleteMutation.mutate();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </CanDo>
            </div>
          </CanDo>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {member.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <a
                    href={`mailto:${member.email}`}
                    className="hover:underline"
                  >
                    {member.email}
                  </a>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${member.phone}`} className="hover:underline">
                    {member.phone}
                  </a>
                </div>
              )}
              {member.address && (
                <div className="mt-2">
                  <AddressDisplay
                    address={member.address}
                    latitude={member.addressLatitude}
                    longitude={member.addressLongitude}
                    label={fullName}
                    compact
                  />
                </div>
              )}
              {!member.email && !member.phone && !member.address && (
                <p className="text-muted-foreground">No contact info</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Day Rate</span>
                <span className="font-medium">
                  {member.defaultDayRate != null
                    ? `$${Number(member.defaultDayRate).toFixed(2)}`
                    : "\u2014"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Hourly Rate</span>
                <span className="font-medium">
                  {member.defaultHourlyRate != null
                    ? `$${Number(member.defaultHourlyRate).toFixed(2)}`
                    : "\u2014"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>OT Multiplier</span>
                <span className="font-medium">
                  {member.overtimeMultiplier != null
                    ? `${Number(member.overtimeMultiplier)}x`
                    : "\u2014"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {member.emergencyContactName ? (
                <>
                  <p className="font-medium">{member.emergencyContactName}</p>
                  {member.emergencyContactPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <a
                        href={`tel:${member.emergencyContactPhone}`}
                        className="hover:underline"
                      >
                        {member.emergencyContactPhone}
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Not set</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Skills */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Skills
            </h3>
            <CanDo resource="crew" action="update">
              <Button
                variant="ghost"
                size="sm"
                render={<Link href={`/crew/${id}/edit`} />}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit Skills
              </Button>
            </CanDo>
          </div>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {skills.map(
                (skill: {
                  id: string;
                  name: string;
                  category: string | null;
                }) => (
                  <Badge key={skill.id} variant="secondary">
                    {skill.name}
                  </Badge>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No skills assigned.{" "}
              <CanDo resource="crew" action="update">
                <Link
                  href={`/crew/${id}/edit`}
                  className="text-primary hover:underline"
                >
                  Add skills via Edit
                </Link>
              </CanDo>
            </p>
          )}
        </div>

        {/* Tags */}
        {member.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {member.tags.map((tag: string) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Notes */}
        {member.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{member.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments">
              Assignments ({assignments.length})
            </TabsTrigger>
            <TabsTrigger value="availability">
              Availability ({availabilityRecords?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="certifications">
              Certifications ({certifications.length})
            </TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Project Assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No project assignments yet.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Role
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Phase
                          </TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Assignment</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Project Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map(
                          (a: {
                            id: string;
                            status: string;
                            phase: string | null;
                            startDate: string | null;
                            endDate: string | null;
                            project: {
                              id: string;
                              name: string;
                              projectNumber: string;
                              status: string;
                            };
                            crewRole: {
                              name: string;
                              color: string | null;
                            } | null;
                          }) => (
                            <TableRow key={a.id}>
                              <TableCell>
                                <Link
                                  href={`/projects/${a.project.id}`}
                                  className="font-medium hover:underline"
                                >
                                  <div className="flex items-center gap-2">
                                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                    <div>
                                      <div>{a.project.name}</div>
                                      <div className="text-xs text-muted-foreground font-mono">
                                        {a.project.projectNumber}
                                      </div>
                                    </div>
                                  </div>
                                </Link>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {a.crewRole ? (
                                  <Badge
                                    variant="outline"
                                    style={
                                      a.crewRole.color
                                        ? {
                                            borderColor: a.crewRole.color,
                                            color: a.crewRole.color,
                                            backgroundColor: `${a.crewRole.color}15`,
                                          }
                                        : undefined
                                    }
                                  >
                                    {a.crewRole.name}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {"\u2014"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm">
                                {a.phase
                                  ? phaseLabels[a.phase] || a.phase
                                  : "\u2014"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDate(a.startDate)}
                                {a.endDate && a.endDate !== a.startDate
                                  ? ` \u2013 ${formatDate(a.endDate)}`
                                  : ""}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    assignmentStatusColors[a.status] || ""
                                  }
                                >
                                  {assignmentStatusLabels[a.status] ||
                                    formatLabel(a.status)}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge
                                  variant="outline"
                                  className={
                                    projectStatusColors[a.project.status] || ""
                                  }
                                >
                                  {projectStatusLabels[a.project.status] ||
                                    a.project.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Availability Tab */}
          <TabsContent value="availability" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Availability Blocks
                </CardTitle>
                <CanDo resource="crew" action="update">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddAvailOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Block
                  </Button>
                </CanDo>
              </CardHeader>
              <CardContent>
                {!availabilityRecords || availabilityRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No availability blocks set. Add blocks to indicate when this
                    crew member is unavailable, tentative, or preferred.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Time
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Reason
                          </TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availabilityRecords.map(
                          (av: {
                            id: string;
                            type: string;
                            startDate: string | Date;
                            endDate: string | Date;
                            isAllDay: boolean;
                            startTime: string | null;
                            endTime: string | null;
                            reason: string | null;
                          }) => (
                            <TableRow key={av.id}>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    availabilityTypeColors[av.type] || ""
                                  }
                                >
                                  <CalendarOff className="mr-1 h-3 w-3" />
                                  {availabilityTypeLabels[av.type] ||
                                    formatLabel(av.type)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDate(av.startDate)}
                                {av.endDate !== av.startDate
                                  ? ` \u2013 ${formatDate(av.endDate)}`
                                  : ""}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                                {av.isAllDay
                                  ? "All Day"
                                  : `${av.startTime || ""} \u2013 ${av.endTime || ""}`}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                                {av.reason || "\u2014"}
                              </TableCell>
                              <TableCell>
                                <CanDo resource="crew" action="update">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Remove this availability block?"
                                        )
                                      )
                                        removeAvailMutation.mutate(av.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </CanDo>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certifications Tab */}
          <TabsContent value="certifications" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Certifications & Qualifications
                </CardTitle>
                <CanDo resource="crew" action="update">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddCertOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Certification
                  </Button>
                </CanDo>
              </CardHeader>
              <CardContent>
                {certifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No certifications recorded.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Issued By
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Certificate #
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Issued
                          </TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {certifications.map(
                          (cert: {
                            id: string;
                            name: string;
                            issuedBy: string | null;
                            certificateNumber: string | null;
                            issuedDate: Date | string | null;
                            expiryDate: Date | string | null;
                            status: string;
                          }) => (
                            <TableRow key={cert.id}>
                              <TableCell className="font-medium">
                                {cert.name}
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden md:table-cell">
                                {cert.issuedBy || "\u2014"}
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden md:table-cell font-mono text-sm">
                                {cert.certificateNumber || "\u2014"}
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden md:table-cell">
                                {cert.issuedDate
                                  ? new Date(
                                      cert.issuedDate
                                    ).toLocaleDateString()
                                  : "\u2014"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {cert.expiryDate
                                  ? new Date(
                                      cert.expiryDate
                                    ).toLocaleDateString()
                                  : "\u2014"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    certStatusColors[cert.status] || ""
                                  }
                                >
                                  {crewCertStatusLabels[cert.status] ||
                                    formatLabel(cert.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <CanDo resource="crew" action="update">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Remove certification "${cert.name}"?`
                                        )
                                      )
                                        removeCertMutation.mutate(cert.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </CanDo>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarSync className="h-4 w-4" />
                  iCal Feed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enable an iCal feed URL that can be subscribed to from Google
                  Calendar, Apple Calendar, Outlook, or any calendar app. The
                  feed includes all confirmed assignments.
                </p>

                {icalSettings?.icalEnabled && icalSettings?.icalToken ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Feed URL
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/crew/calendar/${icalSettings.icalToken}`}
                          className="font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/api/crew/calendar/${icalSettings.icalToken}`
                            );
                            toast.success("Feed URL copied to clipboard");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <CanDo resource="crew" action="update">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                "Regenerate token? The old URL will stop working."
                              )
                            )
                              regenerateTokenMutation.mutate();
                          }}
                          disabled={regenerateTokenMutation.isPending}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          Regenerate URL
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => disableIcalMutation.mutate()}
                          disabled={disableIcalMutation.isPending}
                        >
                          Disable Feed
                        </Button>
                      </div>
                    </CanDo>
                  </div>
                ) : (
                  <CanDo resource="crew" action="update">
                    <Button
                      variant="outline"
                      onClick={() => enableIcalMutation.mutate()}
                      disabled={enableIcalMutation.isPending}
                    >
                      {enableIcalMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <CalendarSync className="mr-2 h-4 w-4" />
                      Enable iCal Feed
                    </Button>
                  </CanDo>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Certification Dialog */}
      <AddCertificationDialog
        crewMemberId={id}
        open={addCertOpen}
        onOpenChange={setAddCertOpen}
      />

      {/* Add Availability Dialog */}
      <AddAvailabilityDialog
        crewMemberId={id}
        open={addAvailOpen}
        onOpenChange={setAddAvailOpen}
      />
    </RequirePermission>
  );
}

// ─── Add Certification Dialog ──────────────────────────────────────────────────

function AddCertificationDialog({
  crewMemberId,
  open,
  onOpenChange,
}: {
  crewMemberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const form = useForm<CrewCertificationFormValues>({
    resolver: zodResolver(crewCertificationSchema),
    defaultValues: {
      name: "",
      issuedBy: "",
      certificateNumber: "",
      status: "NOT_VERIFIED",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CrewCertificationFormValues) =>
      addCertification(crewMemberId, data),
    onSuccess: () => {
      toast.success("Certification added");
      queryClient.invalidateQueries({
        queryKey: ["crew-member", orgId, crewMemberId],
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Certification</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              placeholder="e.g. White Card, Working at Heights"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Issued By</Label>
            <Input
              placeholder="Issuing authority"
              {...form.register("issuedBy")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Certificate Number</Label>
            <Input
              placeholder="Certificate #"
              {...form.register("certificateNumber")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Issued Date</Label>
              <Input type="date" {...form.register("issuedDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" {...form.register("expiryDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue(
                  "status",
                  v as CrewCertificationFormValues["status"]
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CURRENT">Current</SelectItem>
                <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="NOT_VERIFIED">Not Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Certification
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Availability Dialog ──────────────────────────────────────────────────

function AddAvailabilityDialog({
  crewMemberId,
  open,
  onOpenChange,
}: {
  crewMemberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const form = useForm<CrewAvailabilityFormValues>({
    resolver: zodResolver(crewAvailabilitySchema),
    defaultValues: {
      crewMemberId,
      type: "UNAVAILABLE",
      isAllDay: true,
      reason: "",
      startTime: "",
      endTime: "",
    },
  });

  const isAllDay = form.watch("isAllDay");

  const mutation = useMutation({
    mutationFn: (data: CrewAvailabilityFormValues) => addAvailability(data),
    onSuccess: () => {
      toast.success("Availability block added");
      queryClient.invalidateQueries({
        queryKey: ["crew-availability", orgId, crewMemberId],
      });
      onOpenChange(false);
      form.reset({ crewMemberId, type: "UNAVAILABLE", isAllDay: true, reason: "", startTime: "", endTime: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Availability Block</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) =>
                form.setValue("type", v as CrewAvailabilityFormValues["type"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                <SelectItem value="TENTATIVE">Tentative</SelectItem>
                <SelectItem value="PREFERRED">Preferred</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date *</Label>
              <Input type="date" {...form.register("startDate")} />
              {form.formState.errors.startDate && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startDate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>End Date *</Label>
              <Input type="date" {...form.register("endDate")} />
              {form.formState.errors.endDate && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isAllDay"
              checked={isAllDay}
              onCheckedChange={(v) => form.setValue("isAllDay", v === true)}
            />
            <Label htmlFor="isAllDay" className="cursor-pointer">
              All Day
            </Label>
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" {...form.register("startTime")} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" {...form.register("endTime")} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input
              placeholder="e.g. Holiday, Another gig, Personal"
              {...form.register("reason")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Block
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
