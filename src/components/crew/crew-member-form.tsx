"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { crewMemberSchema, type CrewMemberFormValues } from "@/lib/validations/crew";
import { createCrewMember, updateCrewMember, getCrewRoleOptions, getCrewSkillOptions } from "@/server/crew";
import { getOrgTags } from "@/server/tags";
import { useActiveOrganization } from "@/lib/auth-client";
import { useOrgCountry } from "@/lib/use-org-country";
import { TagInput } from "@/components/ui/tag-input";
import { AddressInput } from "@/components/ui/address-input";
import { ComboboxPicker } from "@/components/ui/combobox-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CrewMemberFormProps {
  initialData?: CrewMemberFormValues & { id: string };
}

export function CrewMemberForm({ initialData }: CrewMemberFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;
  const orgCountry = useOrgCountry();

  const { data: orgTags } = useQuery({
    queryKey: ["org-tags", orgId],
    queryFn: () => getOrgTags(),
  });

  const { data: roleOptions } = useQuery({
    queryKey: ["crew-role-options", orgId],
    queryFn: () => getCrewRoleOptions(),
  });

  const { data: skillOptions } = useQuery({
    queryKey: ["crew-skill-options", orgId],
    queryFn: () => getCrewSkillOptions(),
  });

  const form = useForm<CrewMemberFormValues>({
    resolver: zodResolver(crewMemberSchema),
    defaultValues: initialData || {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      type: "FREELANCER",
      status: "ACTIVE",
      department: "",
      crewRoleId: "",
      defaultDayRate: "",
      defaultHourlyRate: "",
      overtimeMultiplier: "",
      currency: "",
      address: "",
      addressLatitude: null,
      addressLongitude: null,
      emergencyContactName: "",
      emergencyContactPhone: "",
      dateOfBirth: "",
      abnOrGst: "",
      notes: "",
      tags: [],
      skillIds: [],
      isActive: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CrewMemberFormValues) =>
      isEditing ? updateCrewMember(initialData.id, data) : createCrewMember(data),
    onSuccess: (result) => {
      toast.success(isEditing ? "Crew member updated" : "Crew member created");
      router.push(`/crew/${result.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedSkillIds = form.watch("skillIds") || [];

  return (
    <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input id="firstName" {...form.register("firstName")} placeholder="e.g. John" />
            {form.formState.errors.firstName && (
              <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input id="lastName" {...form.register("lastName")} placeholder="e.g. Smith" />
            {form.formState.errors.lastName && (
              <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} placeholder="email@example.com" />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...form.register("phone")} placeholder="+61 400 000 000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abnOrGst">ABN / GST</Label>
            <Input id="abnOrGst" {...form.register("abnOrGst")} placeholder="e.g. 12 345 678 901" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => form.setValue("type", v as CrewMemberFormValues["type"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type">
                  {({ FREELANCER: "Freelancer", EMPLOYEE: "Employee", CONTRACTOR: "Contractor", VOLUNTEER: "Volunteer" } as Record<string, string>)[form.watch("type") || ""] || "Select type"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREELANCER">Freelancer</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) => form.setValue("status", v as CrewMemberFormValues["status"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status">
                  {({ ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave", ARCHIVED: "Archived" } as Record<string, string>)[form.watch("status") || ""] || "Select status"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" {...form.register("department")} placeholder="e.g. Audio, Lighting, Video" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Controller
              name="crewRoleId"
              control={form.control}
              render={({ field }) => (
                <ComboboxPicker
                  value={field.value || ""}
                  onChange={field.onChange}
                  options={(roleOptions || []).map((r: { id: string; name: string; department: string | null }) => ({
                    value: r.id,
                    label: r.name,
                    description: r.department || undefined,
                  }))}
                  placeholder="Select role..."
                  allowClear
                  creatable
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="defaultDayRate">Day Rate ($)</Label>
            <Input id="defaultDayRate" type="number" step="0.01" {...form.register("defaultDayRate")} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultHourlyRate">Hourly Rate ($)</Label>
            <Input id="defaultHourlyRate" type="number" step="0.01" {...form.register("defaultHourlyRate")} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="overtimeMultiplier">Overtime Multiplier</Label>
            <Input id="overtimeMultiplier" type="number" step="0.1" {...form.register("overtimeMultiplier")} placeholder="1.5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(skillOptions || []).map((skill: { id: string; name: string; category: string | null }) => {
              const isSelected = selectedSkillIds.includes(skill.id);
              return (
                <Badge
                  key={skill.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => {
                    const current = form.getValues("skillIds") || [];
                    if (isSelected) {
                      form.setValue("skillIds", current.filter((id: string) => id !== skill.id));
                    } else {
                      form.setValue("skillIds", [...current, skill.id]);
                    }
                  }}
                >
                  {skill.name}
                  {skill.category && <span className="ml-1 opacity-60">({skill.category})</span>}
                </Badge>
              );
            })}
            {(!skillOptions || skillOptions.length === 0) && (
              <p className="text-sm text-muted-foreground">No skills defined yet. Create skills from crew member detail pages.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            name="address"
            control={form.control}
            render={({ field }) => (
              <AddressInput
                value={field.value ?? ""}
                onChange={field.onChange}
                onPlaceSelect={(place) => {
                  if (place) {
                    form.setValue("addressLatitude", place.latitude);
                    form.setValue("addressLongitude", place.longitude);
                  } else {
                    form.setValue("addressLatitude", null);
                    form.setValue("addressLongitude", null);
                  }
                }}
                initialCoordinates={
                  form.watch("addressLatitude") != null && form.watch("addressLongitude") != null
                    ? { latitude: form.watch("addressLatitude") as number, longitude: form.watch("addressLongitude") as number }
                    : null
                }
                placeholder="Home address"
                countryCode={orgCountry}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">Contact Name</Label>
            <Input id="emergencyContactName" {...form.register("emergencyContactName")} placeholder="Emergency contact name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
            <Input id="emergencyContactPhone" {...form.register("emergencyContactPhone")} placeholder="+61 400 000 000" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Additional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...form.register("notes")} placeholder="Any additional notes" rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <Controller
              name="tags"
              control={form.control}
              render={({ field }) => (
                <TagInput
                  value={field.value ?? []}
                  onChange={field.onChange}
                  suggestions={orgTags}
                  placeholder="Add tags..."
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Update Crew Member" : "Create Crew Member"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
