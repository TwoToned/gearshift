"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Warehouse,
  ScanBarcode,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { scanLookup } from "@/server/scan-lookup";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/assets/registry", icon: Package, label: "Assets", matchPrefix: "/assets" },
  { href: "__scan__", icon: ScanBarcode, label: "Scan", isScan: true },
  { href: "/projects", icon: FolderOpen, label: "Projects" },
  { href: "/warehouse", icon: Warehouse, label: "Warehouse" },
];

/**
 * Mobile bottom navigation bar.
 * Shown only on mobile screens. Provides quick access to key sections
 * and a central scan button for camera-based barcode scanning.
 */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [scannerOpen, setScannerOpen] = useState(false);

  if (!isMobile) return null;

  const handleScan = async (value: string) => {
    try {
      const result = await scanLookup(value);
      if (result.url) {
        setScannerOpen(false);
        router.push(result.url);
        toast.success(`Found ${result.label}`);
      } else {
        toast.error(`Nothing found for "${value}"`);
      }
    } catch {
      toast.error("Lookup failed");
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around px-1">
          {navItems.map((item) => {
            if (item.isScan) {
              return (
                <button
                  key="scan"
                  onClick={() => setScannerOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 text-primary transition-colors"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }

            const isActive = item.matchPrefix
              ? pathname.startsWith(item.matchPrefix)
              : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setScannerOpen(false)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <BarcodeScanner
              open={scannerOpen}
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
              title="Quick scan"
            />
          </div>
        </div>
      )}
    </>
  );
}
