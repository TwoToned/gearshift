"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteMember } from "@/components/settings/invite-member";
import { MemberList } from "@/components/settings/member-list";
import { BrandingSettings } from "@/components/settings/branding-settings";
import { CategoryManager } from "@/components/assets/category-manager";
import Link from "next/link";
import { SupplierManager } from "@/components/settings/supplier-manager";
import { RoleManager } from "@/components/settings/role-manager";
import {
  getOrganization,
  updateOrganization,
  type OrgSettings,
} from "@/server/settings";
import { CanDo } from "@/components/auth/permission-gate";
import { useCanDo } from "@/lib/use-permissions";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const canEditSettings = useCanDo("orgSettings", "update");
  const canReadSettings = useCanDo("orgSettings", "read");
  const canReadMembers = useCanDo("orgMembers", "read");
  const canInviteMembers = useCanDo("orgMembers", "invite");
  const canManageRoles = useCanDo("orgMembers", "update_role");

  const { data: org } = useQuery({
    queryKey: ["organization"],
    queryFn: getOrganization,
  });

  const [name, setName] = useState("");
  const [settings, setSettings] = useState<OrgSettings>({});

  useEffect(() => {
    if (org) {
      setName((org as Record<string, unknown>).name as string || "");
      setSettings((org as Record<string, unknown>).settings as OrgSettings || {});
    }
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: () => updateOrganization({ name, settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSetting = (key: keyof OrgSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateTestTagSetting = (key: string, value: string | number) => {
    setSettings((prev) => ({
      ...prev,
      testTag: { ...prev.testTag, [key]: value },
    }));
  };

  // If user has no settings or members access at all, show access denied
  if (!canReadSettings && !canReadMembers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have permission to access settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization and team.
        </p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Organization Profile — only visible with orgSettings read */}
        {canReadSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>
                Business details and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Business Name</Label>
                <Input
                  id="orgName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEditSettings}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgEmail">Email</Label>
                  <Input
                    id="orgEmail"
                    type="email"
                    value={settings.email || ""}
                    onChange={(e) => updateSetting("email", e.target.value)}
                    placeholder="info@company.com"
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgPhone">Phone</Label>
                  <Input
                    id="orgPhone"
                    value={settings.phone || ""}
                    onChange={(e) => updateSetting("phone", e.target.value)}
                    placeholder="+61 ..."
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgWebsite">Website</Label>
                <Input
                  id="orgWebsite"
                  value={settings.website || ""}
                  onChange={(e) => updateSetting("website", e.target.value)}
                  placeholder="https://..."
                  disabled={!canEditSettings}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgAddress">Address</Label>
                  <Input
                    id="orgAddress"
                    value={settings.address || ""}
                    onChange={(e) => updateSetting("address", e.target.value)}
                    placeholder="123 Main St, City"
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    value={settings.timezone || ""}
                    onChange={(e) => updateSetting("timezone", e.target.value)}
                    disabled={!canEditSettings}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Auto (browser)</option>
                    <option value="Pacific/Auckland">Pacific/Auckland (NZST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                    <option value="Australia/Brisbane">Australia/Brisbane (AEST, no DST)</option>
                    <option value="Australia/Adelaide">Australia/Adelaide (ACST)</option>
                    <option value="Australia/Darwin">Australia/Darwin (ACST, no DST)</option>
                    <option value="Australia/Perth">Australia/Perth (AWST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Chicago">America/Chicago (CST)</option>
                    <option value="America/Denver">America/Denver (MST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Used for date display across the platform.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={settings.currency || "AUD"}
                    onChange={(e) => updateSetting("currency", e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={settings.taxRate ?? 10}
                    onChange={(e) => updateSetting("taxRate", parseFloat(e.target.value) || 0)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxLabel">Tax Label</Label>
                  <Input
                    id="taxLabel"
                    value={settings.taxLabel || "GST"}
                    onChange={(e) => updateSetting("taxLabel", e.target.value)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="assetTagPrefix">Asset Tag Prefix</Label>
                  <Input
                    id="assetTagPrefix"
                    value={settings.assetTagPrefix || ""}
                    onChange={(e) => updateSetting("assetTagPrefix", e.target.value)}
                    placeholder="e.g. TTP-"
                    disabled={!canEditSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include any separator you want (e.g. &quot;TTP-&quot; or &quot;TTP&quot;)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assetTagDigits">Number of Digits</Label>
                  <Input
                    id="assetTagDigits"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.assetTagDigits ?? 4}
                    onChange={(e) => updateSetting("assetTagDigits", parseInt(e.target.value) || 4)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assetTagCounter">Current Counter</Label>
                  <Input
                    id="assetTagCounter"
                    type="number"
                    value={settings.assetTagCounter ?? 0}
                    onChange={(e) => updateSetting("assetTagCounter", parseInt(e.target.value) || 0)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Next tag: <span className="font-mono font-medium">{(settings.assetTagPrefix || "")}{String((settings.assetTagCounter ?? 0) + 1).padStart(settings.assetTagDigits ?? 4, "0")}</span>
              </p>
              {canEditSettings && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test & Tag Settings */}
        {canReadSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Test & Tag</CardTitle>
              <CardDescription>
                Configure test tag ID format and testing defaults.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ttPrefix">Test Tag Prefix</Label>
                  <Input
                    id="ttPrefix"
                    value={settings.testTag?.prefix || ""}
                    onChange={(e) => updateTestTagSetting("prefix", e.target.value)}
                    placeholder="e.g. TTP-TT-"
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttDigits">Number of Digits</Label>
                  <Input
                    id="ttDigits"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.testTag?.digits ?? 4}
                    onChange={(e) => updateTestTagSetting("digits", parseInt(e.target.value) || 4)}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttCounter">Current Counter</Label>
                  <Input
                    id="ttCounter"
                    type="number"
                    value={settings.testTag?.counter ?? 0}
                    onChange={(e) => updateTestTagSetting("counter", parseInt(e.target.value) || 0)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Next test tag: <span className="font-mono font-medium">{(settings.testTag?.prefix || "TT")}{String((settings.testTag?.counter ?? 0) + 1).padStart(settings.testTag?.digits ?? 4, "0")}</span>
              </p>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ttDefaultInterval">Default Interval (months)</Label>
                  <Input
                    id="ttDefaultInterval"
                    type="number"
                    min={1}
                    max={120}
                    value={settings.testTag?.defaultIntervalMonths ?? 3}
                    onChange={(e) => updateTestTagSetting("defaultIntervalMonths", parseInt(e.target.value) || 3)}
                    disabled={!canEditSettings}
                  />
                  <p className="text-xs text-muted-foreground">Hire/rental equipment: 3 months (AS/NZS 3760)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttDueSoonDays">Due Soon Threshold (days)</Label>
                  <Input
                    id="ttDueSoonDays"
                    type="number"
                    min={1}
                    max={90}
                    value={settings.testTag?.dueSoonThresholdDays ?? 14}
                    onChange={(e) => updateTestTagSetting("dueSoonThresholdDays", parseInt(e.target.value) || 14)}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ttDefaultTester">Default Tester Name</Label>
                  <Input
                    id="ttDefaultTester"
                    value={settings.testTag?.defaultTesterName || ""}
                    onChange={(e) => updateTestTagSetting("defaultTesterName", e.target.value)}
                    placeholder="Pre-filled in Quick Test"
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttCheckoutPolicy">Checkout Policy</Label>
                  <select
                    id="ttCheckoutPolicy"
                    value={settings.testTag?.checkoutPolicy || "WARN"}
                    onChange={(e) => updateTestTagSetting("checkoutPolicy", e.target.value)}
                    disabled={!canEditSettings}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="WARN">Warn on overdue items</option>
                    <option value="BLOCK">Block checkout of overdue items</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    What happens when checking out an asset with an overdue test tag
                  </p>
                </div>
              </div>
              {canEditSettings && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Branding */}
        {canReadSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Branding & Colors</CardTitle>
              <CardDescription>
                Customize your organization&apos;s colors across the UI and PDF documents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingSettings orgName={name} settings={settings} onBrandingChange={(branding) => setSettings((prev) => ({ ...prev, branding }))} />
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        {canEditSettings && (
          <Card>
            <CardContent className="pt-6">
              <CategoryManager />
            </CardContent>
          </Card>
        )}

        {/* Locations */}
        {canEditSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Locations</CardTitle>
              <CardDescription>
                Manage warehouses, venues, and storage locations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" render={<Link href="/locations" />}>
                Manage Locations
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Suppliers */}
        {canEditSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>
                Manage your equipment suppliers and vendors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupplierManager />
            </CardContent>
          </Card>
        )}

        {/* Roles & Permissions */}
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

        {/* Team */}
        {canReadMembers && (
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Invite and manage members of your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canInviteMembers && (
                <>
                  <InviteMember />
                  <Separator />
                </>
              )}
              <MemberList />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
