"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InviteMember } from "@/components/settings/invite-member";
import { MemberList } from "@/components/settings/member-list";
import { RoleManager } from "@/components/settings/role-manager";
import { useCanDo } from "@/lib/use-permissions";

export default function TeamSettingsPage() {
  const canInvite = useCanDo("orgMembers", "invite");
  const canManageRoles = useCanDo("orgMembers", "update_role");

  return (
    <div className="space-y-6">
      {canManageRoles && (
        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
            <CardDescription>
              Define custom roles with granular permissions for your team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleManager />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Invite and manage members of your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canInvite && (
            <>
              <InviteMember />
              <Separator />
            </>
          )}
          <MemberList />
        </CardContent>
      </Card>
    </div>
  );
}
