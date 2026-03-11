"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Shield, ShieldOff, Ban, CheckCircle, Trash2, KeyRound } from "lucide-react";
import {
  getAllUsers,
  promoteToSiteAdmin,
  demoteFromSiteAdmin,
  banUser,
  unbanUser,
  adminDeleteUser,
  forceDisable2FA,
} from "@/server/site-admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
type UserRow = any;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => getAllUsers({ page, pageSize: 20, search }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const promoteMutation = useMutation({
    mutationFn: promoteToSiteAdmin,
    onSuccess: () => {
      invalidate();
      toast.success("User promoted to site admin");
    },
    onError: (e) => toast.error(e.message),
  });

  const demoteMutation = useMutation({
    mutationFn: demoteFromSiteAdmin,
    onSuccess: () => {
      invalidate();
      toast.success("User demoted from site admin");
    },
    onError: (e) => toast.error(e.message),
  });

  const banMutation = useMutation({
    mutationFn: banUser,
    onSuccess: () => {
      invalidate();
      toast.success("User banned");
    },
    onError: (e) => toast.error(e.message),
  });

  const unbanMutation = useMutation({
    mutationFn: unbanUser,
    onSuccess: () => {
      invalidate();
      toast.success("User unbanned");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: adminDeleteUser,
    onSuccess: () => {
      invalidate();
      toast.success("User deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const disable2FAMutation = useMutation({
    mutationFn: forceDisable2FA,
    onSuccess: () => {
      invalidate();
      toast.success("2FA disabled for user");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage all users across the platform.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">User</th>
                    <th className="p-3 text-left font-medium">Site Role</th>
                    <th className="p-3 text-left font-medium">Organizations</th>
                    <th className="p-3 text-center font-medium">2FA</th>
                    <th className="p-3 text-center font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Joined</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : data?.users?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    data?.users?.map((user: UserRow) => (
                      <tr key={user.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {user.role === "admin" ? (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                              Site Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">User</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {user.members?.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              user.members?.map(
                                (
                                  m: {
                                    role: string;
                                    organization: { id: string; name: string };
                                  },
                                  i: number,
                                ) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {m.organization.name} ({m.role})
                                  </Badge>
                                ),
                              )
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {user.twoFactorEnabled ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              On
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Off</Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {user.banned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              Active
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" />
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                {user.role !== "admin" ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      promoteMutation.mutate(user.id)
                                    }
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Promote to Site Admin
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      demoteMutation.mutate(user.id)
                                    }
                                  >
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    Demote from Site Admin
                                  </DropdownMenuItem>
                                )}
                                {!user.banned ? (
                                  <DropdownMenuItem
                                    onClick={() => banMutation.mutate(user.id)}
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Ban User
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      unbanMutation.mutate(user.id)
                                    }
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Unban User
                                  </DropdownMenuItem>
                                )}
                                {user.twoFactorEnabled && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      disable2FAMutation.mutate(user.id)
                                    }
                                  >
                                    <KeyRound className="mr-2 h-4 w-4" />
                                    Force Disable 2FA
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteTarget(user)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {data.users?.length} of {data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTarget?.name}</strong> (
              {deleteTarget?.email}). This removes them from all organizations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
