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
import { LocationManager } from "@/components/settings/location-manager";
import { SupplierManager } from "@/components/settings/supplier-manager";
import {
  getOrganization,
  updateOrganization,
  type OrgSettings,
} from "@/server/settings";

export default function SettingsPage() {
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization and team.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Organization Profile */}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgPhone">Phone</Label>
                <Input
                  id="orgPhone"
                  value={settings.phone || ""}
                  onChange={(e) => updateSetting("phone", e.target.value)}
                  placeholder="+61 ..."
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgAddress">Address</Label>
              <Input
                id="orgAddress"
                value={settings.address || ""}
                onChange={(e) => updateSetting("address", e.target.value)}
                placeholder="123 Main St, City"
              />
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={settings.currency || "AUD"}
                  onChange={(e) => updateSetting("currency", e.target.value)}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxLabel">Tax Label</Label>
                <Input
                  id="taxLabel"
                  value={settings.taxLabel || "GST"}
                  onChange={(e) => updateSetting("taxLabel", e.target.value)}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assetTagCounter">Current Counter</Label>
                <Input
                  id="assetTagCounter"
                  type="number"
                  value={settings.assetTagCounter ?? 0}
                  onChange={(e) => updateSetting("assetTagCounter", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Next tag: <span className="font-mono font-medium">{(settings.assetTagPrefix || "")}{String((settings.assetTagCounter ?? 0) + 1).padStart(settings.assetTagDigits ?? 4, "0")}</span>
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding & Colors</CardTitle>
            <CardDescription>
              Customize your organization's colors across the UI and PDF documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandingSettings orgName={name} settings={settings} />
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardContent className="pt-6">
            <CategoryManager />
          </CardContent>
        </Card>

        {/* Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <CardDescription>
              Manage warehouses, venues, and storage locations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocationManager />
          </CardContent>
        </Card>

        {/* Suppliers */}
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

        {/* Team */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Invite and manage members of your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InviteMember />
            <Separator />
            <MemberList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
