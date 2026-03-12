"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandingSettings } from "@/components/settings/branding-settings";
import {
  getOrganization,
  type OrgSettings,
} from "@/server/settings";

export default function BrandingSettingsPage() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding & Colors</CardTitle>
        <CardDescription>
          Customize your organization&apos;s colors across the UI and PDF documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BrandingSettings
          orgName={name}
          settings={settings}
          onBrandingChange={(branding) => setSettings((prev) => ({ ...prev, branding }))}
        />
      </CardContent>
    </Card>
  );
}
