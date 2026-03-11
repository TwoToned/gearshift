"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

import { updateOrganization, type OrgSettings, type OrgBranding } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface BrandingSettingsProps {
  orgName: string;
  settings: OrgSettings;
  onBrandingChange?: (branding: OrgBranding | undefined) => void;
}

const DEFAULT_PRIMARY = "#0d4f4f";
const DEFAULT_ACCENT = "#10b981";
const DEFAULT_DOCUMENT = "#0d4f4f";

export function BrandingSettings({ orgName, settings, onBrandingChange }: BrandingSettingsProps) {
  const queryClient = useQueryClient();
  const branding = settings.branding || {};

  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor || DEFAULT_PRIMARY);
  const [accentColor, setAccentColor] = useState(branding.accentColor || DEFAULT_ACCENT);
  const [documentColor, setDocumentColor] = useState(branding.documentColor || DEFAULT_DOCUMENT);

  // Sync from server when settings change
  useEffect(() => {
    const b = settings.branding || {};
    setPrimaryColor(b.primaryColor || DEFAULT_PRIMARY);
    setAccentColor(b.accentColor || DEFAULT_ACCENT);
    setDocumentColor(b.documentColor || DEFAULT_DOCUMENT);
  }, [settings.branding]);

  const mutation = useMutation({
    mutationFn: () => {
      const newBranding: OrgBranding = {
        primaryColor: primaryColor !== DEFAULT_PRIMARY ? primaryColor : undefined,
        accentColor: accentColor !== DEFAULT_ACCENT ? accentColor : undefined,
        documentColor: documentColor !== DEFAULT_DOCUMENT ? documentColor : undefined,
      };
      // Only store branding if any color is customized
      const hasBranding = newBranding.primaryColor || newBranding.accentColor || newBranding.documentColor;
      return updateOrganization({
        name: orgName,
        settings: {
          ...settings,
          branding: hasBranding ? newBranding : undefined,
        },
      });
    },
    onSuccess: (_result, _vars, _ctx) => {
      // Sync branding to parent state so the org card's save doesn't overwrite it
      const newBranding: OrgBranding = {
        primaryColor: primaryColor !== DEFAULT_PRIMARY ? primaryColor : undefined,
        accentColor: accentColor !== DEFAULT_ACCENT ? accentColor : undefined,
        documentColor: documentColor !== DEFAULT_DOCUMENT ? documentColor : undefined,
      };
      const hasBranding = newBranding.primaryColor || newBranding.accentColor || newBranding.documentColor;
      onBrandingChange?.(hasBranding ? newBranding : undefined);
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Branding saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const hasChanges =
    primaryColor !== (branding.primaryColor || DEFAULT_PRIMARY) ||
    accentColor !== (branding.accentColor || DEFAULT_ACCENT) ||
    documentColor !== (branding.documentColor || DEFAULT_DOCUMENT);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <ColorPicker
          label="Primary Color"
          description="Buttons, links, sidebar accents"
          value={primaryColor}
          onChange={setPrimaryColor}
          defaultValue={DEFAULT_PRIMARY}
        />
        <ColorPicker
          label="Accent Color"
          description="Secondary highlights"
          value={accentColor}
          onChange={setAccentColor}
          defaultValue={DEFAULT_ACCENT}
        />
        <ColorPicker
          label="Document Color"
          description="PDF headings, borders, branding"
          value={documentColor}
          onChange={setDocumentColor}
          defaultValue={DEFAULT_DOCUMENT}
        />
      </div>

      {/* Preview */}
      <div className="flex items-center gap-3 rounded-md border p-3">
        <span className="text-xs text-muted-foreground">Preview:</span>
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-md border"
            style={{ backgroundColor: primaryColor }}
            title="Primary"
          />
          <div
            className="h-6 w-6 rounded-md border"
            style={{ backgroundColor: accentColor }}
            title="Accent"
          />
          <div
            className="h-6 w-6 rounded-md border"
            style={{ backgroundColor: documentColor }}
            title="Document"
          />
        </div>
        <button
          className="rounded-md px-2 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Sample Button
        </button>
        <span
          className="text-sm font-semibold"
          style={{ color: documentColor }}
        >
          Document Heading
        </span>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !hasChanges}
        >
          {mutation.isPending ? "Saving..." : "Save Branding"}
        </Button>
      </div>
    </div>
  );
}

function ColorPicker({
  label,
  description,
  value,
  onChange,
  defaultValue,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value.toUpperCase()}
          onChange={(e) => {
            let v = e.target.value;
            if (!v.startsWith("#")) v = "#" + v;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
              onChange(v.toLowerCase());
            }
          }}
          onBlur={() => {
            if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
              onChange(defaultValue);
            }
          }}
          className="w-20 font-mono text-sm bg-transparent border-b border-input px-0 py-0.5 text-muted-foreground focus:text-foreground focus:outline-none"
          maxLength={7}
        />
        {value !== defaultValue && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            title="Reset to default"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
