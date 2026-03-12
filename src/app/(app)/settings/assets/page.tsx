"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryManager } from "@/components/assets/category-manager";
import { SupplierManager } from "@/components/settings/supplier-manager";
import {
  getOrganization,
  updateOrganization,
  type OrgSettings,
} from "@/server/settings";
import { useCanDo } from "@/lib/use-permissions";

export default function AssetsSettingsPage() {
  const queryClient = useQueryClient();
  const canEdit = useCanDo("orgSettings", "update");

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
      <Card>
        <CardHeader>
          <CardTitle>Asset Tags</CardTitle>
          <CardDescription>
            Configure auto-incrementing asset tag format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="assetTagPrefix">Prefix</Label>
              <Input
                id="assetTagPrefix"
                value={settings.assetTagPrefix || ""}
                onChange={(e) => updateSetting("assetTagPrefix", e.target.value)}
                placeholder="e.g. TTP-"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Include any separator (e.g. &quot;TTP-&quot; or &quot;TTP&quot;)
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
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetTagCounter">Current Counter</Label>
              <Input
                id="assetTagCounter"
                type="number"
                value={settings.assetTagCounter ?? 0}
                onChange={(e) => updateSetting("assetTagCounter", parseInt(e.target.value) || 0)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Next tag: <span className="font-mono font-medium">{(settings.assetTagPrefix || "")}{String((settings.assetTagCounter ?? 0) + 1).padStart(settings.assetTagDigits ?? 4, "0")}</span>
          </p>
          {canEdit && (
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

      {canEdit && (
        <Card>
          <CardContent className="pt-6">
            <CategoryManager />
          </CardContent>
        </Card>
      )}

      {canEdit && (
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

      {canEdit && (
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
    </div>
  );
}
