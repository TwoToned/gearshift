"use client";

import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useRef } from "react";

interface AssetQRCodeProps {
  assetTag: string;
  label?: string;
}

export function AssetQRCode({ assetTag, label }: AssetQRCodeProps) {
  const svgRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    if (!svgRef.current) return;
    const svg = svgRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${assetTag}-qr.png`;
      link.href = url;
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">QR Code</CardTitle>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2 h-3 w-3" />
          Download
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <div ref={svgRef} className="rounded-md bg-white p-3">
          <QRCode value={assetTag} size={160} />
        </div>
        <p className="font-mono text-sm font-medium">{label || assetTag}</p>
      </CardContent>
    </Card>
  );
}
