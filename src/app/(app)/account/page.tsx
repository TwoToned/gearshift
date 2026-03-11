"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Shield,
  KeyRound,
  Monitor,
  LogOut,
  Building2,
  DoorOpen,
  Loader2,
} from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import {
  getProfile,
  updateProfile,
  getUserOrganizations,
  leaveOrganization,
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
} from "@/server/user-profile";

export default function AccountPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 2FA
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [totpURI, setTotpURI] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [verifyCode, setVerifyCode] = useState("");

  // Leave org dialog
  const [leaveOrgTarget, setLeaveOrgTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  const orgsQuery = useQuery({
    queryKey: ["user-organizations"],
    queryFn: getUserOrganizations,
  });

  const sessionsQuery = useQuery({
    queryKey: ["active-sessions"],
    queryFn: getActiveSessions,
  });

  // Set name once loaded
  if (profileQuery.data && !nameLoaded) {
    setName(profileQuery.data.name || "");
    setNameLoaded(true);
  }

  const updateProfileMutation = useMutation({
    mutationFn: () => updateProfile({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Passwords don't match");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (res.error) throw new Error(res.error.message || "Failed to change password");
    },
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const leaveOrgMutation = useMutation({
    mutationFn: (orgId: string) => leaveOrganization(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("Left organization");
      setLeaveOrgTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      toast.success("Session revoked");
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeAllMutation = useMutation({
    mutationFn: revokeAllOtherSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      toast.success("All other sessions revoked");
    },
    onError: (e) => toast.error(e.message),
  });

  // 2FA setup
  const enable2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await authClient.twoFactor.enable({
        password: currentPassword,
      });
      if (res.error) throw new Error(res.error.message || "Failed to enable 2FA");
      const uri = res.data?.totpURI || "";
      setTotpURI(uri);
      // Generate QR code data URL
      if (uri) {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 2 });
        setQrDataUrl(dataUrl);
      }
      return res.data;
    },
    onSuccess: () => {
      setShow2FASetup(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const verify2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await authClient.twoFactor.verifyTotp({
        code: verifyCode,
      });
      if (res.error) throw new Error(res.error.message || "Invalid code");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("2FA enabled successfully");
      setShow2FASetup(false);
      setVerifyCode("");
      setCurrentPassword("");
      setTotpURI("");
      setQrDataUrl("");
    },
    onError: (e) => toast.error(e.message),
  });

  const disable2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await authClient.twoFactor.disable({
        password: currentPassword,
      });
      if (res.error) throw new Error(res.error.message || "Failed to disable 2FA");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("2FA disabled");
      setCurrentPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const profile = profileQuery.data;
  const initials = profile?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile, security, and sessions.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.image || undefined} />
              <AvatarFallback className="text-lg">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile?.name}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {profile?.role === "admin" && (
                <Badge className="mt-1 bg-red-500/10 text-red-500 border-red-500/20">
                  Site Admin
                </Badge>
              )}
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Saving..." : "Update Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card id="security">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Change */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Change Password</h3>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => changePasswordMutation.mutate()}
              disabled={
                changePasswordMutation.isPending ||
                !currentPassword ||
                !newPassword
              }
            >
              {changePasswordMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Change Password
            </Button>
          </div>

          <Separator />

          {/* 2FA */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Two-Factor Authentication</h3>
            {profile?.twoFactorEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                    Enabled
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Your account is protected with 2FA.
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => disable2FAMutation.mutate()}
                  disabled={disable2FAMutation.isPending || !currentPassword}
                >
                  Disable 2FA
                </Button>
                <p className="text-xs text-muted-foreground">
                  Enter your current password above, then click Disable 2FA.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account using a TOTP authenticator app.
                </p>
                <Button
                  variant="outline"
                  onClick={() => enable2FAMutation.mutate()}
                  disabled={enable2FAMutation.isPending || !currentPassword}
                >
                  {enable2FAMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-4 w-4" />
                  )}
                  Enable 2FA
                </Button>
                <p className="text-xs text-muted-foreground">
                  Enter your current password above, then click Enable 2FA.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
          </CardTitle>
          <CardDescription>
            Organizations you belong to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t belong to any organizations.
            </p>
          ) : (
            <div className="space-y-3">
              {orgsQuery.data?.map(
                (m: {
                  id: string;
                  role: string;
                  organization: { id: string; name: string; slug: string };
                }) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="font-medium">{m.organization.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.role}
                      </div>
                    </div>
                    {m.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setLeaveOrgTarget({
                            id: m.organization.id,
                            name: m.organization.name,
                          })
                        }
                      >
                        <DoorOpen className="mr-1 h-4 w-4" />
                        Leave
                      </Button>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Devices where you&apos;re currently logged in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {sessionsQuery.data?.map(
            (s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {s.userAgent
                        ? s.userAgent.substring(0, 60) +
                          (s.userAgent.length > 60 ? "..." : "")
                        : "Unknown device"}
                    </span>
                    {s.isCurrent && (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.ipAddress || "Unknown IP"} -{" "}
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
                {!s.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSessionMutation.mutate(s.id)}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => revokeAllMutation.mutate()}
            disabled={revokeAllMutation.isPending}
          >
            Sign out all other sessions
          </Button>
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FASetup} onOpenChange={setShow2FASetup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
              then enter the 6-digit code to verify.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {totpURI && (
              <div className="space-y-3">
                {qrDataUrl && (
                  <div className="flex justify-center p-4 bg-white rounded-md">
                    <img src={qrDataUrl} alt="2FA QR Code" width={200} height={200} />
                  </div>
                )}
                <details className="text-center">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Can&apos;t scan? Show manual entry key
                  </summary>
                  <p className="mt-2 text-xs break-all font-mono bg-muted p-2 rounded-md">
                    {totpURI}
                  </p>
                </details>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="totpCode">Verification Code</Label>
              <Input
                id="totpCode"
                placeholder="000000"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow2FASetup(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => verify2FAMutation.mutate()}
              disabled={verify2FAMutation.isPending || verifyCode.length !== 6}
            >
              {verify2FAMutation.isPending ? "Verifying..." : "Verify & Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Org Dialog */}
      <Dialog
        open={!!leaveOrgTarget}
        onOpenChange={(open) => !open && setLeaveOrgTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave{" "}
              <strong>{leaveOrgTarget?.name}</strong>? You will lose access to
              all organization data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOrgTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                leaveOrgTarget &&
                leaveOrgMutation.mutate(leaveOrgTarget.id)
              }
              disabled={leaveOrgMutation.isPending}
            >
              {leaveOrgMutation.isPending ? "Leaving..." : "Leave Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
