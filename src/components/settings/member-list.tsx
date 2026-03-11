"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { NotViewer } from "@/components/auth/permission-gate";
import { toast } from "sonner";
import { getMembers } from "@/server/settings";
import { changeMemberRole, removeOrgMember } from "@/server/org-members";

const roleColors: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  manager: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  member: "bg-green-500/10 text-green-500 border-green-500/20",
  staff: "bg-green-500/10 text-green-500 border-green-500/20",
  warehouse: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  viewer: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const assignableRoles = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

export function MemberList() {
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["org-members"],
    queryFn: getMembers,
  });

  const changeRoleMut = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      changeMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: removeOrgMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Member removed");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = (members || []) as Array<{
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string; image: string | null };
  }>;

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No team members yet. Add someone above.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((member) => {
        const initials = member.user.name
          ?.split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.user.image || undefined} />
                <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{member.user.name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">
                  {member.user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.role === "owner" ? (
                <Badge
                  variant="outline"
                  className={roleColors[member.role] || ""}
                >
                  {member.role}
                </Badge>
              ) : (
                <NotViewer fallback={
                  <Badge variant="outline" className={roleColors[member.role] || ""}>
                    {member.role}
                  </Badge>
                }>
                  <Select
                    value={member.role}
                    onValueChange={(v) => {
                      if (v && v !== member.role) {
                        changeRoleMut.mutate({ memberId: member.id, role: v });
                      }
                    }}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </NotViewer>
              )}
              <NotViewer>
                {member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      if (confirm(`Remove ${member.user.name || member.user.email} from the organization?`)) {
                        removeMut.mutate(member.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </NotViewer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
