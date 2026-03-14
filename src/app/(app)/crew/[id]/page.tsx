"use client";

import { use } from "react";
import Link from "next/link";
import { PageMeta } from "@/components/layout/page-meta";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Mail, Phone, Trash2 } from "lucide-react";
import { AddressDisplay } from "@/components/ui/address-display";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getCrewMemberById, deleteCrewMember } from "@/server/crew";
import {
  crewMemberStatusLabels,
  crewMemberTypeLabels,
  crewCertStatusLabels,
  formatLabel,
} from "@/lib/status-labels";
import { useActiveOrganization } from "@/lib/auth-client";
import { CanDo } from "@/components/auth/permission-gate";
import { RequirePermission } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function CrewMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

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

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!member) return <div className="text-muted-foreground">Crew member not found.</div>;

  const fullName = `${member.firstName} ${member.lastName}`;
  const certifications = member.certifications || [];
  const skills = member.skills || [];

  return (
    <RequirePermission resource="crew" action="read">
      <PageMeta title={fullName} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
              <Badge variant="outline" className={statusColors[member.status] || ""}>
                {crewMemberStatusLabels[member.status] || formatLabel(member.status)}
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
              <Button variant="outline" render={<Link href={`/crew/${id}/edit`} />}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <CanDo resource="crew" action="delete">
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => { if (confirm("Delete this crew member? This cannot be undone.")) deleteMutation.mutate(); }}
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {member.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <a href={`mailto:${member.email}`} className="hover:underline">{member.email}</a>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${member.phone}`} className="hover:underline">{member.phone}</a>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Day Rate</span>
                <span className="font-medium">
                  {member.defaultDayRate != null ? `$${Number(member.defaultDayRate).toFixed(2)}` : "\u2014"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Hourly Rate</span>
                <span className="font-medium">
                  {member.defaultHourlyRate != null ? `$${Number(member.defaultHourlyRate).toFixed(2)}` : "\u2014"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>OT Multiplier</span>
                <span className="font-medium">
                  {member.overtimeMultiplier != null ? `${Number(member.overtimeMultiplier)}x` : "\u2014"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {member.emergencyContactName ? (
                <>
                  <p className="font-medium">{member.emergencyContactName}</p>
                  {member.emergencyContactPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <a href={`tel:${member.emergencyContactPhone}`} className="hover:underline">
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
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skills.map((skill: { id: string; name: string; category: string | null }) => (
              <Badge key={skill.id} variant="secondary">
                {skill.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Tags */}
        {member.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {member.tags.map((tag: string) => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Notes */}
        {member.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{member.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="certifications">
          <TabsList>
            <TabsTrigger value="certifications">Certifications ({certifications.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="certifications" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Certifications & Qualifications</CardTitle>
              </CardHeader>
              <CardContent>
                {certifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No certifications recorded.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Issued By</TableHead>
                          <TableHead className="hidden md:table-cell">Certificate #</TableHead>
                          <TableHead className="hidden md:table-cell">Issued</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {certifications.map((cert: {
                          id: string;
                          name: string;
                          issuedBy: string | null;
                          certificateNumber: string | null;
                          issuedDate: Date | string | null;
                          expiryDate: Date | string | null;
                          status: string;
                        }) => (
                          <TableRow key={cert.id}>
                            <TableCell className="font-medium">{cert.name}</TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell">
                              {cert.issuedBy || "\u2014"}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell font-mono text-sm">
                              {cert.certificateNumber || "\u2014"}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell">
                              {cert.issuedDate ? new Date(cert.issuedDate).toLocaleDateString() : "\u2014"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : "\u2014"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={certStatusColors[cert.status] || ""}>
                                {crewCertStatusLabels[cert.status] || formatLabel(cert.status)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RequirePermission>
  );
}
